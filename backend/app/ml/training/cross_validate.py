from pathlib import Path

import joblib
from sklearn.model_selection import StratifiedKFold, cross_val_score
from xgboost import XGBClassifier

# -----------------------------
# Paths
# -----------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR.parent / "models"

# -----------------------------
# Load Data
# -----------------------------

X_train, X_test, y_train, y_test = joblib.load(
    MODEL_DIR / "preprocessed.pkl"
)

negative = (y_train == 0).sum()
positive = (y_train == 1).sum()

scale_pos_weight = negative / positive

# -----------------------------
# Model
# -----------------------------

model = XGBClassifier(
    n_estimators=200,
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    objective="binary:logistic",
    eval_metric="logloss",
    random_state=42,
    scale_pos_weight=scale_pos_weight,
)

# -----------------------------
# Cross Validation
# -----------------------------

cv = StratifiedKFold(
    n_splits=5,
    shuffle=True,
    random_state=42,
)

scores = cross_val_score(
    model,
    X_train,
    y_train,
    cv=cv,
    scoring="roc_auc",
)

print("\nROC-AUC Scores")
print(scores)

print("\nAverage ROC-AUC")
print(scores.mean())