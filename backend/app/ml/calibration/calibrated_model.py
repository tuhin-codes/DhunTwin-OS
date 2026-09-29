import numpy as np


class CalibratedXGBModel:
    """
    Wrapper around XGBoost that calibrates the raw
    probability output using an independent validation set.

    The underlying XGBoost model performs classification.
    Isotonic regression converts its raw probability into
    a calibrated probability estimate.

    The wrapper exposes predict_proba() so the existing
    predictive inference pipeline can use the model directly.
    """

    def __init__(
        self,
        model,
        calibrator,
    ):
        self.model = model
        self.calibrator = calibrator

    def predict_proba(self, X):

        raw_probability = (
            self.model
            .predict_proba(X)[:, 1]
        )

        calibrated_probability = (
            self.calibrator
            .predict(raw_probability)
        )

        calibrated_probability = np.clip(
            calibrated_probability,
            0.0,
            1.0,
        )

        return np.column_stack(
            [
                1.0 - calibrated_probability,
                calibrated_probability,
            ]
        )

    def predict(self, X):

        probabilities = (
            self.predict_proba(X)[:, 1]
        )

        return (
            probabilities >= 0.5
        ).astype(int)