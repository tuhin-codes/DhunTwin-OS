from pathlib import Path

import joblib
import pandas as pd

from app.ml.telemetry.features import (
    TemporalFeatureEngine,
)


class PredictiveFailurePredictor:

    TELEMETRY_COLUMNS = [
        "Temperature",
        "Pressure",
        "Vibration",
        "Power",
    ]

    TARGETS = {
        "30m": "failure_next_30m",
        "60m": "failure_next_60m",
        "120m": "failure_next_120m",
    }

    def __init__(self, model_dir=None):

        base_dir = (
            Path(__file__).resolve().parent.parent
        )

        self.model_dir = (
            Path(model_dir)
            if model_dir
            else base_dir / "models"
        )

        self.models = {}
        self.metadata = None

        self._load_models()

    # ============================================================
    # LOAD TRAINED MODELS
    # ============================================================

    def _load_models(self):

        metadata_path = (
            self.model_dir
            / "predictive_training_metadata.pkl"
        )

        if not metadata_path.exists():
            raise FileNotFoundError(
                f"Training metadata not found: "
                f"{metadata_path}"
            )

        self.metadata = joblib.load(
            metadata_path
        )

        for horizon, target in self.TARGETS.items():

            model_name = (
                target.replace(
                    "failure_next_",
                    "failure_",
                )
                + ".pkl"
            )

            model_path = (
                self.model_dir
                / model_name
            )

            if not model_path.exists():
                raise FileNotFoundError(
                    f"Model not found: "
                    f"{model_path}"
                )

            self.models[horizon] = (
                joblib.load(model_path)
            )

    # ============================================================
    # MODEL INFORMATION
    # ============================================================

    def summary(self):

        return {
            "model_dir": str(
                self.model_dir
            ),

            "models": list(
                self.models.keys()
            ),

            "feature_count": len(
                self.metadata["features"]
            ),

            "features": self.metadata[
                "features"
            ],

            "targets": self.metadata[
                "targets"
            ],
        }

    # ============================================================
    # HORIZON PROBABILITY CONSISTENCY
    # ============================================================

    @staticmethod
    def _enforce_horizon_consistency(
        probability_30m: float,
        probability_60m: float,
        probability_120m: float,
    ) -> tuple[float, float, float]:
        """
        Normalize three independently trained predictive
        probabilities into cumulative horizon probabilities.

        Required relationship:

            0 <= P30 <= P60 <= P120 <= 1

        Important:
        The original implementation used:

            p60 = max(p60, p30)
            p120 = max(p120, p60)

        This could flatten all three horizons to the same
        probability when the 30m model produced the largest
        value.

        This implementation uses a minimal monotonic
        adjustment instead. Raw values are preserved whenever
        they already satisfy the cumulative relationship.
        """

        p30 = max(
            0.0,
            min(
                1.0,
                float(probability_30m),
            ),
        )

        p60 = max(
            0.0,
            min(
                1.0,
                float(probability_60m),
            ),
        )

        p120 = max(
            0.0,
            min(
                1.0,
                float(probability_120m),
            ),
        )

        # --------------------------------------------------------
        # Already valid:
        #
        # 30m <= 60m <= 120m
        #
        # Preserve the actual model outputs.
        # --------------------------------------------------------

        if (
            p30 <= p60
            and p60 <= p120
        ):
            return (
                p30,
                p60,
                p120,
            )

        # --------------------------------------------------------
        # 30m > 60m
        #
        # We cannot allow a shorter cumulative horizon to be
        # greater than a longer one.
        #
        # Instead of immediately flattening all horizons,
        # adjust the violating 60m value first.
        # --------------------------------------------------------

        if p60 < p30:
            p60 = p30

        # --------------------------------------------------------
        # 120m must be >= 60m.
        # --------------------------------------------------------

        if p120 < p60:
            p120 = p60

        return (
            p30,
            p60,
            p120,
        )

    # ============================================================
    # BUILD NORMALIZED RISK OUTPUT
    # ============================================================

    def _build_risk_output(
        self,
        probability_30m: float,
        probability_60m: float,
        probability_120m: float,
    ) -> dict:
        """
        Convert model probabilities into the normalized
        predictive risk structure used by CarbonTwin.
        """

        (
            p30,
            p60,
            p120,
        ) = self._enforce_horizon_consistency(
            probability_30m,
            probability_60m,
            probability_120m,
        )

        return {
            "30m": round(
                p30,
                4,
            ),

            "60m": round(
                p60,
                4,
            ),

            "120m": round(
                p120,
                4,
            ),
        }

    # ============================================================
    # BUILD FEATURES FROM CSV
    # ============================================================

    def build_features(
        self,
        dataset_path,
    ):

        features = TemporalFeatureEngine.build(
            dataset_path,
            machine_id_column="Machine_ID",
            timestamp_column="Timestamp",
            telemetry_columns=(
                self.TELEMETRY_COLUMNS
            ),
        )

        expected_features = (
            self.metadata["features"]
        )

        missing = [
            column
            for column in expected_features
            if column not in features.columns
        ]

        if missing:
            raise ValueError(
                f"Missing model features: "
                f"{missing}"
            )

        return features[
            [
                "Machine_ID",
                "Timestamp",
                "Machine_Type",
            ]
            + expected_features
        ].copy()

    # ============================================================
    # BUILD FEATURES FROM LIVE DATAFRAME
    # ============================================================

    def build_live_features(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Build exactly the same temporal features used by
        the trained predictive models, but from live
        Digital Twin telemetry already held in memory.
        """

        if dataframe.empty:
            raise ValueError(
                "Live telemetry dataframe is empty."
            )

        features = (
            TemporalFeatureEngine
            .build_from_dataframe(
                df=dataframe,
                machine_id_column="Machine_ID",
                timestamp_column="Timestamp",
                telemetry_columns=(
                    self.TELEMETRY_COLUMNS
                ),
            )
        )

        expected_features = (
            self.metadata["features"]
        )

        missing = [
            column
            for column in expected_features
            if column not in features.columns
        ]

        if missing:
            raise ValueError(
                f"Missing model features: "
                f"{missing}"
            )

        return features[
            [
                "Machine_ID",
                "Timestamp",
                "Machine_Type",
            ]
            + expected_features
        ].copy()

    # ============================================================
    # PREDICT COMPLETE DATASET
    # ============================================================

    def predict_dataset(
        self,
        dataset_path,
    ):

        features = self.build_features(
            dataset_path
        )

        expected_features = (
            self.metadata["features"]
        )

        X = features[
            expected_features
        ]

        result = features[
            [
                "Machine_ID",
                "Timestamp",
                "Machine_Type",
            ]
        ].copy()

        # --------------------------------------------------------
        # Generate raw model probabilities.
        # --------------------------------------------------------

        raw_probabilities = {}

        for horizon, model in (
            self.models.items()
        ):

            probabilities = (
                model.predict_proba(X)[:, 1]
            )

            raw_probabilities[horizon] = (
                probabilities
            )

        # --------------------------------------------------------
        # Enforce cumulative horizon consistency.
        # --------------------------------------------------------

        (
            probability_30m,
            probability_60m,
            probability_120m,
        ) = self._enforce_probability_columns(
            raw_probabilities["30m"],
            raw_probabilities["60m"],
            raw_probabilities["120m"],
        )

        result[
            "failure_next_30m_probability"
        ] = probability_30m

        result[
            "failure_next_60m_probability"
        ] = probability_60m

        result[
            "failure_next_120m_probability"
        ] = probability_120m

        return result

    # ============================================================
    # ENFORCE PROBABILITY CONSISTENCY FOR DATAFRAME ARRAYS
    # ============================================================

    @staticmethod
    def _enforce_probability_columns(
        probability_30m,
        probability_60m,
        probability_120m,
    ):
        """
        Vectorized cumulative horizon normalization.

        Ensures:

            0 <= 30m <= 60m <= 120m <= 1

        while preserving valid raw model outputs.
        """

        p30 = pd.Series(
            probability_30m
        ).astype(float).clip(
            lower=0.0,
            upper=1.0,
        )

        p60 = pd.Series(
            probability_60m
        ).astype(float).clip(
            lower=0.0,
            upper=1.0,
        )

        p120 = pd.Series(
            probability_120m
        ).astype(float).clip(
            lower=0.0,
            upper=1.0,
        )

        # --------------------------------------------------------
        # Preserve valid values.
        #
        # Only modify rows where the cumulative relationship
        # is violated.
        # --------------------------------------------------------

        invalid_60 = (
            p60 < p30
        )

        p60 = p60.where(
            ~invalid_60,
            p30,
        )

        invalid_120 = (
            p120 < p60
        )

        p120 = p120.where(
            ~invalid_120,
            p60,
        )

        return (
            p30.to_numpy(),
            p60.to_numpy(),
            p120.to_numpy(),
        )

    # ============================================================
    # PREDICT LIVE DATASET
    # ============================================================

    def predict_live(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Run the existing trained predictive models against
        live Digital Twin telemetry.

        The models are NOT retrained.

        The training metadata and exact expected feature
        schema are reused.

        The resulting horizon probabilities satisfy:

            30m <= 60m <= 120m
        """

        features = (
            self.build_live_features(
                dataframe
            )
        )

        expected_features = (
            self.metadata["features"]
        )

        X = features[
            expected_features
        ]

        result = features[
            [
                "Machine_ID",
                "Timestamp",
                "Machine_Type",
            ]
        ].copy()

        # --------------------------------------------------------
        # Generate raw model probabilities.
        # --------------------------------------------------------

        raw_probabilities = {}

        for horizon, model in (
            self.models.items()
        ):

            probabilities = (
                model.predict_proba(X)[:, 1]
            )

            raw_probabilities[horizon] = (
                probabilities
            )

        # --------------------------------------------------------
        # Enforce cumulative horizon consistency.
        # --------------------------------------------------------

        (
            probability_30m,
            probability_60m,
            probability_120m,
        ) = self._enforce_probability_columns(
            raw_probabilities["30m"],
            raw_probabilities["60m"],
            raw_probabilities["120m"],
        )

        result[
            "failure_next_30m_probability"
        ] = probability_30m

        result[
            "failure_next_60m_probability"
        ] = probability_60m

        result[
            "failure_next_120m_probability"
        ] = probability_120m

        return result

    # ============================================================
    # PREDICT LIVE LATEST MACHINE STATE
    # ============================================================

    def predict_latest_live(
        self,
        dataframe: pd.DataFrame,
        machine_id: str,
    ) -> dict:
        """
        Predict the latest live state of one machine.

        The dataframe should contain recent telemetry history
        for one or more machines.
        """

        predictions = self.predict_live(
            dataframe
        )

        machine_data = predictions[
            predictions["Machine_ID"].astype(str)
            == str(machine_id)
        ]

        if machine_data.empty:
            raise ValueError(
                f"Unknown machine: {machine_id}"
            )

        latest = (
            machine_data
            .sort_values("Timestamp")
            .iloc[-1]
        )

        risk = self._build_risk_output(
            probability_30m=float(
                latest[
                    "failure_next_30m_probability"
                ]
            ),

            probability_60m=float(
                latest[
                    "failure_next_60m_probability"
                ]
            ),

            probability_120m=float(
                latest[
                    "failure_next_120m_probability"
                ]
            ),
        )

        return {
            "machine_id": str(
                machine_id
            ),

            "timestamp": str(
                latest["Timestamp"]
            ),

            "machine_type": str(
                latest["Machine_Type"]
            ),

            "risk": risk,
        }

    # ============================================================
    # PREDICT LATEST MACHINE STATE FROM CSV
    # ============================================================

    def predict_latest(
        self,
        dataset_path,
        machine_id,
    ):

        predictions = self.predict_dataset(
            dataset_path
        )

        machine_data = predictions[
            predictions["Machine_ID"]
            == machine_id
        ]

        if machine_data.empty:
            raise ValueError(
                f"Unknown machine: {machine_id}"
            )

        latest = (
            machine_data
            .sort_values("Timestamp")
            .iloc[-1]
        )

        risk = self._build_risk_output(
            probability_30m=float(
                latest[
                    "failure_next_30m_probability"
                ]
            ),

            probability_60m=float(
                latest[
                    "failure_next_60m_probability"
                ]
            ),

            probability_120m=float(
                latest[
                    "failure_next_120m_probability"
                ]
            ),
        )

        return {
            "machine_id": machine_id,

            "timestamp": str(
                latest["Timestamp"]
            ),

            "machine_type": latest[
                "Machine_Type"
            ],

            "risk": risk,
        }