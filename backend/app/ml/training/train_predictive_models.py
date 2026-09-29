from pathlib import Path

import joblib
import numpy as np

from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from xgboost import XGBClassifier

from app.ml.training.dataset import (
    PredictiveDatasetBuilder,
)

from app.ml.calibration.calibrated_model import (
    CalibratedXGBModel,
)


# ============================================================
# Configuration
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATASET_PATH = (
    BASE_DIR.parent
    / "datasets"
    / "factory_timeseries.csv"
)

MODEL_DIR = (
    BASE_DIR.parent
    / "models"
)

MODEL_DIR.mkdir(
    exist_ok=True
)

TARGETS = (
    "failure_next_30m",
    "failure_next_60m",
    "failure_next_120m",
)


# ============================================================
# Metrics
# ============================================================

def evaluate_model(
    model,
    X,
    y,
    threshold=0.5,
):
    probabilities = model.predict_proba(X)[:, 1]

    predictions = (
        probabilities >= threshold
    ).astype(int)

    return {
        "roc_auc": round(
            roc_auc_score(
                y,
                probabilities,
            ),
            4,
        ),

        "pr_auc": round(
            average_precision_score(
                y,
                probabilities,
            ),
            4,
        ),

        "precision": round(
            precision_score(
                y,
                predictions,
                zero_division=0,
            ),
            4,
        ),

        "recall": round(
            recall_score(
                y,
                predictions,
                zero_division=0,
            ),
            4,
        ),

        "f1": round(
            f1_score(
                y,
                predictions,
                zero_division=0,
            ),
            4,
        ),

        "confusion_matrix": (
            confusion_matrix(
                y,
                predictions,
            ).tolist()
        ),

        "positive_samples": int(
            y.sum()
        ),

        "total_samples": int(
            len(y)
        ),
    }


# ============================================================
# Train one target
# ============================================================

