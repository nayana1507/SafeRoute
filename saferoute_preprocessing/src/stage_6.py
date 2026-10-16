import pandas as pd
import numpy as np
import joblib
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score, f1_score

# Ensure FeatureEngineer is defined in module scope for unpickling compatibility
class FeatureEngineer(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        return self
    def transform(self, X):
        X = X.copy()
        for col in ['hour', 'day_of_week', 'is_night', 'rain', 'low_footfall', 'poor_lighting']:
            if col in X.columns:
                X[col] = pd.to_numeric(X[col], errors='coerce').fillna(0)
                
        if 'hour' in X.columns:
            X['hour_sin'] = np.sin(2 * np.pi * X['hour'] / 24.0)
            X['hour_cos'] = np.cos(2 * np.pi * X['hour'] / 24.0)
        if 'day_of_week' in X.columns:
            X['dow_sin'] = np.sin(2 * np.pi * X['day_of_week'] / 7.0)
            X['dow_cos'] = np.cos(2 * np.pi * X['day_of_week'] / 7.0)
        if all(col in X.columns for col in ['is_night', 'rain']):
            X['night_rain_interaction'] = X['is_night'] * X['rain']
        if all(col in X.columns for col in ['low_footfall', 'poor_lighting']):
            X['vulnerability_index'] = X['low_footfall'] + X['poor_lighting']
        return X

def run_evaluation_and_robustness():
    """Evaluate models on clean vs noisy test sets and compute degradation gap & per-zone errors."""
    print("Loading models and pipeline artifacts...")
    pipeline = joblib.load('artifacts/preprocessing_pipeline.pkl')
    reg_model = joblib.load('artifacts/risk_regressor.pkl')
    clf_model = joblib.load('artifacts/risk_classifier.pkl')
    
    # 1. Load Clean Dataset and recreate test split (seed=42)
    df_clean = pd.read_csv("data/ernakulam_clean.csv")
    for col in ['incident_rate_was_missing', 'accident_risk_was_missing', 'demand_was_missing',
                'poor_lighting_was_missing', 'rain_was_missing', 'subzone_was_missing',
                'is_weekend_mismatch', 'is_night_mismatch', 'is_outlier', 'is_near_duplicate']:
        if col not in df_clean.columns:
            df_clean[col] = 0

    from sklearn.preprocessing import MinMaxScaler
    scaler = MinMaxScaler()
    df_clean['risk_score'] = np.clip(scaler.fit_transform(df_clean[['true_rate']]).ravel(), 0.0, 1.0)
    
    q33 = df_clean['risk_score'].quantile(0.3333)
    q67 = df_clean['risk_score'].quantile(0.6667)
    
    def get_risk_band(score):
        if score <= q33:
            return 'Low'
        elif score <= q67:
            return 'Medium'
        else:
            return 'High'
            
    df_clean['risk_band'] = df_clean['risk_score'].apply(get_risk_band)
    
    leaky_cols = ['true_rate', 'incident_count', 'risk_score', 'risk_band']
    X_clean = df_clean.drop(columns=[c for c in leaky_cols if c in df_clean.columns])
    y_reg_clean = df_clean['risk_score']
    y_clf_clean = df_clean['risk_band']
    
    _, X_clean_test, _, y_reg_clean_test, _, y_clf_clean_test = train_test_split(
        X_clean, y_reg_clean, y_clf_clean, test_size=0.2, random_state=42
    )
    
    # Evaluate on Clean Test Set
    X_clean_test_trans = pipeline.transform(X_clean_test)
    preds_reg_clean = reg_model.predict(X_clean_test_trans)
    preds_clf_clean = clf_model.predict(X_clean_test_trans)
    
    clean_rmse = np.sqrt(mean_squared_error(y_reg_clean_test, preds_reg_clean))
    clean_r2 = r2_score(y_reg_clean_test, preds_reg_clean)
    clean_acc = accuracy_score(y_clf_clean_test, preds_clf_clean)
    
    print(f"\n--- CLEAN TEST PERFORMANCE (Upper Bound Reference) ---")
    print(f"RMSE: {clean_rmse:.4f} | R2: {clean_r2:.4f} | Accuracy: {clean_acc:.4f}")
    
    # 2. Evaluate on Noisy Test Set (Deployment Reality)
    df_noisy = pd.read_csv("data/ernakulam_noisy.csv")
    for col in ['incident_rate_was_missing', 'accident_risk_was_missing', 'demand_was_missing',
                'poor_lighting_was_missing', 'rain_was_missing', 'subzone_was_missing',
                'is_weekend_mismatch', 'is_night_mismatch', 'is_outlier', 'is_near_duplicate']:
        if col not in df_noisy.columns:
            df_noisy[col] = 0
            
    X_noisy = df_noisy.drop(columns=[c for c in leaky_cols if c in df_noisy.columns])
    
    # Coerce numeric types
    for col in ['latitude', 'longitude', 'incident_rate', 'demand', 'accident_risk', 'hour', 'day_of_week', 'low_footfall', 'poor_lighting', 'is_weekend', 'is_night', 'rain']:
        if col in X_noisy.columns:
            X_noisy[col] = pd.to_numeric(X_noisy[col], errors='coerce')
            
    valid_mask = df_noisy['true_rate'].notna()
    y_reg_noisy = np.clip(scaler.transform(df_noisy.loc[valid_mask, ['true_rate']]).ravel(), 0.0, 1.0)
    y_clf_noisy = pd.Series(y_reg_noisy).apply(get_risk_band)
    
    X_noisy_valid = X_noisy[valid_mask]
    X_noisy_trans = pipeline.transform(X_noisy_valid)
    
    preds_reg_noisy = reg_model.predict(X_noisy_trans)
    preds_clf_noisy = clf_model.predict(X_noisy_trans)
    
    noisy_rmse = np.sqrt(mean_squared_error(y_reg_noisy, preds_reg_noisy))
    noisy_r2 = r2_score(y_reg_noisy, preds_reg_noisy)
    noisy_acc = accuracy_score(y_clf_noisy, preds_clf_noisy)
    
    print(f"\n--- NOISY TEST PERFORMANCE (Production Reality) ---")
    print(f"RMSE: {noisy_rmse:.4f} | R2: {noisy_r2:.4f} | Accuracy: {noisy_acc:.4f}")
    
    # 3. Degradation Gap Analysis
    print(f"\n--- DEGRADATION GAP (Noisy vs Clean) ---")
    print(f"RMSE Increase:  +{noisy_rmse - clean_rmse:.4f}")
    print(f"R2 Drop:        {clean_r2 - noisy_r2:.4f}")
    print(f"Accuracy Drop:  {(clean_acc - noisy_acc)*100:.2f}%")
    
    # 4. Per-Zone Error Breakdown
    print(f"\n--- PER-ZONE PERFORMANCE BREAKDOWN ---")
    eval_zone_df = pd.DataFrame({
        'zone_id': df_noisy.loc[valid_mask, 'zone_id'],
        'actual_score': y_reg_noisy,
        'pred_score': preds_reg_noisy
    })
    eval_zone_df['abs_error'] = np.abs(eval_zone_df['actual_score'] - eval_zone_df['pred_score'])
    zone_summary = eval_zone_df.groupby('zone_id')['abs_error'].agg(['mean', 'count']).rename(columns={'mean': 'Mean Absolute Error', 'count': 'Sample Count'})
    print(zone_summary.to_string())
    
    print("\nStage 6 OK")

if __name__ == "__main__":
    run_evaluation_and_robustness()