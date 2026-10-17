import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, MinMaxScaler
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, f1_score, classification_report
import joblib

class FeatureEngineer(BaseEstimator, TransformerMixin):
    """Custom transformer to add cyclical time features and interaction terms."""
    def fit(self, X, y=None):
        return self
        
    def transform(self, X):
        X = X.copy()
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

def build_preprocessing_pipeline():
    """Constructs the full sklearn preprocessing pipeline."""
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

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features),
            ('bin', binary_transformer, binary_features)
        ],
        remainder='drop'
    )

    return Pipeline(steps=[
        ('engineer', FeatureEngineer()),
        ('preprocessor', preprocessor)
    ])

def train_and_evaluate_models():
    """Train regression and classification models using engineered features."""
    df_clean = pd.read_csv("data/ernakulam_clean.csv")
    
    for col in ['incident_rate_was_missing', 'accident_risk_was_missing', 'demand_was_missing',
                'poor_lighting_was_missing', 'rain_was_missing', 'subzone_was_missing',
                'is_weekend_mismatch', 'is_night_mismatch', 'is_outlier', 'is_near_duplicate']:
        if col not in df_clean.columns:
            df_clean[col] = 0

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
    X = df_clean.drop(columns=[c for c in leaky_cols if c in df_clean.columns])
    y_reg = df_clean['risk_score']
    y_clf = df_clean['risk_band']
    
    X_train, X_test, y_reg_train, y_reg_test, y_clf_train, y_clf_test = train_test_split(
        X, y_reg, y_clf, test_size=0.2, random_state=42
    )
    
    # Build and fit pipeline on training data
    pipeline = build_preprocessing_pipeline()
    X_train_trans = pipeline.fit_transform(X_train)
    X_test_trans = pipeline.transform(X_test)
    
    # Save the freshly fitted pipeline artifact
    joblib.dump(pipeline, 'artifacts/preprocessing_pipeline.pkl')
    
    # 3. Train Regression Model
    print("Training Random Forest Regressor...")
    reg_model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    reg_model.fit(X_train_trans, y_reg_train)
    
    y_reg_pred = reg_model.predict(X_test_trans)
    rmse = np.sqrt(mean_squared_error(y_reg_test, y_reg_pred))
    r2 = r2_score(y_reg_test, y_reg_pred)
    
    print(f"--- REGRESSION RESULTS ---")
    print(f"RMSE: {rmse:.4f}")
    print(f"R2 Score: {r2:.4f}")
    
    # 4. Train Classification Model
    print("\nTraining Random Forest Classifier...")
    clf_model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    clf_model.fit(X_train_trans, y_clf_train)
    
    y_clf_pred = clf_model.predict(X_test_trans)
    acc = accuracy_score(y_clf_test, y_clf_pred)
    macro_f1 = f1_score(y_clf_test, y_clf_pred, average='macro')
    
    print(f"\n--- CLASSIFICATION RESULTS ---")
    print(f"Accuracy: {acc:.4f}")
    print(f"Macro F1-Score: {macro_f1:.4f}")
    print("\nClassification Report:\n", classification_report(y_clf_test, y_clf_pred))
    
    # Save trained models
    joblib.dump(reg_model, 'artifacts/risk_regressor.pkl')
    joblib.dump(clf_model, 'artifacts/risk_classifier.pkl')
    
    assert r2 > 0.75, f"Regression R2 score ({r2:.2f}) is below expected threshold!"
    assert acc > 0.70, f"Classification accuracy ({acc:.2f}) is below expected threshold!"
    
    print("\nStage 4 OK")

if __name__ == "__main__":
    train_and_evaluate_models()