def train_target(
    train_df,
    validation_df,
    test_df,
    feature_columns,
    target,
):

    X_train = train_df[
        feature_columns
    ]

    y_train = train_df[
        target
    ].astype(int)

    X_validation = validation_df[
        feature_columns
    ]

    y_validation = validation_df[
        target
    ].astype(int)

    X_test = test_df[
        feature_columns
    ]

    y_test = test_df[
        target
    ].astype(int)

    # --------------------------------------------------------
    # Class imbalance
    # --------------------------------------------------------

    negative = int(
        (y_train == 0).sum()
    )

    positive = int(
        (y_train == 1).sum()
    )

    if positive == 0:
        raise ValueError(
            f"No positive training samples "
            f"for target: {target}"
        )

    if negative == 0:
        raise ValueError(
            f"No negative training samples "
            f"for target: {target}"
        )

    scale_pos_weight = (
        negative / positive
    )

    # --------------------------------------------------------
    # Model
    # --------------------------------------------------------

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        objective="binary:logistic",
        eval_metric="aucpr",
        random_state=42,
        scale_pos_weight=scale_pos_weight,
        n_jobs=-1,
    )

    print()
    print(
        "=========================================="
    )
    print(
        f"Training target: {target}"
    )
    print(
        "=========================================="
    )

    print(
        f"Training samples   : {len(X_train)}"
    )

    print(
        f"Validation samples : {len(X_validation)}"
    )

    print(
        f"Test samples       : {len(X_test)}"
    )

    print(
        f"Positive train     : {positive}"
    )

    print(
        f"Negative train     : {negative}"
    )

    print(
        f"Scale pos weight   : "
        f"{scale_pos_weight:.4f}"
    )

    # --------------------------------------------------------
    # Train XGBoost
    # --------------------------------------------------------

    model.fit(
        X_train,
        y_train,
        eval_set=[
            (
                X_validation,
                y_validation,
            )
        ],
        verbose=False,
    )

    # --------------------------------------------------------
    # Raw validation probabilities
    # --------------------------------------------------------

    raw_validation_probability = (
        model.predict_proba(
            X_validation
        )[:, 1]
    )

    # --------------------------------------------------------
    # Probability calibration
    # --------------------------------------------------------
    #
    # Isotonic regression learns:
    #
    # raw XGBoost probability
    #          ↓
    # calibrated probability
    #
    # The test set is never used to fit
    # the calibrator.
    #
    # --------------------------------------------------------

    validation_positive = int(
        y_validation.sum()
    )

    validation_negative = int(
        (y_validation == 0).sum()
    )

    if (
        validation_positive == 0
        or validation_negative == 0
    ):
        raise ValueError(
            "Validation set must contain "
            "both positive and negative "
            "samples for calibration."
        )

    calibrator = IsotonicRegression(
        y_min=0.0,
        y_max=1.0,
        out_of_bounds="clip",
    )

    calibrator.fit(
        raw_validation_probability,
        y_validation.to_numpy(),
    )

    calibrated_model = (
        CalibratedXGBModel(
            model=model,
            calibrator=calibrator,
        )
    )

    # --------------------------------------------------------
    # Raw validation metrics
    # --------------------------------------------------------

    raw_validation_metrics = evaluate_model(
        model,
        X_validation,
        y_validation,
    )

    # --------------------------------------------------------
    # Calibrated validation metrics
    # --------------------------------------------------------

    calibrated_validation_metrics = (
        evaluate_model(
            calibrated_model,
            X_validation,
            y_validation,
        )
    )

    # --------------------------------------------------------
    # Raw test metrics
    # --------------------------------------------------------

    raw_test_metrics = evaluate_model(
        model,
        X_test,
        y_test,
    )

    # --------------------------------------------------------
    # Calibrated test metrics
    # --------------------------------------------------------

    calibrated_test_metrics = evaluate_model(
        calibrated_model,
        X_test,
        y_test,
    )

    # --------------------------------------------------------
    # Probability diagnostics
    # --------------------------------------------------------

    raw_test_probability = (
        model.predict_proba(
            X_test
        )[:, 1]
    )

    calibrated_test_probability = (
        calibrated_model
        .predict_proba(X_test)[:, 1]
    )

    probability_diagnostics = {
        "raw_test_min": round(
            float(
                np.min(
                    raw_test_probability
                )
            ),
            4,
        ),

        "raw_test_max": round(
            float(
                np.max(
                    raw_test_probability
                )
            ),
            4,
        ),

        "raw_test_mean": round(
            float(
                np.mean(
                    raw_test_probability
                )
            ),
            4,
        ),

        "calibrated_test_min": round(
            float(
                np.min(
                    calibrated_test_probability
                )
            ),
            4,
        ),

        "calibrated_test_max": round(
            float(
                np.max(
                    calibrated_test_probability
                )
            ),
            4,
        ),

        "calibrated_test_mean": round(
            float(
                np.mean(
                    calibrated_test_probability
                )
            ),
            4,
        ),
    }

    # --------------------------------------------------------
    # Save calibrated model
    # --------------------------------------------------------

    model_name = (
        target
        .replace(
            "failure_next_",
            "failure_",
        )
        + ".pkl"
    )

    model_path = (
        MODEL_DIR
        / model_name
    )

    joblib.dump(
        calibrated_model,
        model_path,
    )

    print()
    print(
        "Raw validation:"
    )

    print(
        raw_validation_metrics
    )

    print()
    print(
        "Calibrated validation:"
    )

    print(
        calibrated_validation_metrics
    )

    print()
    print(
        "Raw test:"
    )

    print(
        raw_test_metrics
    )

    print()
    print(
        "Calibrated test:"
    )

    print(
        calibrated_test_metrics
    )

    print()
    print(
        "Probability diagnostics:"
    )

    print(
        probability_diagnostics
    )

    print()
    print(
        f"Saved calibrated model: "
        f"{model_path}"
    )

    return {
        "target": target,

        "model_path": str(
            model_path
        ),

        "calibration": {
            "method": "isotonic_regression",
            "fit_on": "validation_set",
            "test_set_used_for_calibration": False,
        },

        "validation": {
            "raw": raw_validation_metrics,
            "calibrated": (
                calibrated_validation_metrics
            ),
        },

        "test": {
            "raw": raw_test_metrics,
            "calibrated": (
                calibrated_test_metrics
            ),
        },

        "probability_diagnostics": (
            probability_diagnostics
        ),
    }


