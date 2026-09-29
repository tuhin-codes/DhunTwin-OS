from pathlib import Path

import joblib
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from xgboost import XGBClassifier

# -----------------------------
# Paths
# -----------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR.parent / "models"

# -----------------------------
# Load preprocessed data
# -----------------------------

X_train, X_test, y_train, y_test = joblib.load(
    MODEL_DIR / "preprocessed.pkl"
)

# -----------------------------
# Handle class imbalance
# -----------------------------

negative = (y_train == 0).sum()
positive = (y_train == 1).sum()

scale_pos_weight = negative / positive

# -----------------------------
# Train model
# -----------------------------

model = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    objective="binary:logistic",
    eval_metric="logloss",
    random_state=42,
    scale_pos_weight=scale_pos_weight,
)
print(X_train.columns.tolist())
model.fit(X_train, y_train)

# -----------------------------
# Predictions
# -----------------------------

predictions = model.predict(X_test)
probabilities = model.predict_proba(X_test)[:, 1]

# -----------------------------
# Evaluation
# -----------------------------

print("\nAccuracy")
print(accuracy_score(y_test, predictions))

print("\nROC-AUC")
print(roc_auc_score(y_test, probabilities))

print("\nClassification Report")
print(classification_report(y_test, predictions))

print("\nConfusion Matrix")
print(confusion_matrix(y_test, predictions))

# -----------------------------
# Save model
# -----------------------------

joblib.dump(
    model,
    MODEL_DIR / "failure_model.pkl"
)

print("\n✅ Model Saved Successfully")