from __future__ import annotations

from threading import RLock
from typing import Any

from app.digital_twin.telemetry_history import (
    LiveTelemetryStore,
)

from app.ml.prediction.predictor import (
    PredictiveFailurePredictor,
)

from app.ml.prediction.risk_engine import (
    PredictiveRiskEngine,
)


class PredictiveMaintenanceService:
    """
    Unified predictive-maintenance service.

    The trained ML models operate on live Digital Twin
    telemetry whenever sufficient history is available.

    Important distinction:

    machine.failure_probability
        = Digital Twin condition indicator derived from
          simulated machine health.

    ai_failure_probability
        = actual predictive probability produced by the
          trained ML models.
    """

    _predictor: PredictiveFailurePredictor | None = None

    _lock = RLock()

    MIN_LIVE_OBSERVATIONS = 30

    MODEL_NAME = (
        "CarbonTwin Predictive Failure Model"
    )

    # ==========================================================
    # Predictor
    # ==========================================================

    @classmethod
    def _get_predictor(
        cls,
    ) -> PredictiveFailurePredictor:

        if cls._predictor is not None:
            return cls._predictor

        with cls._lock:

            if cls._predictor is None:

                cls._predictor = (
                    PredictiveFailurePredictor()
                )

        return cls._predictor

    # ==========================================================
    # Unavailable response
    # ==========================================================

    @classmethod
    def _unavailable(
        cls,
        machine,
        reason: str,
    ) -> dict[str, Any]:

        return {
            "available": False,

            "model": cls.MODEL_NAME,

            "machine_id": str(
                machine.id
            ),

            "timestamp": None,

            "machine_type": str(
                machine.type
            ),

            "risk": None,

            "risk_level": "UNKNOWN",

            "risk_score": None,

            "failure_probability": None,

            "ai_failure_probability": None,

            "reason": reason,

            "recommended_action": (
                "Continue Digital Twin monitoring "
                "and collect additional telemetry."
            ),

            "status": (
                "Prediction unavailable"
            ),
        }

    # ==========================================================
    # Analyze
    # ==========================================================

    @classmethod
    def analyze(
        cls,
        machine,
    ) -> dict[str, Any]:

        machine_id = str(
            machine.id
        )

        # ------------------------------------------------------
        # Live telemetry
        # ------------------------------------------------------

        live_dataframe = (
            LiveTelemetryStore.get_all()
        )

        if live_dataframe.empty:

            return cls._unavailable(
                machine,
                (
                    "Live telemetry history is "
                    "not available yet."
                ),
            )

        # ------------------------------------------------------
        # Machine history
        # ------------------------------------------------------

        machine_history = (
            live_dataframe[
                live_dataframe[
                    "Machine_ID"
                ].astype(str)
                == machine_id
            ]
        )

        if machine_history.empty:

            return cls._unavailable(
                machine,
                (
                    "No live telemetry exists "
                    "for this machine."
                ),
            )

        # ------------------------------------------------------
        # Temporal history requirement
        # ------------------------------------------------------

        observation_count = len(
            machine_history
        )

        if (
            observation_count
            < cls.MIN_LIVE_OBSERVATIONS
        ):

            return cls._unavailable(
                machine,
                (
                    "Collecting live telemetry "
                    "history "
                    f"({observation_count}/"
                    f"{cls.MIN_LIVE_OBSERVATIONS} "
                    "observations)."
                ),
            )

        # ------------------------------------------------------
        # ML prediction
        # ------------------------------------------------------

        try:

            predictor = (
                cls._get_predictor()
            )

            prediction = (
                predictor.predict_latest_live(
                    live_dataframe,
                    machine_id,
                )
            )

            assessment = (
                PredictiveRiskEngine
                .assess_prediction(
                    prediction
                )
            )

        except Exception as exc:

            return cls._unavailable(
                machine,
                (
                    "Live predictive analysis "
                    f"failed: {exc}"
                ),
            )

        # ------------------------------------------------------
        # AI probability
        #
        # The dashboard's primary AI probability is the
        # highest probability across the three prediction
        # horizons, matching PredictiveRiskEngine.risk_score.
        # ------------------------------------------------------

        ai_probability = float(
            assessment[
                "risk_score"
            ]
        )

        # ------------------------------------------------------
        # Unified response
        # ------------------------------------------------------

        return {
            "available": True,

            "model": cls.MODEL_NAME,

            "machine_id": prediction[
                "machine_id"
            ],

            "timestamp": prediction[
                "timestamp"
            ],

            "machine_type": prediction[
                "machine_type"
            ],

            # Original three-horizon probabilities
            "risk": prediction[
                "risk"
            ],

            # Risk classification
            "risk_level": assessment[
                "risk_level"
            ],

            # Highest predictive probability
            "risk_score": assessment[
                "risk_score"
            ],

            # Preserve existing API field
            "failure_probability": (
                assessment[
                    "failure_probability"
                ]
            ),

            # Explicitly named AI probability
            "ai_failure_probability": round(
                ai_probability,
                4,
            ),

            # Explainability
            "reason": assessment[
                "reason"
            ],

            "recommended_action": (
                assessment[
                    "recommended_action"
                ]
            ),

            # Useful diagnostic metadata
            "live_observations": (
                observation_count
            ),

            "status": (
                "Live prediction available"
            ),
        }