import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from rapidfuzz import process, fuzz

# Canonical subzones reference list for Ernakulam (15 canonical subzones across 5 zones)
CANONICAL_SUBZONES = [
    "Civil Station", "Kaloor Stadium", "High Court", 
    "Changampuzha Park", "Lulu Junction", "Edappally Toll",
    "Mobility Hub Road", "Vyttila Hub", "Kundannoor Junction",
    "Infopark Phase 1", "SmartCity Gate", "Kakkanad InfoPark",
    "Aluva Metro", "Aluva Bypass", "Railway Station Road"
]

CANONICAL_DATA_SOURCES = ["municipal_survey", "traffic_sensor", "mobile_app_report", "police_fir"]

def standardize_subzone(val: str) -> str:
    """Map dirty subzone strings to canonical ones using explicit dict + fuzzy fallback."""
    if pd.isna(val):
        return np.nan
    val_clean = str(val).strip().title()
    
    # Explicit mapping dict for known corruptions
    mapping = {
        "Infopark Phase1": "Infopark Phase 1",
        " Vyttila Hub": "Vyttila Hub",
        "Alwaye Metro": "Aluva Metro",
        "Alwaye Bypass": "Aluva Bypass",
    }
    if val_clean in mapping:
        return mapping[val_clean]
    if val_clean in CANONICAL_SUBZONES:
        return val_clean
    
    # Rapidfuzz fallback for unexpected typos
    match, score, _ = process.extractOne(val_clean, CANONICAL_SUBZONES, scorer=fuzz.ratio)
    if score >= 85:
        return match
    return val_clean  # Keep or return as unmapped if score is too low

