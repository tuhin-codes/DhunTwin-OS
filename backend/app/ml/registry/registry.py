from app.ml.registry.model_registry import (
    ModelMetadata,
    ModelRegistry,
)


AI4I_FEATURES = (
    "Type",
    "air_temperature",
    "process_temperature",
    "rotational_speed",
    "torque",
    "tool_wear",
)


AI4I_FAILURE_MODEL = ModelMetadata(
    model_id="ai4i-xgb-failure-v1",
    model_name="AI4I Machine Failure Predictor",
    model_version="1.0.0",
    machine_type="AI4I",
    dataset="AI4I 2020 Predictive Maintenance Dataset",
    model_framework="XGBoost",
    model_path="app/ml/models/failure_model_optimized.pkl",
    features=AI4I_FEATURES,

    # Actual measured evaluation results
    roc_auc=0.9718,
    precision=0.5545,
    recall=0.8235,
    f1_score=0.6627,

    status="validated",
)


def initialize_model_registry():

    ModelRegistry.clear()

    ModelRegistry.register(
        AI4I_FAILURE_MODEL
    )
    