
import sys
import math
import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.base import BaseEstimator, TransformerMixin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("saferoute")

# -------------------------------------------------------------------
# Feature engineering
# Keep this class compatible with the saved preprocessing pipeline.
# -------------------------------------------------------------------

class FeatureEngineer(BaseEstimator, TransformerMixin):
    def __init__(self):
        pass

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = X.copy()

        if "hour" in X.columns:
            X["hour_sin"] = np.sin(
                2 * np.pi * X["hour"] / 24
            )
            X["hour_cos"] = np.cos(
                2 * np.pi * X["hour"] / 24
            )

        if "day_of_week" in X.columns:
            X["dow_sin"] = np.sin(
                2 * np.pi * X["day_of_week"] / 7
            )
            X["dow_cos"] = np.cos(
                2 * np.pi * X["day_of_week"] / 7
            )

        if "is_night" in X.columns and "rain" in X.columns:
            X["night_rain_interaction"] = (
                X["is_night"] * X["rain"]
            )

        if (
            "demand" in X.columns
            and "accident_risk" in X.columns
        ):
            X["vulnerability_index"] = (
                X["demand"] * X["accident_risk"]
            )

        return X


# -------------------------------------------------------------------
# Compatibility for older joblib artifacts.
# Register the class without replacing Python's __main__ module.
# -------------------------------------------------------------------

import __main__

setattr(__main__, "FeatureEngineer", FeatureEngineer)
sys.modules.setdefault("stage_3", sys.modules[__name__])


# -------------------------------------------------------------------
# Load trained artifacts relative to this file.
# This works when starting the app from the project root or elsewhere.
# -------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE_DIR / "artifacts"

# If artifacts/ is in the project root instead of src/artifacts/,
# change ARTIFACT_DIR to BASE_DIR.parent / "artifacts".
if not ARTIFACT_DIR.exists():
    ARTIFACT_DIR = BASE_DIR.parent / "artifacts"

app = FastAPI(
    title="SafeRoute MLOps API",
    version="1.1",
    description="Route risk prediction using trained regression and classification models.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_artifact(filename: str):
    path = ARTIFACT_DIR / filename

    if not path.is_file():
        raise FileNotFoundError(
            f"Model artifact not found: {path}"
        )

    return joblib.load(path)


logger.info("Loading SafeRoute model artifacts from %s", ARTIFACT_DIR)

try:
    pipeline = load_artifact("preprocessing_pipeline.pkl")
    scaler = load_artifact("risk_scaler.pkl")
    reg_model = load_artifact("risk_regressor.pkl")
    clf_model = load_artifact("risk_classifier.pkl")
except Exception:
    logger.exception("Could not load SafeRoute model artifacts.")
    raise


# -------------------------------------------------------------------
# Request and response schemas.
# -------------------------------------------------------------------

class RiskInput(BaseModel):
    zone_id: str
    subzone: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    demand: float
    accident_risk: float
    incident_rate: float
    hour: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    is_weekend: str
    is_night: int = Field(ge=0, le=1)
    rain: int = Field(ge=0, le=1)
    low_footfall: int = Field(ge=0, le=1)
    poor_lighting: int = Field(ge=0, le=1)
    data_source: str


class RiskResponse(BaseModel):
    zone_id: str
    subzone: str
    predicted_risk_score: float
    predicted_risk_band: str
    # None means the classifier cannot supply a probability.
    confidence_score: Optional[float] = None


def get_classifier_confidence(X_processed, predicted_label):
    """
    Return the probability of the class predicted by the classifier.

    This is a model probability, not automatically a calibrated
    measure of real-world correctness.

    Return None if the classifier does not support predict_proba().
    """
    if not callable(getattr(clf_model, "predict_proba", None)):
        return None

    try:
        probabilities = np.asarray(
            clf_model.predict_proba(X_processed),
            dtype=float,
        )

        classes = getattr(clf_model, "classes_", None)

        if (
            probabilities.ndim != 2
            or probabilities.shape[0] != 1
            or classes is None
            or len(classes) != probabilities.shape[1]
        ):
            logger.warning(
                "Classifier probability output has an unexpected shape."
            )
            return None

        matching_indices = [
            index
            for index, label in enumerate(classes)
            if str(label) == str(predicted_label)
        ]

        if not matching_indices:
            logger.warning(
                "Could not match predicted label to classifier classes."
            )
            return None

        confidence = float(
            probabilities[0, matching_indices[0]]
        )

        if (
            not math.isfinite(confidence)
            or confidence < 0
            or confidence > 1
        ):
            logger.warning(
                "Classifier returned an invalid probability."
            )
            return None

        return round(confidence, 4)

    except Exception:
        # A confidence calculation failure should not fabricate
        # confidence or discard an otherwise valid prediction.
        logger.exception(
            "Could not calculate classifier confidence."
        )
        return None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "SafeRoute MLOps API",
        "artifacts_directory": str(ARTIFACT_DIR),
    }


@app.post("/predict", response_model=RiskResponse)
def predict_route_risk(data: RiskInput):
    try:
        # Pydantic v1/v2-compatible input conversion.
        if hasattr(data, "model_dump"):
            row = data.model_dump()
        else:
            row = data.dict()

        df = pd.DataFrame([row])

        # Convert Yes/No weekend values to numeric flags.
        df["is_weekend"] = df["is_weekend"].apply(
            lambda value: (
                1
                if str(value).strip().lower()
                in {"yes", "true", "1"}
                else 0
            )
        )

        # Preserve the indicator features expected by the
        # existing training/preprocessing pipeline.
        missing_indicator_columns = [
            "demand_was_missing",
            "accident_risk_was_missing",
            "incident_rate_was_missing",
            "subzone_was_missing",
            "rain_was_missing",
            "poor_lighting_was_missing",
            "is_outlier",
            "is_near_duplicate",
            "is_weekend_mismatch",
            "is_night_mismatch",
        ]

        for column in missing_indicator_columns:
            df[column] = 0

        # Use the saved preprocessing pipeline.
        X_processed = pipeline.transform(df)

        # Regression model produces the numerical risk score.
        scaled_score = np.asarray(
            reg_model.predict(X_processed),
            dtype=float,
        ).reshape(-1)

        if scaled_score.size != 1:
            raise ValueError(
                "Regression model returned an unexpected number of scores."
            )

        # Convert the regressor's scaled output back to the
        # original risk-score scale.
        raw_score = float(
            scaler.inverse_transform(
                scaled_score.reshape(-1, 1)
            )[0, 0]
        )

        if not math.isfinite(raw_score):
            raise ValueError(
                "Regression model returned a non-finite risk score."
            )

        # Classifier produces the categorical risk band.
        predicted_labels = clf_model.predict(X_processed)

        if len(predicted_labels) != 1:
            raise ValueError(
                "Classifier returned an unexpected number of labels."
            )

        predicted_label = predicted_labels[0]
        risk_band = str(predicted_label)

        # Genuine classifier probability where supported.
        # Never generate a random confidence value.
        confidence = get_classifier_confidence(
            X_processed,
            predicted_label,
        )

        return RiskResponse(
            zone_id=data.zone_id,
            subzone=data.subzone,
            predicted_risk_score=round(raw_score, 4),
            predicted_risk_band=risk_band,
            confidence_score=confidence,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("SafeRoute prediction failed.")
        raise HTTPException(
            status_code=500,
            detail=f"Risk prediction failed: {str(exc)}",
        ) from exc