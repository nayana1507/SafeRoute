import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
import joblib

class FeatureEngineer(BaseEstimator, TransformerMixin):
    """Custom transformer to add cyclical time features and interaction terms."""
    
    def fit(self, X, y=None):
        return self
        
    def transform(self, X):
        X = X.copy()
        
        # 1. Cyclical encoding for hour (24-hour cycle)
        if 'hour' in X.columns:
            X['hour_sin'] = np.sin(2 * np.pi * X['hour'] / 24.0)
            X['hour_cos'] = np.cos(2 * np.pi * X['hour'] / 24.0)
            
        # 2. Cyclical encoding for day_of_week (7-day cycle)
        if 'day_of_week' in X.columns:
            X['dow_sin'] = np.sin(2 * np.pi * X['day_of_week'] / 7.0)
            X['dow_cos'] = np.cos(2 * np.pi * X['day_of_week'] / 7.0)
            
        # 3. Interaction Features
        # Example: risk amplification during rain and night
        if all(col in X.columns for col in ['is_night', 'rain']):
            X['night_rain_interaction'] = X['is_night'] * X['rain']
            
        # Example: low footfall and poor lighting hazard index
        if all(col in X.columns for col in ['low_footfall', 'poor_lighting']):
            X['vulnerability_index'] = X['low_footfall'] + X['poor_lighting']
            
        return X

def build_preprocessing_pipeline():
    """Constructs the full sklearn preprocessing pipeline."""
    
    # Define feature groups
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

    # Sub-pipelines
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])

    binary_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent'))
    ])

    # Combined Column Transformer
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, [f for f in numeric_features]),
            ('cat', categorical_transformer, [f for f in categorical_features if f]),
            ('bin', binary_transformer, [f for f in binary_features if f])
        ],
        remainder='drop'
    )

    # Full pipeline: Custom Feature Engineering -> ColumnTransformer
    pipeline = Pipeline(steps=[
        ('engineer', FeatureEngineer()),
        ('preprocessor', preprocessor)
    ])

    return pipeline

if __name__ == "__main__":
    # Load sample clean data
    df_clean = pd.read_csv("data/ernakulam_clean.csv")
    
    # Add dummy/missing indicator columns to clean set for pipeline test compatibility
    for col in ['incident_rate_was_missing', 'accident_risk_was_missing', 'demand_was_missing',
                'poor_lighting_was_missing', 'rain_was_missing', 'subzone_was_missing',
                'is_weekend_mismatch', 'is_night_mismatch', 'is_outlier', 'is_near_duplicate']:
        if col not in df_clean.columns:
            df_clean[col] = 0

    pipeline = build_preprocessing_pipeline()
    
    # Fit and transform clean data matrix X
    leaky_cols = ['true_rate', 'incident_count', 'risk_score', 'risk_band']
    X_clean = df_clean.drop(columns=[c for c in leaky_cols if c in df_clean.columns])
    
    X_transformed = pipeline.fit_transform(X_clean)
    
    # Save the pipeline artifact
    joblib.dump(pipeline, 'artifacts/preprocessing_pipeline.pkl')
    
    print(f"Transformed Feature Matrix Shape: {X_transformed.shape}")
    assert X_transformed.shape[0] == len(df_clean), "Row count mismatch after pipeline transformation!"
    
    print("\nStage 3 OK")