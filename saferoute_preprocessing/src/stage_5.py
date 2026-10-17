import pandas as pd
import numpy as np
import joblib
from sklearn.base import BaseEstimator, TransformerMixin

# Ensure FeatureEngineer is defined in module scope for unpickling compatibility
class FeatureEngineer(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        return self
    def transform(self, X):
        X = X.copy()
        # Coerce base columns to numeric safely inside transformer if needed
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

def run_production_inference():
    """Load production artifacts and perform inference on noisy dataset sample."""
    print("Loading production artifacts...")
    pipeline = joblib.load('artifacts/preprocessing_pipeline.pkl')
    reg_model = joblib.load('artifacts/risk_regressor.pkl')
    clf_model = joblib.load('artifacts/risk_classifier.pkl')
    
    # Load noisy dataset for testing production inference
    df_noisy = pd.read_csv("data/ernakulam_noisy.csv")
    
    # Ensure all required indicator columns exist
    for col in ['incident_rate_was_missing', 'accident_risk_was_missing', 'demand_was_missing',
                'poor_lighting_was_missing', 'rain_was_missing', 'subzone_was_missing',
                'is_weekend_mismatch', 'is_night_mismatch', 'is_outlier', 'is_near_duplicate']:
        if col not in df_noisy.columns:
            df_noisy[col] = 0

    # Drop target/leaky columns if present
    leaky_cols = ['true_rate', 'incident_count', 'risk_score', 'risk_band']
    X_inference = df_noisy.drop(columns=[c for c in leaky_cols if c in df_noisy.columns])
    
    # Robustly coerce all potential numeric and binary columns to float/int to eliminate empty strings ''
    all_numeric_and_bin = [
        'latitude', 'longitude', 'incident_rate', 'demand', 'accident_risk', 
        'hour', 'day_of_week', 'low_footfall', 'poor_lighting', 'is_weekend', 
        'is_night', 'rain'
    ]
    for col in all_numeric_and_bin:
        if col in X_inference.columns:
            X_inference[col] = pd.to_numeric(X_inference[col], errors='coerce')

    print(f"Running inference on {len(X_inference)} records...")
    
    # Transform through pipeline
    X_trans = pipeline.transform(X_inference)
    
    # Predict continuous risk score and discrete risk band
    predicted_scores = reg_model.predict(X_trans)
    predicted_bands = clf_model.predict(X_trans)
    
    # Attach predictions back to a results dataframe
    results_df = df_noisy[['zone_id', 'subzone', 'hour', 'day_of_week']].copy()
    results_df['predicted_risk_score'] = np.clip(predicted_scores, 0.0, 1.0)
    results_df['predicted_risk_band'] = predicted_bands
    
    # Save inference output
    output_path = 'artifacts/inference_predictions.csv'
    results_df.to_csv(output_path, index=False)
    print(f"Inference complete! Results saved to '{output_path}'.")
    
    # Display sample predictions
    print("\n--- SAMPLE PREDICTIONS ---")
    print(results_df.head(10).to_string(index=False))
    
    print("\nStage 5 OK")

if __name__ == "__main__":
    run_production_inference()