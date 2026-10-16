import joblib
import pandas as pd
from pathlib import Path

def run_sample_predictions():
    model_path = Path("models/risk_model.joblib")
    if not model_path.exists():
        raise FileNotFoundError("Model artifact not found. Please run train_model.py first.")
    
    # Load the saved model artifact
    model = joblib.load(model_path)
    
    # Define sample feature scenarios for delivery zones in Ernakulam
    # Features: [incident_rate, low_footfall, poor_lighting, accident_risk, hour, day_of_week, is_weekend, is_night, rain]
    samples = pd.DataFrame([
        {
            "description": "High Risk: Midnight delivery in heavy rain with poor lighting",
            "features": [0.85, 1, 1, 0.8, 2, 5, 1, 1, 1]
        },
        {
            "description": "Low Risk: Daytime afternoon delivery with good conditions",
            "features": [0.10, 0, 0, 0.2, 14, 2, 0, 0, 0]
        },
        {
            "description": "Moderate Risk: Evening rush hour on a weekend",
            "features": [0.45, 0, 1, 0.5, 20, 6, 1, 1, 0]
        }
    ])
    
    print("--- SafeRoute ML Risk Predictions ---")
    for idx, row in samples.iterrows():
        # Predict expected incident count using the loaded joblib artifact
        pred_count = model.predict([row["features"]])[0]
        print(f"\nScenario: {row['description']}")
        print(f"Predicted Incident Risk Score (Count): {pred_count:.3f}")

if __name__ == "__main__":
    run_sample_predictions()