def canonicalize_dataset(df_clean: pd.DataFrame, df_noisy: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Clean and canonicalize both datasets, adding quality flags and weight columns."""
    
    # Work on copies
    clean = df_clean.copy()
    noisy = df_noisy.copy()
    
    # 1. Add data_quality and sample_weight
    clean['data_quality'] = 1
    clean['sample_weight'] = 1.0
    
    noisy['data_quality'] = 0
    noisy['sample_weight'] = 0.5
    
    # Combine for uniform processing where needed, or process noisy
    # Here we focus primarily on canonicalizing the noisy dataset to match clean schema standards
    
    # 2. Replace -999 sentinels with NaN in noisy
    sentinel_cols = ['incident_rate', 'accident_risk', 'demand', 'true_rate', 'incident_count']
    for col in sentinel_cols:
        if col in noisy.columns:
            noisy[col] = noisy[col].replace(-999.0, np.nan)
            noisy[col] = noisy[col].replace(-999, np.nan)
            
    # 3. Missing-value indicator columns (*_was_missing)
    track_missing_cols = ['incident_rate', 'accident_risk', 'demand', 'poor_lighting', 'rain', 'true_rate', 'subzone', 'incident_count']
    for col in track_missing_cols:
        if col in noisy.columns:
            noisy[f'{col}_was_missing'] = noisy[col].isna().astype(int)
            
    # 4. Standardize categoricals
    if 'subzone' in noisy.columns:
        noisy['subzone'] = noisy['subzone'].apply(standardize_subzone)
        
    if 'data_source' in noisy.columns:
        noisy['data_source'] = noisy['data_source'].astype(str).str.strip().str.lower()
        source_map = {
            "police_fir": "police_fir", "police fir": "police_fir", "police_fir": "police_fir",
            "mobile-app-report": "mobile_app_report", "mobile_app_report": "mobile_app_report",
            "traffic_sensor": "traffic_sensor", "traffic sensor": "traffic_sensor",
            "municipal_survey": "municipal_survey", "municipal survey": "municipal_survey",
            "unknown": np.nan, "nan": np.nan
        }
        noisy['data_source'] = noisy['data_source'].map(source_map).fillna(np.nan)

    # 5. Type coercions for hour, is_weekend, rain
    if 'hour' in noisy.columns:
        noisy['hour'] = pd.to_numeric(noisy['hour'], errors='coerce').fillna(0).astype(int)
        
    def coerce_bool(val):
        if pd.isna(val):
            return np.nan
        if str(val).strip().lower() in ['yes', 'true', '1', '1.0']:
            return 1
        elif str(val).strip().lower() in ['no', 'false', '0', '0.0']:
            return 0
        return np.nan

    if 'is_weekend' in noisy.columns:
        noisy['is_weekend'] = noisy['is_weekend'].apply(coerce_bool)
    if 'rain' in noisy.columns:
        noisy['rain'] = noisy['rain'].apply(coerce_bool)

    # 6. Logical inconsistencies & fixes
    # day_of_week: assume 0-4 are weekdays, 5-6 are weekends (or standard python weekday mapping)
    noisy['is_weekend_mismatch'] = noisy.apply(
        lambda r: int(r['is_weekend'] != (r['day_of_week'] in {5, 6})) if pd.notna(r['is_weekend']) else 0, axis=1
    )
    noisy['is_weekend_fixed'] = noisy['day_of_week'].apply(lambda d: 1 if d in {5, 6} else 0)

    noisy['is_night_mismatch'] = noisy.apply(
        lambda r: int(r['is_night'] != ((r['hour'] >= 19) | (r['hour'] <= 5))) if pd.notna(r['is_night']) else 0, axis=1
    )
    noisy['is_night_fixed'] = noisy['hour'].apply(lambda h: 1 if (h >= 19 or h <= 5) else 0)

    # 7. Outlier capping via IQR fences (1.5x) without deleting rows, add is_outlier flag
    numeric_features_to_check = ['incident_rate', 'accident_risk', 'demand', 'incident_count']
    noisy['is_outlier'] = 0
    for col in numeric_features_to_check:
        if col in noisy.columns:
            Q1 = noisy[col].quantile(0.25)
            Q3 = noisy[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_fence = Q1 - 1.5 * IQR
            upper_fence = Q3 + 1.5 * IQR
            
            outlier_mask = (noisy[col] < lower_fence) | (noisy[col] > upper_fence)
            noisy.loc[outlier_mask, 'is_outlier'] = 1
            # Cap values
            noisy[col] = noisy[col].clip(lower=lower_fence, upper=upper_fence)

    # 8. Exact duplicate dropping vs near-duplicates flag
    noisy['is_near_duplicate'] = noisy.duplicated(subset=['zone_id', 'subzone', 'day_of_week', 'hour'], keep=False).astype(int)
    initial_len = len(noisy)
    noisy = noisy.drop_duplicates(keep='first')
    print(f"Dropped {initial_len - len(noisy)} exact duplicate rows from noisy dataset.")

    return clean, noisy

if __name__ == "__main__":
    df_clean = pd.read_csv("data/ernakulam_clean.csv")
    df_noisy = pd.read_csv("data/ernakulam_noisy.csv")
    
    clean_canon, noisy_canon = canonicalize_dataset(df_clean, df_noisy)
    
    # --- VERIFICATION BLOCK ---
    assert noisy_canon[['incident_rate', 'accident_risk', 'demand', 'true_rate', 'incident_count']].isin([-999]).sum().sum() == 0, "Sentinel -999 found!"
    
    unmapped_subzones = noisy_canon['subzone'].dropna()[~noisy_canon['subzone'].dropna().isin(CANONICAL_SUBZONES)]
    print(f"Unmapped subzones count: {len(unmapped_subzones)}")
    
    unmapped_sources = noisy_canon['data_source'].dropna()[~noisy_canon['data_source'].dropna().isin(CANONICAL_DATA_SOURCES)]
    print(f"Unmapped data sources count: {len(unmapped_sources)}")
    
    print("\n[Missingness % per column in Noisy]")
    print(noisy_canon.isnull().mean() * 100)
    
    print(f"\nOutlier row ratio: {noisy_canon['is_outlier'].mean() * 100:.2f}%")
    print(f"Weekend mismatch ratio: {noisy_canon['is_weekend_mismatch'].mean() * 100:.2f}%")
    print(f"Night mismatch ratio: {noisy_canon['is_night_mismatch'].mean() * 100:.2f}%")
    
    print("\nStage 1 OK")