# ============================================================
# Main
# ============================================================

def main():

    print()
    print(
        "=========================================="
    )
    print(
        "CarbonTwin Predictive Model Training"
    )
    print(
        "=========================================="
    )

    # --------------------------------------------------------
    # Build predictive dataset
    # --------------------------------------------------------

    df = PredictiveDatasetBuilder.build(
        DATASET_PATH
    )

    feature_columns = (
        PredictiveDatasetBuilder
        .feature_columns(df)
    )

    print()
    print(
        f"Dataset rows   : {len(df)}"
    )

    print(
        f"Feature count  : "
        f"{len(feature_columns)}"
    )

    # --------------------------------------------------------
    # Chronological split
    # --------------------------------------------------------

    splits = (
        PredictiveDatasetBuilder
        .split_by_time(df)
    )

    train_df = splits[
        "train"
    ]

    validation_df = splits[
        "validation"
    ]

    test_df = splits[
        "test"
    ]

    print()
    print(
        f"Train rows      : "
        f"{len(train_df)}"
    )

    print(
        f"Validation rows : "
        f"{len(validation_df)}"
    )

    print(
        f"Test rows       : "
        f"{len(test_df)}"
    )

    # --------------------------------------------------------
    # Train all horizons
    # --------------------------------------------------------

    results = {}

    for target in TARGETS:

        results[target] = train_target(
            train_df,
            validation_df,
            test_df,
            feature_columns,
            target,
        )

    # --------------------------------------------------------
    # Save training metadata
    # --------------------------------------------------------

    metadata = {
        "dataset": str(
            DATASET_PATH
        ),

        "feature_count": len(
            feature_columns
        ),

        "features": feature_columns,

        "targets": list(
            TARGETS
        ),

        "model_type": (
            "XGBoost with isotonic "
            "probability calibration"
        ),

        "calibration": {
            "method": (
                "isotonic_regression"
            ),
            "calibration_dataset": (
                "validation"
            ),
            "test_used_for_calibration": False,
        },

        "split": {
            "train_ratio": 0.70,
            "validation_ratio": 0.15,
            "test_ratio": 0.15,
            "method": (
                "chronological per machine"
            ),
        },

        "results": results,
    }

    metadata_path = (
        MODEL_DIR
        / "predictive_training_metadata.pkl"
    )

    joblib.dump(
        metadata,
        metadata_path,
    )

    print()
    print(
        "=========================================="
    )
    print(
        "Training Complete"
    )
    print(
        "=========================================="
    )

    print()

    for target, result in (
        results.items()
    ):

        print(
            target
        )

        print(
            "  Validation ROC-AUC "
            "(raw)        : "
            f"{result['validation']['raw']['roc_auc']}"
        )

        print(
            "  Validation ROC-AUC "
            "(calibrated) : "
            f"{result['validation']['calibrated']['roc_auc']}"
        )

        print(
            "  Validation PR-AUC "
            "(raw)         : "
            f"{result['validation']['raw']['pr_auc']}"
        )

        print(
            "  Validation PR-AUC "
            "(calibrated)  : "
            f"{result['validation']['calibrated']['pr_auc']}"
        )

        print(
            "  Test ROC-AUC "
            "(raw)             : "
            f"{result['test']['raw']['roc_auc']}"
        )

        print(
            "  Test ROC-AUC "
            "(calibrated)      : "
            f"{result['test']['calibrated']['roc_auc']}"
        )

        print(
            "  Test PR-AUC "
            "(raw)              : "
            f"{result['test']['raw']['pr_auc']}"
        )

        print(
            "  Test PR-AUC "
            "(calibrated)       : "
            f"{result['test']['calibrated']['pr_auc']}"
        )

        print()

    print(
        f"Metadata saved: "
        f"{metadata_path}"
    )


if __name__ == "__main__":
    main()