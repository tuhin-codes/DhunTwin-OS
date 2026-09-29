from pathlib import Path

import joblib
import pandas as pd

# -----------------------------
# Paths
# -----------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR.parent / "models"

# -----------------------------
# Load Model Once
# -----------------------------

model = joblib.load(
    MODEL_DIR / "failure_model_optimized.pkl"
)

encoder = joblib.load(
    MODEL_DIR / "type_encoder.pkl"
)

FEATURES = [
    "Type",
    "air_temperature",
    "process_temperature",
    "rotational_speed",
    "torque",
    "tool_wear",
]


class FailurePredictor:

    @staticmethod
    def predict(machine):

        machine_type = encoder.transform([machine["Type"]])[0]

        data = pd.DataFrame(
            [[
                machine_type,
                machine["air_temperature"],
                machine["process_temperature"],
                machine["rotational_speed"],
                machine["torque"],
                machine["tool_wear"],
            ]],
            columns=FEATURES,
        )

        probability = float(
            model.predict_proba(data)[0][1]
        )

        prediction = int(
            model.predict(data)[0]
        )

        return {
            "failure": bool(prediction),
            "failure_probability": round(probability * 100, 2),
            "confidence": round(
                max(probability, 1 - probability) * 100,
                2,
            ),
        }