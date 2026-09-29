from pathlib import Path

import joblib
import shap

# -----------------------------
# Paths
# -----------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR.parent / "models"

# -----------------------------
# Load Model
# -----------------------------

model = joblib.load(
    MODEL_DIR / "failure_model_optimized.pkl"
)

X_train, X_test, y_train, y_test = joblib.load(
    MODEL_DIR / "preprocessed.pkl"
)

# -----------------------------
# SHAP Explainer
# -----------------------------

explainer = shap.TreeExplainer(model)

shap_values = explainer.shap_values(X_test)

# -----------------------------
# Feature Importance
# -----------------------------

importance = abs(shap_values).mean(axis=0)

ranking = sorted(
    zip(X_test.columns, importance),
    key=lambda x: x[1],
    reverse=True,
)

print("\n========== FEATURE IMPORTANCE ==========\n")

for feature, score in ranking:
    print(f"{feature:25} {score:.6f}")