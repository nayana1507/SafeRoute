import os
import sys
import pandas as pd
import numpy as np
import joblib
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, classification_report

# 1. Define FeatureEngineer locally so joblib unpickles preprocessing_pipeline.pkl perfectly
class FeatureEngineer(BaseEstimator, TransformerMixin):
    def __init__(self):
        pass
    
    def fit(self, X, y=None):
        return self
    
    def transform(self, X):
        X = X.copy()
        if 'hour' in X.columns:
            X['hour_sin'] = np.sin(2 * np.pi * X['hour'] / 24)
            X['hour_cos'] = np.cos(2 * np.pi * X['hour'] / 24)
        if 'day_of_week' in X.columns:
            X['dow_sin'] = np.sin(2 * np.pi * X['day_of_week'] / 7)
            X['dow_cos'] = np.cos(2 * np.pi * X['day_of_week'] / 7)
        if 'is_night' in X.columns and 'rain' in X.columns:
            X['night_rain_interaction'] = X['is_night'] * X['rain']
        if 'demand' in X.columns and 'accident_risk' in X.columns:
            X['vulnerability_index'] = X['demand'] * X['accident_risk']
        return X

# Register in main module namespace for joblib
sys.modules['__main__'].FeatureEngineer = FeatureEngineer

def evaluate_on_test_split():
    print("Loading clean dataset and production artifacts...")
    df = pd.read_csv("data/ernakulam_clean.csv")
    
    # Load production artifacts
    pipeline = joblib.load('artifacts/preprocessing_pipeline.pkl')
    scaler = joblib.load('artifacts/risk_scaler.pkl')
    reg_model = joblib.load('artifacts/risk_regressor.pkl')
    clf_model = joblib.load('artifacts/risk_classifier.pkl')
    
    if 'true_rate' not in df.columns:
        print("Error: 'true_rate' column not found in dataset.")
        return
        
    # Recreate ground truth risk bands (tertiles used during training)
    df['ground_truth_band'] = pd.qcut(df['true_rate'], 3, labels=['Low', 'Medium', 'High'])
    
    # Recreate the exact 80:20 train-test split
    _, test_df = train_test_split(df, test_size=0.2, random_state=42)
    print(f"Evaluating on test split: {len(test_df)} rows (20% hold-out set)\n")
    
    # Ensure all missing indicator columns expected by the pipeline exist
    for col in ['demand_was_missing', 'accident_risk_was_missing', 'incident_rate_was_missing', 
                'subzone_was_missing', 'rain_was_missing', 'poor_lighting_was_missing', 
                'is_outlier', 'is_near_duplicate', 'is_weekend_mismatch', 'is_night_mismatch']:
        if col not in test_df.columns:
            test_df[col] = 0
            
    # Transform test features using the saved pipeline
    X_test = pipeline.transform(test_df)
    
    # Regression predictions
    y_pred_scaled = reg_model.predict(X_test)
    y_pred_score = scaler.inverse_transform(y_pred_scaled.reshape(-1, 1)).ravel()
    y_true_score = test_df['true_rate'].values
    
    # Classification predictions
    y_pred_band = clf_model.predict(X_test)
    y_true_band = test_df['ground_truth_band'].values
    
    # Calculate metrics
    rmse = np.sqrt(mean_squared_error(y_true_score, y_pred_score))
    r2 = r2_score(y_true_score, y_pred_score)
    acc = accuracy_score(y_true_band, y_pred_band)
    
    print("==================================================")
    print("       20% TEST SPLIT EVALUATION RESULTS         ")
    print("==================================================")
    print(f"Continuous Score RMSE : {rmse:.4f}")
    print(f"Continuous Score R^2  : {r2:.4f}")
    print(f"Risk Band Accuracy    : {acc * 100:.2f}%")
    print("\nDetailed Classification Report (Low / Medium / High):")
    print(classification_report(y_true_band, y_pred_band))

if __name__ == "__main__":
    evaluate_on_test_split()