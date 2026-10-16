import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import PoissonRegressor

def inspect_test_set():
    # Load dataset
    df = pd.read_csv("data/synthetic_training.csv")
    
    feature_cols = [
        "incident_rate", "low_footfall", "poor_lighting", "accident_risk",
        "hour", "day_of_week", "is_weekend", "is_night", "rain"
    ]
    target_col = "incident_count"
    
    X = df[feature_cols]
    y = df[target_col]
    
    # Use 80:20 split with random_state=42
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train model on training set
    model = PoissonRegressor(alpha=1.0, max_iter=1000)
    model.fit(X_train, y_train)
    
    # Predict on the 20% test set
    y_pred = model.predict(X_test)
    
    # Ensure both are converted to numpy arrays for strict positional alignment
    actuals = y_test.values
    predictions = y_pred.round(2)
    errors = np.abs(actuals - predictions).round(2)
    
    # Combine into a clean DataFrame for inspection
    comparison_df = pd.DataFrame({
        "Actual Incidents": actuals,
        "Predicted Incidents": predictions,
        "Absolute Error": errors
    })
    
    print("--- Sample Predictions on 20% Test Data (First 15 Rows) ---")
    print(comparison_df.head(15).to_string(index=False))
    
    print("\n--- Summary Statistics on Test Set ---")
    print(f"Total Test Samples: {len(comparison_df)}")
    print(f"Average Actual Incidents: {actuals.mean():.2f}")
    print(f"Average Predicted Incidents: {predictions.mean():.2f}")
    print(f"Mean Absolute Error (MAE): {errors.mean():.3f}")

if __name__ == "__main__":
    inspect_test_set()