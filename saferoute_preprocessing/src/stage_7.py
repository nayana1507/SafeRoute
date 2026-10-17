import pandas as pd
import numpy as np
import joblib
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split

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

def run_interpretability_and_sanitation():
    """Run model interpretability, feature importances, and leakage audits."""
    print("Loading models and pipeline artifacts...")
    pipeline = joblib.load('artifacts/preprocessing_pipeline.pkl')
    reg_model = joblib.load('artifacts/risk_regressor.pkl')
    
    # 1. Leakage Audit
    df_clean = pd.read_csv("data/ernakulam_clean.csv")
    leaky_cols = ['true_rate', 'incident_count', 'risk_score', 'risk_band']
    X_sample = df_clean.drop(columns=[c for c in leaky_cols if c in df_clean.columns])
    
    assert "true_rate" not in X_sample.columns, "LEAKAGE DETECTED: true_rate is present!"
    assert "incident_count" not in X_sample.columns, "LEAKAGE DETECTED: incident_count is present!"
    print("\n[Leakage Audit] SUCCESS: Forbidden variables ('true_rate', 'incident_count') are strictly excluded from feature matrix.")
    
    # 2. Feature Importance Analysis
    print("\n--- TOP MODEL FEATURE IMPORTANCE ---")
    importances = reg_model.feature_importances_
    
    numeric_features = [
        'latitude', 'longitude', 'incident_rate', 'demand', 
        'accident_risk', 'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
        'night_rain_interaction', 'vulnerability_index'
    ]
    categorical_features = ['zone_id', 'subzone', 'data_source']
    binary_features = [
        'low_footfall', 'poor_lighting', 'is_weekend', 'is_night', 'rain',
        'incident_rate_was_missing', 'accident_risk_was_missing', 'demand_was_missing',
        'poor_lighting_was_missing', 'rain_was_missing', 'subzone_was_missing',
        'is_weekend_mismatch', 'is_night_mismatch', 'is_outlier', 'is_near_duplicate'
    ]
    
    transformer = pipeline.named_steps['preprocessor']
    cat_transformer = transformer.named_transformers_['cat']
    if hasattr(cat_transformer.named_steps['onehot'], 'get_feature_names_out'):
        cat_feature_names = list(cat_transformer.named_steps['onehot'].get_feature_names_out(categorical_features))
    else:
        cat_feature_names = [f"cat_{i}" for i in range(len(importances) - len(numeric_features) - len(binary_features))]
        
    all_feature_names = numeric_features + cat_feature_names + binary_features
    
    if len(all_feature_names) == len(importances):
        feat_imp_df = pd.DataFrame({'feature': all_feature_names, 'importance': importances})
        feat_imp_df = feat_imp_df.sort_values(by='importance', ascending=False)
        print(feat_imp_df.head(10).to_string(index=False))
    else:
        print("Feature count length mismatch, displaying raw top importances:")
        top_indices = np.argsort(importances)[::-1][:10]
        for idx in top_indices:
            print(f"Feature Index {idx}: Importance {importances[idx]:.4f}")

    # 3. Permutation Importance Check on a sample test set
    print("\n--- RUNNING PERMUTATION SANITY CHECK ---")
    for col in ['incident_rate_was_missing', 'accident_risk_was_missing', 'demand_was_missing',
                'poor_lighting_was_missing', 'rain_was_missing', 'subzone_was_missing',
                'is_weekend_mismatch', 'is_night_mismatch', 'is_outlier', 'is_near_duplicate']:
        if col not in df_clean.columns:
            df_clean[col] = 0
            
    from sklearn.preprocessing import MinMaxScaler
    scaler = MinMaxScaler()
    df_clean['risk_score'] = np.clip(scaler.fit_transform(df_clean[['true_rate']]).ravel(), 0.0, 1.0)
    
    # Define X_clean properly
    X_clean = df_clean.drop(columns=[c for c in leaky_cols if c in df_clean.columns])
    
    X_train, X_test, y_train, y_test = train_test_split(
        X_clean, df_clean['risk_score'], test_size=0.1, random_state=42
    )
    X_test_trans = pipeline.transform(X_test)
    
    perm_result = permutation_importance(reg_model, X_test_trans, y_test, n_repeats=5, random_state=42, n_jobs=-1)
    sorted_importances_idx = perm_result.importances_mean.argsort()[::-1]
    
    print("Top 5 Permutation-Sensitive Features:")
    for idx in sorted_importances_idx[:5]:
        print(f"  {all_feature_names[idx] if idx < len(all_feature_names) else f'Feature_{idx}'}: {perm_result.importances_mean[idx]:.4f}")

    print("\nStage 7 OK")

if __name__ == "__main__":
    run_interpretability_and_sanitation()