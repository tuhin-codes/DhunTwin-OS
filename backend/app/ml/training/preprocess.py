from pathlib import Path

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# -------------------------------------------------
# Project Paths
# -------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

DATASET_PATH = BASE_DIR.parent / "datasets" / "ai4i2020.csv"
MODEL_DIR = BASE_DIR.parent / "models"

MODEL_DIR.mkdir(exist_ok=True)

# -------------------------------------------------
# Load Dataset
# -------------------------------------------------

df = pd.read_csv(DATASET_PATH)

# -------------------------------------------------
# Rename Columns (XGBoost Friendly)
# -------------------------------------------------

df = df.rename(
    columns={
        "Air temperature [K]": "air_temperature",
        "Process temperature [K]": "process_temperature",
        "Rotational speed [rpm]": "rotational_speed",
        "Torque [Nm]": "torque",
        "Tool wear [min]": "tool_wear",
        "Machine failure": "machine_failure",
    }
)

# -------------------------------------------------
# Remove unnecessary columns
# -------------------------------------------------

df = df.drop(columns=["UDI", "Product ID"])

# -------------------------------------------------
# Encode Machine Type
# -------------------------------------------------

encoder = LabelEncoder()

df["Type"] = encoder.fit_transform(df["Type"])

joblib.dump(
    encoder,
    MODEL_DIR / "type_encoder.pkl",
)

# -------------------------------------------------
# Features
# -------------------------------------------------

FEATURES = [
    "Type",
    "air_temperature",
    "process_temperature",
    "rotational_speed",
    "torque",
    "tool_wear",
]

# -------------------------------------------------
# Target
# -------------------------------------------------

TARGET = "machine_failure"

X = df[FEATURES]
y = df[TARGET]

# -------------------------------------------------
# Train Test Split
# -------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
)

# -------------------------------------------------
# Save Preprocessed Data
# -------------------------------------------------

joblib.dump(
    (X_train, X_test, y_train, y_test),
    MODEL_DIR / "preprocessed.pkl",
)

print("✅ Dataset Preprocessed Successfully")
print()

print("Columns Used:")
print(X.columns.tolist())

print()

print(f"Training Samples : {len(X_train)}")
print(f"Testing Samples  : {len(X_test)}")

print()

print("Failure Distribution")
print(y.value_counts())