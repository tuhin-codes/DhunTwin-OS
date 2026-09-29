from pathlib import Path

import joblib
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
)


# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR.parent / "models"


# --------------------------------------------------
# Load preprocessed data
# --------------------------------------------------

X_train, X_test, y_train, y_test = joblib.load(
    MODEL_DIR / "preprocessed.pkl"
)


# --------------------------------------------------
# Load the ACTUAL optimized production model
# --------------------------------------------------

model = joblib.load(
    MODEL_DIR / "failure_model_optimized.pkl"
)


# --------------------------------------------------
# Predictions
# --------------------------------------------------

predictions = model.predict(X_test)

probabilities = model.predict_proba(X_test)[:, 1]


# --------------------------------------------------
# Metrics
# --------------------------------------------------

accuracy = accuracy_score(
    y_test,
    predictions,
)

precision = precision_score(
    y_test,
    predictions,
    zero_division=0,
)

recall = recall_score(
    y_test,
    predictions,
    zero_division=0,
)

f1 = f1_score(
    y_test,
    predictions,
    zero_division=0,
)

roc_auc = roc_auc_score(
    y_test,
    probabilities,
)

cm = confusion_matrix(
    y_test,
    predictions,
)


# --------------------------------------------------
# Output
# --------------------------------------------------

print("\n========================================")
print(" CarbonTwin OS - Model Evaluation")
print("========================================")

print(f"\nModel: failure_model_optimized.pkl")

print(f"\nTraining samples : {len(X_train)}")
print(f"Testing samples  : {len(X_test)}")

print("\nFeatures:")
for feature in X_test.columns:
    print(f"  - {feature}")


print("\n----------------------------------------")
print("Performance Metrics")
print("----------------------------------------")

print(f"Accuracy  : {accuracy:.4f}")
print(f"Precision : {precision:.4f}")
print(f"Recall    : {recall:.4f}")
print(f"F1 Score  : {f1:.4f}")
print(f"ROC-AUC   : {roc_auc:.4f}")


print("\n----------------------------------------")
print("Confusion Matrix")
print("----------------------------------------")

print(cm)


print("\n----------------------------------------")
print("Classification Report")
print("----------------------------------------")

print(
    classification_report(
        y_test,
        predictions,
        zero_division=0,
    )
)


print("\n========================================")
print(" Evaluation Complete")
print("========================================")