import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import joblib

def define_targets_and_guards(clean_df: pd.DataFrame, noisy_df: pd.DataFrame):
    """Define risk_score and risk_band using clean set parameters, and apply leakage guards."""
    
    # 1. Fit MinMaxScaler on CLEAN true_rate -> [0, 1] and clip to ensure strict bounds
    scaler = MinMaxScaler()
    clean_df['risk_score'] = np.clip(scaler.fit_transform(clean_df[['true_rate']]).ravel(), 0.0, 1.0)
    
    # Apply the SAME fitted scaler to noisy true_rate
    noisy_valid_mask = noisy_df['true_rate'].notna()
    noisy_df['risk_score'] = np.nan
    if noisy_valid_mask.sum() > 0:
        # Extract subset as a DataFrame to satisfy sklearn transformer input requirement
        vals = noisy_df.loc[noisy_valid_mask, ['true_rate']]
        transformed_vals = scaler.transform(vals)
        noisy_df.loc[noisy_valid_mask, 'risk_score'] = np.clip(transformed_vals.ravel(), 0.0, 1.0)
        
    # Save the scaler artifact
    joblib.dump(scaler, 'artifacts/risk_scaler.pkl')
    
    # 2. Define risk_band using clean tertiles (33rd and 67th percentiles)
    q33 = clean_df['risk_score'].quantile(0.3333)
    q67 = clean_df['risk_score'].quantile(0.6667)
    
    def get_risk_band(score):
        if pd.isna(score):
            return np.nan
        if score <= q33:
            return 'Low'
        elif score <= q67:
            return 'Medium'
        else:
            return 'High'
            
    clean_df['risk_band'] = clean_df['risk_score'].apply(get_risk_band)
    noisy_df['risk_band'] = noisy_df['risk_score'].apply(get_risk_band)
    
    print(f"Risk Band Cut-points computed from clean data: Low <= {q33:.4f} < Medium <= {q67:.4f} < High")
    
    return clean_df, noisy_df, scaler, (q33, q67)

def build_features_and_leakage_guard(df: pd.DataFrame):
    """Drop leaky columns and audit feature names."""
    # Features to drop due to leakage
    leaky_cols = ['true_rate', 'incident_count', 'risk_score', 'risk_band']
    
    # Feature matrix X excludes targets and raw leakage columns
    X = df.drop(columns=[col for col in leaky_cols if col in df.columns])
    y_reg = df['risk_score'] if 'risk_score' in df.columns else None
    y_clf = df['risk_band'] if 'risk_band' in df.columns else None
    
    # Leakage Audit Function
    suspicious_keywords = ['rate', 'count', 'target', 'true']
    flagged_features = []
    for col in X.columns:
        if any(keyword in col.lower() for keyword in suspicious_keywords):
            flagged_features.append(col)
            
    print(f"\n[Leakage Audit] Features containing suspicious keywords: {flagged_features}")
    
    # Assertions for Leakage Guard
    assert "true_rate" not in X.columns, "LEAKAGE DETECTED: true_rate is in X!"
    assert "incident_count" not in X.columns, "LEAKAGE DETECTED: incident_count is in X!"
    
    return X, y_reg, y_clf

if __name__ == "__main__":
    # Load canonicalized or base data to test
    df_clean = pd.read_csv("data/ernakulam_clean.csv")
    df_noisy = pd.read_csv("data/ernakulam_noisy.csv")
    
    # Run target definition
    df_clean, df_noisy, scaler, cuts = define_targets_and_guards(df_clean, df_noisy)
    
    # Run leakage guard audit on feature matrix
    X_clean, y_clean_reg, y_clean_clf = build_features_and_leakage_guard(df_clean)
    X_noisy, y_noisy_reg, y_noisy_clf = build_features_and_leakage_guard(df_noisy)
    
    # --- VERIFICATION BLOCK ---
    print("\n--- TARGET SUMMARY ---")
    print("Clean Risk Score - Mean:", df_clean['risk_score'].mean(), "| Std:", df_clean['risk_score'].std())
    print("Noisy Risk Score - Mean:", df_noisy['risk_score'].mean(), "| Std:", df_noisy['risk_score'].std())
    
    assert df_clean['risk_score'].between(0, 1).all(), "Clean risk score out of [0,1] range!"
    assert df_noisy['risk_score'].dropna().between(0, 1).all(), "Noisy risk score out of [0,1] range!"
    
    print("\n[Clean Risk Band Distribution]")
    print(df_clean['risk_band'].value_counts(normalize=True) * 100)
    
    print("\nStage 2 OK")
