import pandas as pd
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report, confusion_matrix
import joblib

def evaluate_predictions():
    print("Loading inference predictions and original ground truth...")
    
    # Load predictions saved in Stage 5
    preds_df = pd.read_csv("artifacts/inference_predictions.csv")
    
    # Load noisy dataset which contains the true_rate ground truth
    df_noisy = pd.read_csv("data/ernakulam_noisy.csv")
    
    # Load the fitted risk scaler from Stage 2 to compute true risk scores
    scaler = joblib.load('artifacts/risk_scaler.pkl')
    
    # Recreate true risk scores from true_rate where available
    valid_mask = df_noisy['true_rate'].notna()
    df_noisy['actual_risk_score'] = np.nan
    if valid_mask.sum() > 0:
        transformed_vals = scaler.transform(df_noisy.loc[valid_mask, ['true_rate']])
        df_noisy.loc[valid_mask, 'actual_risk_score'] = np.clip(transformed_vals.ravel(), 0.0, 1.0)
        
    # Recreate true risk bands using the clean tertile cut-points (q33, q67)
    # Based on our earlier clean data cut-points: Low <= 0.0960 < Medium <= 0.2057 < High
    q33, q67 = 0.0960, 0.2057
    
    def get_risk_band(score):
        if pd.isna(score):
            return np.nan
        if score <= q33:
            return 'Low'
        elif score <= q67:
            return 'Medium'
        else:
            return 'High'
            
    df_noisy['actual_risk_band'] = df_noisy['actual_risk_score'].apply(get_risk_band)
    
    # Combine predictions and actuals into a single evaluation dataframe
    eval_df = preds_df.copy()
    eval_df['actual_risk_score'] = df_noisy['actual_risk_score']
    eval_df['actual_risk_band'] = df_noisy['actual_risk_band']
    
    # Filter rows where ground truth is present (dropping NaNs)
    eval_clean = eval_df.dropna(subset=['actual_risk_score', 'actual_risk_band']).copy()
    
    print(f"Evaluating on {len(eval_clean)} rows with available ground truth...\n")
    
    # --- 1. REGRESSION EVALUATION (Risk Score) ---
    y_true_reg = eval_clean['actual_risk_score']
    y_pred_reg = eval_clean['predicted_risk_score']
    
    rmse = np.sqrt(mean_squared_error(y_true_reg, y_pred_reg))
    mae = mean_absolute_error(y_true_reg, y_pred_reg)
    r2 = r2_score(y_true_reg, y_pred_reg)
    
    print("================ REGRESSION METRICS (Risk Score) ================")
    print(f"RMSE (Root Mean Squared Error): {rmse:.4f}")
    print(f"MAE  (Mean Absolute Error):       {mae:.4f}")
    print(f"R2 Score:                         {r2:.4f}")
    
    # --- 2. CLASSIFICATION EVALUATION (Risk Band) ---
    y_true_clf = eval_clean['actual_risk_band']
    y_pred_clf = eval_clean['predicted_risk_band']
    
    acc = accuracy_score(y_true_clf, y_pred_clf)
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true_clf, y_pred_clf, average='weighted', zero_division=0
    )
    
    print("\n================ CLASSIFICATION METRICS (Risk Band) ================")
    print(f"Accuracy:  {acc:.4f} ({acc * 100:.2f}%)")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1-Score:  {f1:.4f}")
    
    print("\nDetailed Classification Report:")
    print(classification_report(y_true_clf, y_pred_clf, zero_division=0))
    
    print("Confusion Matrix:")
    labels = ['Low', 'Medium', 'High']
    cm = confusion_matrix(y_true_clf, y_pred_clf, labels=labels)
    cm_df = pd.DataFrame(cm, index=[f"Actual_{l}" for l in labels], columns=[f"Pred_{l}" for l in labels])
    print(cm_df)
    
    print("\nEvaluation Complete!")

if __name__ == "__main__":
    evaluate_predictions()