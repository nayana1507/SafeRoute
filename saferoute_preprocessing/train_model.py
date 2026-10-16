import pandas as pd
import numpy as np
from pathlib import Path
import json
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

def train_and_evaluate_model(csv_path: str = "data/synthetic_training.csv", output_dir: str = "models"):
    print("Loading dataset for advanced model training...")
    df = pd.read_csv(csv_path)
    
    # 1. Feature Engineering: Create interaction features to boost predictive power
    df["night_poor_lighting"] = df["is_night"] * df["poor_lighting"]
    df["rain_accident_risk"] = df["rain"] * df["accident_risk"]
    df["weekend_night"] = df["is_weekend"] * df["is_night"]
    
    # 2. Expanded Feature Set
    feature_cols = [
        "incident_rate", 
        "low_footfall", 
        "poor_lighting", 
        "accident_risk",
        "hour", 
        "day_of_week", 
        "is_weekend", 
        "is_night", 
        "rain",
        "night_poor_lighting",
        "rain_accident_risk",
        "weekend_night"
    ]
    target_col = "incident_count"
    
    X = df[feature_cols]
    y = df[target_col]
    
    # 3. 80:20 Train-Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"Dataset split -> Training samples: {len(X_train)}, Testing samples: {len(X_test)}")
    
    # 4. Train model
    print("Training HistGradientBoostingRegressor (Poisson Loss) on training data...")
    model = HistGradientBoostingRegressor(loss='poisson', max_iter=150, learning_rate=0.08, random_state=42)
    model.fit(X_train, y_train)
    
    # 5. Evaluate on held-out test data
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    variance_explained_pct = r2 * 100
    
    # Calculate Exact Integer Matches
    rounded_preds = np.round(y_pred)
    exact_matches = (y_test.values == rounded_preds).sum()
    total_test_samples = len(y_test)
    match_percentage = (exact_matches / total_test_samples) * 100
    
    print(f"\n--- Optimized Test Evaluation Results ---")
    print(f"Mean Absolute Error (MAE): {mae:.3f}")
    print(f"R² Score: {r2:.3f}")
    print(f"Variance Explained: {variance_explained_pct:.2f}%")
    print(f"Exact Integer Matches: {exact_matches} out of {total_test_samples} ({match_percentage:.2f}%)")
    
    # 6. Retrain final model on 100% data for production deployment artifact
    print("\nRetraining final optimized model on 100% data for deployment...")
    final_model = HistGradientBoostingRegressor(loss='poisson', max_iter=150, learning_rate=0.08, random_state=42)
    final_model.fit(X, y)
    
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    model_file = out_path / "risk_model.joblib"
    joblib.dump(final_model, model_file)
    print(f"Saved optimized model artifact to: {model_file.resolve()}")
    
    metrics = {
        "model_type": "HistGradientBoostingRegressor",
        "features": feature_cols,
        "test_mae": float(mae),
        "test_r2_score": float(r2),
        "test_variance_explained_percentage": float(variance_explained_pct),
        "exact_matches": int(exact_matches),
        "total_test_samples": int(total_test_samples)
    }
    
    metrics_file = out_path / "metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(metrics, f, indent=4)
    print(f"Saved metrics JSON to: {metrics_file.resolve()}")

if __name__ == "__main__":
    train_and_evaluate_model()
