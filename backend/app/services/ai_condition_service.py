from __future__ import annotations

from pathlib import Path

from app.digital_twin.telemetry_history import (
    LiveTelemetryStore,
)

from app.ml.anomaly.baseline import (
    LearnedBaseline,
)

from app.ml.anomaly.degradation import (
    DegradationEngine,
)

from app.ml.prediction.predictor import (
    PredictiveFailurePredictor,
)

from app.ml.prediction.risk_engine import (
    PredictiveRiskEngine,
)

from app.ml.rul.rul_engine import (
    RULEngine,
)


class AIConditionService:

    DATASET_PATH = (
        Path(__file__).resolve().parent.parent
        / "ml"
        / "datasets"
        / "factory_timeseries.csv"
    )

    TELEMETRY_COLUMNS = [
        "Temperature",
        "Pressure",
        "Vibration",
        "Power",
    ]

    _baseline = None
    _degradation = None
    _predictor = None

    # ==========================================================
    # INITIALIZE AI COMPONENTS
    # ==========================================================

    @classmethod
    def initialize(cls):

        if (
            cls._baseline is not None
            and cls._degradation is not None
            and cls._predictor is not None
        ):
            return

        from app.ml.telemetry.features import (
            TemporalFeatureEngine,
        )

        # ------------------------------------------------------
        # Learn baseline from the actual training dataset.
        # ------------------------------------------------------

        baseline = LearnedBaseline()

        baseline_features = (
            TemporalFeatureEngine.build(
                cls.DATASET_PATH,
                machine_id_column="Machine_ID",
                timestamp_column="Timestamp",
                telemetry_columns=(
                    cls.TELEMETRY_COLUMNS
                ),
            )
        )

        baseline.fit(
            baseline_features,
            machine_type_column="Machine_Type",
            machine_id_column="Machine_ID",
            telemetry_columns=(
                cls.TELEMETRY_COLUMNS
            ),
        )

        cls._baseline = baseline

        # ------------------------------------------------------
        # Live degradation engine
        # ------------------------------------------------------

        cls._degradation = (
            DegradationEngine(
                cls._baseline
            )
        )

        # ------------------------------------------------------
        # Predictive ML model
        # ------------------------------------------------------

        cls._predictor = (
            PredictiveFailurePredictor()
        )

    # ==========================================================
    # AI HEALTH SCORE
    # ==========================================================

    @staticmethod
    def _calculate_ai_health_score(
        degradation: dict,
        predictive_risk_score: float | None = None,
    ) -> float | None:
        """
        Calculate an evidence-based AI health score.

        This score is intentionally separate from
        machine.health_score.

        machine.health_score:
            Digital Twin simulated operational health.

        ai_health_score:
            AI-derived health based on learned baseline
            deviation, degradation severity, and predictive
            failure risk.

        Score:
            0   = very poor condition
            100 = healthy condition
        """

        condition = str(
            degradation.get(
                "condition",
                "INSUFFICIENT_EVIDENCE",
            )
        ).upper()

        baseline_available = bool(
            degradation.get(
                "baseline_available",
                False,
            )
        )

        if not baseline_available:
            return None

        # ------------------------------------------------------
        # Current deviation
        # ------------------------------------------------------

        current_deviation_value = (
            degradation.get(
                "current_deviation"
            )
        )

        if current_deviation_value is None:
            return None

        try:
            current_deviation = max(
                0.0,
                float(
                    current_deviation_value
                ),
            )
        except (
            TypeError,
            ValueError,
        ):
            return None

        # ------------------------------------------------------
        # Maximum signal deviation
        # ------------------------------------------------------

        maximum_deviation_value = (
            degradation.get(
                "maximum_deviation"
            )
        )

        if maximum_deviation_value is None:

            maximum_deviation = (
                current_deviation
            )

        else:

            try:
                maximum_deviation = max(
                    0.0,
                    float(
                        maximum_deviation_value
                    ),
                )
            except (
                TypeError,
                ValueError,
            ):
                maximum_deviation = (
                    current_deviation
                )

        # ------------------------------------------------------
        # Signal severity
        # ------------------------------------------------------

        attention_count = max(
            0,
            int(
                degradation.get(
                    "attention_signal_count",
                    0,
                )
                or 0
            ),
        )

        degraded_count = max(
            0,
            int(
                degradation.get(
                    "degraded_signal_count",
                    0,
                )
                or 0
            ),
        )

        critical_count = max(
            0,
            int(
                degradation.get(
                    "critical_signal_count",
                    0,
                )
                or 0
            ),
        )

        total_signal_count = max(
            1,
            int(
                degradation.get(
                    "total_signal_count",
                    len(
                        AIConditionService
                        .TELEMETRY_COLUMNS
                    ),
                )
                or len(
                    AIConditionService
                    .TELEMETRY_COLUMNS
                )
            ),
        )

        # ------------------------------------------------------
        # Deviation penalties
        # ------------------------------------------------------

        deviation_penalty = (
            min(
                current_deviation / 5.0,
                1.0,
            )
            * 55.0
        )

        maximum_penalty = (
            min(
                maximum_deviation / 8.0,
                1.0,
            )
            * 20.0
        )

        # ------------------------------------------------------
        # Signal severity penalty
        # ------------------------------------------------------

        attention_ratio = (
            attention_count
            / total_signal_count
        )

        degraded_ratio = (
            degraded_count
            / total_signal_count
        )

        critical_ratio = (
            critical_count
            / total_signal_count
        )

        severity_penalty = (
            attention_ratio * 5.0
            + degraded_ratio * 10.0
            + critical_ratio * 20.0
        )

        # ------------------------------------------------------
        # Base AI health
        # ------------------------------------------------------

        ai_health = (
            100.0
            - deviation_penalty
            - maximum_penalty
            - severity_penalty
        )

        # ------------------------------------------------------
        # Condition guardrails
        # ------------------------------------------------------

        condition_caps = {
            "NORMAL": 100.0,
            "EARLY_DEVIATION": 89.0,
            "DEGRADED": 69.0,
            "CRITICAL": 39.0,
        }

        condition_cap = condition_caps.get(
            condition
        )

        if condition_cap is not None:

            ai_health = min(
                ai_health,
                condition_cap,
            )

        # ------------------------------------------------------
        # Predictive risk contribution
        # ------------------------------------------------------

        if predictive_risk_score is not None:

            try:

                risk_score = min(
                    max(
                        float(
                            predictive_risk_score
                        ),
                        0.0,
                    ),
                    1.0,
                )

                predictive_penalty = (
                    risk_score * 25.0
                )

                ai_health -= (
                    predictive_penalty
                )

            except (
                TypeError,
                ValueError,
            ):
                pass

        # ------------------------------------------------------
        # Final safety bounds
        # ------------------------------------------------------

        ai_health = max(
            0.0,
            min(
                100.0,
                ai_health,
            ),
        )

        return round(
            ai_health,
            2,
        )

    # ==========================================================
    # UNIFIED OPERATIONAL CONDITION
    # ==========================================================

    @staticmethod
    def _unify_operational_condition(
        degradation: dict,
        predictive_risk: dict,
    ) -> dict:
        """
        Combine degradation evidence and predictive risk
        into one operational condition.

        Important:
        The predictive probability itself is NOT modified.

        Example:

            degradation = CRITICAL
            predictive risk = MEDIUM

        becomes:

            operational condition = CRITICAL

        This prevents the UI from showing a critical current
        machine condition together with an ATTENTION-only
        operational response.

        The underlying ML probabilities remain untouched.
        """

        degradation_condition = str(
            degradation.get(
                "condition",
                "UNKNOWN",
            )
        ).upper()

        predictive_level = str(
            predictive_risk.get(
                "risk_level",
                "UNKNOWN",
            )
        ).upper()

        severity_order = {
            "UNKNOWN": 0,
            "LOW": 1,
            "EARLY_DEVIATION": 2,
            "MEDIUM": 3,
            "ATTENTION": 3,
            "DEGRADED": 4,
            "HIGH": 4,
            "CRITICAL": 5,
        }

        degradation_severity = (
            severity_order.get(
                degradation_condition,
                0,
            )
        )

        predictive_severity = (
            severity_order.get(
                predictive_level,
                0,
            )
        )

        if (
            degradation_severity
            >= predictive_severity
        ):

            if degradation_condition == "CRITICAL":
                operational_level = "CRITICAL"

            elif degradation_condition == "DEGRADED":
                operational_level = "HIGH"

            elif degradation_condition == "EARLY_DEVIATION":
                operational_level = "MEDIUM"

            else:
                operational_level = (
                    predictive_level
                )

        else:

            operational_level = (
                predictive_level
            )

        # ------------------------------------------------------
        # Operational action
        # ------------------------------------------------------

        actions = {
            "LOW": (
                "Continue normal operation and monitoring."
            ),

            "MEDIUM": (
                "Increase monitoring frequency and "
                "inspect machine condition."
            ),

            "HIGH": (
                "Schedule maintenance inspection "
                "as soon as possible."
            ),

            "CRITICAL": (
                "Inspect machine immediately and "
                "consider controlled shutdown."
            ),
        }

        action = actions.get(
            operational_level,
            "Continue Digital Twin monitoring.",
        )

        return {
            "level": operational_level,
            "action": action,
            "degradation_condition": (
                degradation_condition
            ),
            "predictive_level": (
                predictive_level
            ),
        }

    # ==========================================================
    # UNIFIED RUL STATUS
    # ==========================================================

    @staticmethod
    def _apply_operational_rul_override(
        rul: dict,
        operational_condition: dict,
    ) -> dict:
        """
        Align RUL operational status with the unified
        machine condition.

        The numerical RUL estimate from RULEngine is preserved.

        Only the operational status/reason is escalated when
        current degradation evidence requires it.
        """

        result = dict(rul)

        level = str(
            operational_condition.get(
                "level",
                "UNKNOWN",
            )
        ).upper()

        # ------------------------------------------------------
        # Critical condition
        # ------------------------------------------------------

        if level == "CRITICAL":

            result["status"] = "CRITICAL"

            result["reason"] = (
                "RUL estimate is based on a critical "
                "current machine condition. Significant "
                "telemetry deviation requires immediate "
                "inspection and consideration of a "
                "controlled shutdown."
            )

        # ------------------------------------------------------
        # High condition
        # ------------------------------------------------------

        elif level == "HIGH":

            result["status"] = "ATTENTION"

            result["reason"] = (
                "RUL estimate indicates reduced remaining "
                "life under elevated predictive and/or "
                "degradation risk. Maintenance inspection "
                "should be scheduled as soon as possible."
            )

        # ------------------------------------------------------
        # Medium condition
        # ------------------------------------------------------

        elif level == "MEDIUM":

            if str(
                result.get(
                    "status",
                    "",
                )
            ).upper() == "NORMAL":

                result["status"] = "ATTENTION"

            existing_reason = result.get(
                "reason"
            )

            if not existing_reason:

                result["reason"] = (
                    "RUL estimate reflects elevated "
                    "condition risk and requires increased "
                    "monitoring."
                )

        return result

    # ==========================================================
    # UNAVAILABLE RESPONSE
    # ==========================================================

    @staticmethod
    def _unavailable(
        machine_id: str,
        reason: str,
    ) -> dict:

        return {
            "available": False,

            "machine_id": machine_id,

            "status": (
                "AI condition analysis unavailable"
            ),

            "reason": reason,
        }

    # ==========================================================
    # ANALYZE MACHINE
    # ==========================================================

    @classmethod
    def analyze(
        cls,
        machine_id: str,
    ):

        cls.initialize()

        machine_id = str(
            machine_id
        )

        # ======================================================
        # LIVE TELEMETRY
        # ======================================================

        live_dataframe = (
            LiveTelemetryStore.get_all()
        )

        if live_dataframe.empty:

            return cls._unavailable(
                machine_id,
                (
                    "Live telemetry history "
                    "is not available yet."
                ),
            )

        # ------------------------------------------------------
        # Extract machine history.
        # ------------------------------------------------------

        machine_rows = (
            live_dataframe[
                live_dataframe[
                    "Machine_ID"
                ].astype(str)
                == machine_id
            ]
            .copy()
        )

        if machine_rows.empty:

            return cls._unavailable(
                machine_id,
                (
                    "No live telemetry exists "
                    "for this machine."
                ),
            )

        machine_rows = (
            machine_rows
            .sort_values("Timestamp")
            .reset_index(drop=True)
        )

        latest = machine_rows.iloc[-1]

        machine_type = str(
            latest["Machine_Type"]
        )

        timestamp = str(
            latest["Timestamp"]
        )

        # ======================================================
        # DEGRADATION
        # ======================================================

        degradation = (
            cls._degradation.analyze(
                machine_rows,
                len(machine_rows) - 1,
                "Machine_ID",
                "Timestamp",
                "Machine_Type",
                cls.TELEMETRY_COLUMNS,
            )
        )

        # ======================================================
        # BASELINE EXPLANATION
        # ======================================================

        baseline_explanation = (
            cls._baseline.explain(
                latest,
                "Machine_Type",
                cls.TELEMETRY_COLUMNS,
            )
        )

        baseline_available = bool(
            baseline_explanation.get(
                "available",
                False,
            )
        )

        # ======================================================
        # PREDICTIVE FAILURE
        # ======================================================

        MIN_PREDICTION_HISTORY = 30

        if (
            len(machine_rows)
            < MIN_PREDICTION_HISTORY
        ):

            ai_health_score = (
                cls._calculate_ai_health_score(
                    degradation,
                    None,
                )
            )

            return {
                "available": True,

                "machine_id": machine_id,

                "timestamp": timestamp,

                "machine_type": machine_type,

                "ai_health_score": (
                    ai_health_score
                ),

                "degradation": degradation,

                "baseline": baseline_explanation,

                "telemetry": {
                    signal: float(
                        latest[signal]
                    )
                    for signal
                    in cls.TELEMETRY_COLUMNS
                },

                "predictive_failure": {
                    "available": False,

                    "risk_level": "UNKNOWN",

                    "risk_score": None,

                    "probability": None,

                    "ai_failure_probability": None,

                    "reason": (
                        "Collecting sufficient "
                        "live telemetry history "
                        f"({len(machine_rows)}/"
                        f"{MIN_PREDICTION_HISTORY})."
                    ),

                    "recommended_action": (
                        "Continue Digital Twin "
                        "monitoring."
                    ),
                },

                "rul": {
                    "available": False,

                    "remaining_useful_life_hours": None,

                    "confidence": 0.0,

                    "status": "COLLECTING",

                    "reason": (
                        "RUL estimation will begin "
                        "after sufficient live "
                        "telemetry is collected."
                    ),
                },

                "status": (
                    "AI condition analysis "
                    "collecting telemetry"
                ),
            }

        # ======================================================
        # PREDICTIVE MODEL
        # ======================================================

        try:

            prediction = (
                cls._predictor
                .predict_latest_live(
                    live_dataframe,
                    machine_id,
                )
            )

            predictive_risk = (
                PredictiveRiskEngine
                .assess_prediction(
                    prediction
                )
            )

        except Exception as exc:

            return cls._unavailable(
                machine_id,
                (
                    "Predictive analysis failed: "
                    f"{exc}"
                ),
            )

        # ======================================================
        # UNIFIED OPERATIONAL CONDITION
        # ======================================================

        operational_condition = (
            cls._unify_operational_condition(
                degradation,
                predictive_risk,
            )
        )

        # ======================================================
        # AI HEALTH SCORE
        # ======================================================

        predictive_risk_score = None

        try:

            predictive_risk_score = float(
                predictive_risk[
                    "risk_score"
                ]
            )

        except (
            TypeError,
            ValueError,
            KeyError,
        ):

            predictive_risk_score = None

        ai_health_score = (
            cls._calculate_ai_health_score(
                degradation,
                predictive_risk_score,
            )
        )

        # ======================================================
        # DIGITAL TWIN MACHINE
        # ======================================================

        from app.digital_twin.runtime import (
            DigitalTwinRuntime,
        )

        machine = (
            DigitalTwinRuntime.get(
                machine_id
            )
        )

        if machine is None:

            return cls._unavailable(
                machine_id,
                (
                    "Machine is not registered "
                    "in the Digital Twin runtime."
                ),
            )

        # ======================================================
        # BASELINE RUL
        # ======================================================

        baseline_rul = float(
            machine.remaining_useful_life
        )

        # ======================================================
        # DEGRADATION EVIDENCE
        # ======================================================

        if baseline_available:

            current_deviation = float(
                degradation.get(
                    "current_deviation",
                    0.0,
                )
            )

            deviation_trend = float(
                degradation.get(
                    "deviation_trend",
                    0.0,
                )
            )

        else:

            current_deviation = None
            deviation_trend = None

        # ======================================================
        # ANOMALY EVIDENCE
        # ======================================================

        anomaly_persistence_value = (
            degradation.get(
                "anomaly_persistence"
            )
        )

        anomaly_available = (
            anomaly_persistence_value
            is not None
        )

        if anomaly_available:

            anomaly_persistence = int(
                anomaly_persistence_value
            )

        else:

            anomaly_persistence = None

        # ======================================================
        # DYNAMIC RUL
        # ======================================================

        rul = RULEngine.estimate_dict(

            baseline_rul_hours=baseline_rul,

            health_score=float(
                machine.health_score
            ),

            failure_probability_30m=float(
                prediction[
                    "risk"
                ]["30m"]
            ),

            failure_probability_60m=float(
                prediction[
                    "risk"
                ]["60m"]
            ),

            failure_probability_120m=float(
                prediction[
                    "risk"
                ]["120m"]
            ),

            current_deviation=(
                current_deviation
            ),

            deviation_trend=(
                deviation_trend
            ),

            anomaly_persistence=(
                anomaly_persistence
            ),

            baseline_available=(
                baseline_available
            ),

            anomaly_available=(
                anomaly_available
            ),
        )

        # ------------------------------------------------------
        # Align RUL operational status with unified condition.
        # ------------------------------------------------------

        rul = (
            cls._apply_operational_rul_override(
                rul,
                operational_condition,
            )
        )

        # ======================================================
        # PREDICTIVE RESPONSE
        #
        # IMPORTANT:
        #
        # The model probabilities are untouched.
        #
        # The displayed operational risk level/action is
        # escalated only when degradation evidence is more
        # severe than the predictive classifier's risk level.
        # ======================================================

        predictive_failure_response = {
            "available": True,

            "probability": prediction[
                "risk"
            ],

            # Operationally unified risk level.
            "risk_level": (
                operational_condition[
                    "level"
                ]
            ),

            # Keep the actual model risk score unchanged.
            "risk_score": predictive_risk[
                "risk_score"
            ],

            "ai_failure_probability": (
                predictive_risk[
                    "risk_score"
                ]
            ),

            "reason": (
                predictive_risk[
                    "reason"
                ]
            ),

            "recommended_action": (
                operational_condition[
                    "action"
                ]
            ),

            # --------------------------------------------------
            # Explain why operational risk was escalated.
            # --------------------------------------------------

            "operational_condition": (
                operational_condition[
                    "level"
                ]
            ),

            "degradation_condition": (
                operational_condition[
                    "degradation_condition"
                ]
            ),

            "model_risk_level": (
                operational_condition[
                    "predictive_level"
                ]
            ),
        }

        # ------------------------------------------------------
        # If current degradation is more severe than the model
        # risk, make that explicit in the explanation.
        # ------------------------------------------------------

        if (
            operational_condition[
                "degradation_condition"
            ]
            == "CRITICAL"
            and operational_condition[
                "predictive_level"
            ]
            != "CRITICAL"
        ):

            predictive_failure_response[
                "reason"
            ] = (
                "Current telemetry degradation is "
                "classified as CRITICAL even though "
                "the predictive failure model reports "
                f"{operational_condition['predictive_level']} "
                "risk. Operational response has therefore "
                "been escalated based on current machine "
                "condition evidence."
            )

        elif (
            operational_condition[
                "degradation_condition"
            ]
            == "DEGRADED"
            and operational_condition[
                "predictive_level"
            ]
            not in (
                "HIGH",
                "CRITICAL",
            )
        ):

            predictive_failure_response[
                "reason"
            ] = (
                "Current telemetry degradation is "
                "classified as DEGRADED. Operational "
                "maintenance response has been escalated "
                "despite the lower predictive model risk."
            )

        # ======================================================
        # UNIFIED RESPONSE
        # ======================================================

        return {
            "available": True,

            "machine_id": machine_id,

            "timestamp": timestamp,

            "machine_type": machine_type,

            # --------------------------------------------------
            # Digital Twin health
            # --------------------------------------------------

            "digital_twin_health_score": round(
                float(
                    machine.health_score
                ),
                2,
            ),

            # --------------------------------------------------
            # AI health
            # --------------------------------------------------

            "ai_health_score": (
                ai_health_score
            ),

            # --------------------------------------------------
            # Live telemetry
            # --------------------------------------------------

            "telemetry": {
                signal: round(
                    float(
                        latest[signal]
                    ),
                    4,
                )
                for signal
                in cls.TELEMETRY_COLUMNS
            },

            # --------------------------------------------------
            # Degradation
            # --------------------------------------------------

            "degradation": degradation,

            # --------------------------------------------------
            # Learned baseline
            # --------------------------------------------------

            "baseline": baseline_explanation,

            # --------------------------------------------------
            # Predictive failure
            # --------------------------------------------------

            "predictive_failure": (
                predictive_failure_response
            ),

            # --------------------------------------------------
            # Dynamic RUL
            # --------------------------------------------------

            "rul": {
                "available": True,

                "remaining_useful_life_hours": (
                    rul[
                        "remaining_useful_life_hours"
                    ]
                ),

                "confidence": (
                    rul[
                        "confidence"
                    ]
                ),

                "status": (
                    rul[
                        "status"
                    ]
                ),

                "reason": (
                    rul[
                        "reason"
                    ]
                ),

                "factors": (
                    rul[
                        "factors"
                    ]
                ),

                "method": (
                    rul[
                        "method"
                    ]
                ),

                "baseline_rul_hours": (
                    baseline_rul
                ),
            },

            # --------------------------------------------------
            # Overall operational condition
            # --------------------------------------------------

            "operational_condition": {
                "level": (
                    operational_condition[
                        "level"
                    ]
                ),

                "action": (
                    operational_condition[
                        "action"
                    ]
                ),

                "degradation_condition": (
                    operational_condition[
                        "degradation_condition"
                    ]
                ),

                "model_risk_level": (
                    operational_condition[
                        "predictive_level"
                    ]
                ),
            },

            # --------------------------------------------------
            # Overall status
            # --------------------------------------------------

            "status": (
                "Live AI condition analysis available"
            ),
        }
