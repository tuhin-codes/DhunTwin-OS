from pathlib import Path

import joblib
from scipy.stats import randint, uniform
from sklearn.model_selection import RandomizedSearchCV
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
# Base Model
# -----------------------------

model = XGBClassifier(
    objective="binary:logistic",
    eval_metric="logloss",
    random_state=42,
    scale_pos_weight=scale_pos_weight,
)

# -----------------------------
# Search Space
# -----------------------------

param_grid = {
    "n_estimators": randint(100, 500),
    "max_depth": randint(3, 10),
    "learning_rate": uniform(0.01, 0.2),
    "subsample": uniform(0.6, 0.4),
    "colsample_bytree": uniform(0.6, 0.4),
    "min_child_weight": randint(1, 10),
    "gamma": uniform(0, 0.5),
}

# -----------------------------
# Random Search
# -----------------------------

search = RandomizedSearchCV(
    estimator=model,
    param_distributions=param_grid,
    n_iter=20,
    scoring="roc_auc",
    cv=5,
    random_state=42,
    n_jobs=-1,
    verbose=2,
)

search.fit(X_train, y_train)

print("\n==========================")
print("Best ROC-AUC")
print(search.best_score_)

print("\nBest Parameters")
print(search.best_params_)

joblib.dump(
    search.best_estimator_,
    MODEL_DIR / "failure_model_optimized.pkl",
)

print("\n✅ Optimized Model Saved")