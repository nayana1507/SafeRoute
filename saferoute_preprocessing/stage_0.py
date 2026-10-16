import os
from pathlib import Path
import pandas as pd
import numpy as np

def setup_project_structure() -> None:
    """Create standard project folder structure safely."""
    folders = ['data', 'src', 'notebooks', 'artifacts', 'reports']
    for folder in folders:
        p = Path(folder)
        if p.exists() and not p.is_dir():
            p.unlink()  # Removes the file if it's blocking the folder name
        p.mkdir(parents=True, exist_ok=True)
    print("Project folder structure verified/created: data/, src/, notebooks/, artifacts/, reports/")

def load_and_inspect_data(clean_path: str, noisy_path: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load datasets and print basic inspection metrics."""
    df_clean = pd.read_csv(clean_path)
    df_noisy = pd.read_csv(noisy_path)
    
    print("=== CLEAN DATASET ===")
    print(f"Shape: {df_clean.shape}")
    print(f"Memory Usage: {df_clean.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    print("\nDtypes:")
    print(df_clean.dtypes)
    print("\nHead (3 rows):")
    print(df_clean.head(3))
    
    print("\n=== NOISY DATASET ===")
    print(f"Shape: {df_noisy.shape}")
    print(f"Memory Usage: {df_noisy.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    print("\nDtypes:")
    print(df_noisy.dtypes)
    print("\nHead (3 rows):")
    print(df_noisy.head(3))
    
    return df_clean, df_noisy

def run_eda(df_clean: pd.DataFrame, df_noisy: pd.DataFrame) -> None:
    """Run exploratory data analysis on nulls, duplicates, and distributions."""
    print("\n--- EDA REPORT ---")
    
    # 1. Null counts
    print("\n[Null Counts]")
    print("Clean nulls:\n", df_clean.isnull().sum()[df_clean.isnull().sum() > 0])
    print("Noisy nulls:\n", df_noisy.isnull().sum()[df_noisy.isnull().sum() > 0])
    
    # 2. Duplicate counts
    clean_exact_dups = df_clean.duplicated().sum()
    noisy_exact_dups = df_noisy.duplicated().sum()
    print(f"\n[Duplicates] Clean exact duplicates: {clean_exact_dups} | Noisy exact duplicates: {noisy_exact_dups}")
    
    # Near-duplicates in noisy (same primary keys: zone_id, subzone, day_of_week, hour but different feature values)
    key_cols = ['zone_id', 'subzone', 'day_of_week', 'hour']
    noisy_near_dups = df_noisy.duplicated(subset=key_cols, keep=False).sum() - noisy_exact_dups
    print(f"Noisy near-duplicates (same keys, different values): {noisy_near_dups}")
    
    # 3. Categorical value counts
    print("\n[Categorical Distributions - Noisy vs Clean]")
    print("Clean zones:", df_clean['zone_id'].nunique(), "| Noisy zones:", df_noisy['zone_id'].nunique())
    print("Clean subzones:", df_clean['subzone'].nunique(), "| Noisy subzones:", df_noisy['subzone'].nunique())
    print("Noisy data_source counts:\n", df_noisy['data_source'].value_counts(dropna=False))
    
    # 4. Numeric stats summary
    print("\n[Numeric Summary (Clean)]")
    print(df_clean[['incident_rate', 'accident_risk', 'demand', 'true_rate', 'incident_count']].describe())
    
    print("\n[Numeric Summary (Noisy)]")
    print(df_noisy[['incident_rate', 'accident_risk', 'demand', 'true_rate', 'incident_count']].describe())

def check_twin_join(df_clean: pd.DataFrame, df_noisy: pd.DataFrame) -> float:
    """Check match rate when joining noisy rows to clean twins."""
    key_cols = ['zone_id', 'subzone', 'day_of_week', 'hour']
    merged = df_noisy.merge(df_clean[key_cols + ['true_rate']], on=key_cols, how='left', indicator=True)
    match_rate = (merged['_merge'] == 'both').mean() * 100
    print(f"\nTwin Join Match Rate: {match_rate:.2f}% of noisy rows found clean twins.")
    return match_rate

# --- Execution for Stage 0 ---
if __name__ == "__main__":
    setup_project_structure()
    
    clean_file = "data/ernakulam_clean.csv"
    noisy_file = "data/ernakulam_noisy.csv"
    
    if os.path.exists(clean_file) and os.path.exists(noisy_file):
        df_clean, df_noisy = load_and_inspect_data(clean_file, noisy_file)
        run_eda(df_clean, df_noisy)
        check_twin_join(df_clean, df_noisy)
        
        # --- VERIFICATION BLOCK ---
        assert df_clean.isnull().sum().sum() == 0, "Clean set contains nulls!"
        assert df_clean.duplicated().sum() == 0, "Clean set contains exact duplicates!"
        assert df_noisy.isnull().sum().sum() > 0, "Noisy set expected to have nulls!"
        assert df_noisy.duplicated().sum() > 0, "Noisy set expected to have duplicates!"
        assert list(df_clean.columns) == list(df_noisy.columns), "Column order mismatch between clean and noisy sets!"
        
        print("\nStage 0 OK")
        print(f"Clean shape: {df_clean.shape} | Noisy shape: {df_noisy.shape}")
    else:
        print(f"Data files not found in data/. Please place {clean_file} and {noisy_file} in the 'data/' folder.")