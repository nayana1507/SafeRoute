import pandas as pd
from pathlib import Path

def preprocess_saferoute_data(csv_path: str = "synthetic_training.csv"):
    """
    Loads synthetic training data and preprocesses it for SafeRoute ML models.
    """
    file_path = Path(csv_path)
    if not file_path.exists():
        # Check in a data folder if not in root
        alt_path = Path("data") / csv_path
        if alt_path.exists():
            file_path = alt_path
        else:
            raise FileNotFoundError(f"Dataset not found at {file_path.resolve()} or {alt_path.resolve()}.")
    
    # 1. Load the raw dataset
    df = pd.read_csv(file_path)
    print(f"Successfully loaded dataset from {file_path}. Shape: {df.shape}")
    
    # 2. Define exact feature set required for ML training (Excluding metadata, demand, coordinates, and true_rate)
    feature_cols = [
        "incident_rate", 
        "low_footfall", 
        "poor_lighting", 
        "accident_risk",
        "hour", 
        "day_of_week", 
        "is_weekend", 
        "is_night", 
        "rain"
    ]
    
    target_col = "incident_count"
    group_col = "zone_id"  # Used later for Leave-One-Zone-Out cross-validation
    
    # 3. Extract Features (X), Target (y), and Groups
    X = df[feature_cols].copy()
    y = df[target_col].copy()
    groups = df[group_col].copy()
    
    print("\n--- Preprocessing Summary ---")
    print(f"Feature Matrix (X) shape: {X.shape}")
    print(f"Target Vector (y) shape: {y.shape}")
    print(f"Selected Features: {list(X.columns)}")
    print(f"Excluded Columns: true_rate (prevents data leakage), demand (kept for recommendations), spatial coordinates/metadata.")
    
    return X, y, groups

if __name__ == "__main__":
    X, y, groups = preprocess_saferoute_data()