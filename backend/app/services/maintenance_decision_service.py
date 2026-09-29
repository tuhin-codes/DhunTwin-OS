from __future__ import annotations

from typing import Any


class MaintenanceDecisionService:
    """
    CarbonTwin Maintenance Decision Engine.

    Purpose
    -------
    Converts AIConditionService output into an explainable
    maintenance-planning recommendation.

    IMPORTANT
    ---------
    This service does NOT:

        - modify ML models
        - modify failure probabilities
        - force machine shutdown
        - automatically assign engineers
        - automatically assign technicians
        - modify Digital Twin runtime state
        - issue machine-control commands

    It is a decision-support layer.

    Flow:

        Digital Twin
              |
              v
        AI Condition Service
              |
              v
        Maintenance Decision Engine
              |
              v
        Maintenance Planning
              |
              v
        Workforce Recommendation
              |
              v
        Human / Operator Confirmation
    """

    # ============================================================
    # CONFIGURATION
    # ============================================================

    MEDIUM_RISK = 0.20
    HIGH_RISK = 0.40
    CRITICAL_RISK = 0.70

    HEALTH_ATTENTION = 90.0
    HEALTH_HIGH = 75.0
    HEALTH_CRITICAL = 50.0

    RUL_ATTENTION = 240.0
    RUL_HIGH = 120.0
    RUL_CRITICAL = 48.0

    # ============================================================
    # NORMALIZATION HELPERS
    # ============================================================

    @staticmethod
    def _upper(
        value: Any,
        default: str = "",
    ) -> str:

        if value is None:
            return default

        return str(value).strip().upper()

    @staticmethod
    def _float(
        value: Any,
        default: float | None = None,
    ) -> float | None:

        if value is None:
            return default

        try:
            return float(value)

        except (
            TypeError,
            ValueError,
        ):
            return default

    # ============================================================
    # PROBABILITY RISK LEVEL
    # ============================================================

    @classmethod
    def _probability_risk_level(
        cls,
        probability: float | None,
    ) -> str:
        """
        Convert predictive probability into a risk level.

        This is only used as a fallback when the AI service
        does not already provide a risk level.
        """

        if probability is None:
            return "UNKNOWN"

        if probability >= cls.CRITICAL_RISK:
            return "CRITICAL"

        if probability >= cls.HIGH_RISK:
            return "HIGH"

        if probability >= cls.MEDIUM_RISK:
            return "MEDIUM"

        return "LOW"

    # ============================================================
    # PREDICTIVE PROBABILITY
    # ============================================================

    @classmethod
    def _extract_predictive_probability(
        cls,
        ai_condition: dict[str, Any],
    ) -> float | None:
        """
        Extract the strongest available predictive probability.

        Preference:

            120m
            60m
            30m
            ai_failure_probability
            risk_score
        """

        predictive = ai_condition.get(
            "predictive_failure",
            {},
        )

        if not isinstance(
            predictive,
            dict,
        ):
            predictive = {}

        probability = predictive.get(
            "probability"
        )

        if isinstance(
            probability,
            dict,
        ):

            values: list[float] = []

            for horizon in (
                "30m",
                "60m",
                "120m",
            ):

                value = cls._float(
                    probability.get(
                        horizon
                    )
                )

                if value is not None:
                    values.append(value)

            if values:
                return max(values)

        value = cls._float(
            predictive.get(
                "ai_failure_probability"
            )
        )

        if value is not None:
            return value

        return cls._float(
            predictive.get(
                "risk_score"
            )
        )

    # ============================================================
    # PREDICTIVE LEVEL
    # ============================================================

    @classmethod
    def _extract_predictive_level(
        cls,
        ai_condition: dict[str, Any],
    ) -> str:
        """
        Prefer the risk classification produced by the
        existing predictive AI service.

        Only calculate a fallback classification when the
        existing service does not provide one.
        """

        predictive = ai_condition.get(
            "predictive_failure",
            {},
        )

        if not isinstance(
            predictive,
            dict,
        ):
            predictive = {}

        model_level = cls._upper(
            predictive.get(
                "risk_level"
            )
        )

        if model_level in {
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL",
        }:

            return model_level

        probability = (
            cls._extract_predictive_probability(
                ai_condition
            )
        )

        return cls._probability_risk_level(
            probability
        )

    # ============================================================
    # DIGITAL TWIN HEALTH LEVEL
    # ============================================================

    @classmethod
    def _health_level(
        cls,
        ai_condition: dict[str, Any],
    ) -> str:
        """
        Convert Digital Twin health score into a condition level.

        Higher health score = healthier machine.
        """

        health = cls._float(
            ai_condition.get(
                "digital_twin_health_score"
            )
        )

        if health is None:
            return "UNKNOWN"

        if health < cls.HEALTH_CRITICAL:
            return "CRITICAL"

        if health < cls.HEALTH_HIGH:
            return "HIGH"

        if health < cls.HEALTH_ATTENTION:
            return "MEDIUM"

        return "LOW"

    # ============================================================
    # DEGRADATION LEVEL
    # ============================================================

    @classmethod
    def _degradation_level(
        cls,
        ai_condition: dict[str, Any],
    ) -> str:
        """
        Read learned degradation evidence.

        INSUFFICIENT_EVIDENCE remains distinct from NORMAL.

        Missing baseline evidence is never interpreted as
        proof that the machine is healthy.
        """

        degradation = ai_condition.get(
            "degradation",
            {},
        )

        if not isinstance(
            degradation,
            dict,
        ):
            return "UNKNOWN"

        condition = cls._upper(
            degradation.get(
                "condition"
            )
        )

        if condition in {
            "NORMAL",
            "ATTENTION",
            "DEGRADED",
            "CRITICAL",
            "INSUFFICIENT_EVIDENCE",
        }:

            return condition

        return "UNKNOWN"

    # ============================================================
    # RUL LEVEL
    # ============================================================

    @classmethod
    def _rul_level(
        cls,
        ai_condition: dict[str, Any],
    ) -> str:
        """
        Convert remaining useful life into a maintenance level.
        """

        rul = ai_condition.get(
            "rul",
            {},
        )

        if not isinstance(
            rul,
            dict,
        ):
            return "UNKNOWN"

        if not bool(
            rul.get(
                "available",
                False,
            )
        ):
            return "UNKNOWN"

        remaining = cls._float(
            rul.get(
                "remaining_useful_life_hours"
            )
        )

        if remaining is None:
            return "UNKNOWN"

        if remaining <= cls.RUL_CRITICAL:
            return "CRITICAL"

        if remaining <= cls.RUL_HIGH:
            return "HIGH"

        if remaining <= cls.RUL_ATTENTION:
            return "MEDIUM"

        return "LOW"

    # ============================================================
    # ANOMALY LEVEL
    # ============================================================

    @classmethod
    def _anomaly_level(
        cls,
        ai_condition: dict[str, Any],
    ) -> str:
        """
        Interpret anomaly persistence when anomaly analysis
        is available.
        """

        degradation = ai_condition.get(
            "degradation",
            {},
        )

        if not isinstance(
            degradation,
            dict,
        ):
            return "UNKNOWN"

        anomaly_available = bool(
            degradation.get(
                "anomaly_available",
                False,
            )
        )

        if not anomaly_available:
            return "UNKNOWN"

        persistence = cls._float(
            degradation.get(
                "anomaly_persistence"
            )
        )

        if persistence is None:
            return "UNKNOWN"

        if persistence >= 0.75:
            return "CRITICAL"

        if persistence >= 0.40:
            return "HIGH"

        if persistence > 0:
            return "MEDIUM"

        return "LOW"

    # ============================================================
    # PRIORITY SCORE
    # ============================================================

    @classmethod
    def _priority_score(
        cls,
        predictive_level: str,
        health_level: str,
        degradation_level: str,
        rul_level: str,
        anomaly_level: str,
    ) -> int:
        """
        Calculate an explainable maintenance-priority score.

        This score is NOT an ML prediction.

        Predictive risk is the primary driver.

        Score interpretation:

            0-24    LOW
            25-49   MEDIUM
            50-74   HIGH
            75-100  CRITICAL

        UNKNOWN and INSUFFICIENT_EVIDENCE contribute zero.

        They are NOT interpreted as healthy evidence.
        """

        level_score = {
            "LOW": 0,
            "MEDIUM": 50,
            "HIGH": 75,
            "CRITICAL": 100,
        }

        predictive_score = level_score.get(
            predictive_level,
            0,
        )

        health_score = level_score.get(
            health_level,
            0,
        )

        degradation_score = level_score.get(
            degradation_level,
            0,
        )

        rul_score = level_score.get(
            rul_level,
            0,
        )

        anomaly_score = level_score.get(
            anomaly_level,
            0,
        )

        score = (
            predictive_score * 0.50
            + health_score * 0.20
            + degradation_score * 0.15
            + rul_score * 0.10
            + anomaly_score * 0.05
        )

        return max(
            0,
            min(
                100,
                round(score),
            ),
        )

    # ============================================================
    # MAINTENANCE DECISION
    # ============================================================

    @classmethod
    def _maintenance_decision(
        cls,
        predictive_level: str,
        health_level: str,
        degradation_level: str,
        rul_level: str,
        anomaly_level: str,
        priority_score: int,
    ) -> tuple[str, str]:
        """
        Determine maintenance priority.

        IMPORTANT:

        This method never issues a machine shutdown command.

        Critical evidence means immediate human assessment.

        High evidence means scheduled maintenance.

        Medium evidence means planned maintenance.

        Low evidence means continued monitoring.
        """

        # ========================================================
        # CRITICAL
        # ========================================================

        if (
            predictive_level == "CRITICAL"
            or degradation_level == "CRITICAL"
            or anomaly_level == "CRITICAL"
            or rul_level == "CRITICAL"
            or health_level == "CRITICAL"
        ):

            return (
                "IMMEDIATE_INTERVENTION",
                (
                    "Immediate maintenance assessment is "
                    "recommended. An authorized engineer or "
                    "maintenance supervisor should review the "
                    "machine condition and determine the "
                    "appropriate operational response."
                ),
            )

        # ========================================================
        # HIGH
        # ========================================================

        if (
            predictive_level == "HIGH"
            or degradation_level == "DEGRADED"
            or health_level == "HIGH"
            or rul_level == "HIGH"
            or anomaly_level == "HIGH"
            or priority_score >= 50
        ):

            return (
                "SCHEDULE_MAINTENANCE",
                (
                    "Maintenance should be scheduled based on "
                    "the elevated machine condition and "
                    "predictive risk."
                ),
            )

        # ========================================================
        # MEDIUM
        # ========================================================

        if (
            predictive_level == "MEDIUM"
            or degradation_level == "ATTENTION"
            or health_level == "MEDIUM"
            or rul_level == "MEDIUM"
            or anomaly_level == "MEDIUM"
            or priority_score >= 25
        ):

            return (
                "PLAN_MAINTENANCE",
                (
                    "Continue enhanced monitoring and plan "
                    "maintenance before the condition worsens."
                ),
            )

        # ========================================================
        # LOW
        # ========================================================

        return (
            "CONTINUE_MONITORING",
            (
                "Machine condition does not currently require "
                "maintenance intervention. Continue Digital Twin "
                "monitoring."
            ),
        )

    # ============================================================
    # WORKFORCE REQUIREMENT
    # ============================================================

    @classmethod
    def _workforce_requirement(
        cls,
        decision: str,
        predictive_level: str,
        degradation_level: str,
        health_level: str,
        rul_level: str,
    ) -> dict[str, Any]:
        """
        Determine which workforce category should be involved.

        Engineer:

            Diagnosis
            Engineering review
            Maintenance planning
            Approval of complex intervention

        Technician:

            Physical inspection
            Preventive maintenance
            Corrective maintenance
            Approved repair execution

        This method recommends a role only.

        It does NOT perform an assignment.
        """

        # ========================================================
        # NORMAL MONITORING
        # ========================================================

        if decision == "CONTINUE_MONITORING":

            return {
                "engineer_required": False,
                "technician_required": False,
                "recommended_role": "NONE",
                "reason": (
                    "No maintenance intervention is currently "
                    "required."
                ),
            }

        # ========================================================
        # PLANNED MAINTENANCE
        # ========================================================

        if decision == "PLAN_MAINTENANCE":

            return {
                "engineer_required": False,
                "technician_required": True,
                "recommended_role": "TECHNICIAN",
                "reason": (
                    "The condition supports planned maintenance "
                    "execution by a qualified technician."
                ),
            }

        # ========================================================
        # SCHEDULED MAINTENANCE
        # ========================================================

        if decision == "SCHEDULE_MAINTENANCE":

            complex_condition = (
                predictive_level == "HIGH"
                and (
                    degradation_level
                    in {
                        "DEGRADED",
                        "CRITICAL",
                    }
                    or health_level
                    in {
                        "HIGH",
                        "CRITICAL",
                    }
                    or rul_level
                    in {
                        "HIGH",
                        "CRITICAL",
                    }
                )
            )

            if complex_condition:

                return {
                    "engineer_required": True,
                    "technician_required": True,
                    "recommended_role": (
                        "ENGINEER_AND_TECHNICIAN"
                    ),
                    "reason": (
                        "Elevated predictive and machine "
                        "condition evidence supports engineering "
                        "review followed by technician execution."
                    ),
                }

            return {
                "engineer_required": False,
                "technician_required": True,
                "recommended_role": "TECHNICIAN",
                "reason": (
                    "Maintenance should be scheduled for "
                    "qualified technician execution."
                ),
            }

        # ========================================================
        # IMMEDIATE INTERVENTION
        # ========================================================

        if decision == "IMMEDIATE_INTERVENTION":

            return {
                "engineer_required": True,
                "technician_required": True,
                "recommended_role": (
                    "ENGINEER_AND_TECHNICIAN"
                ),
                "reason": (
                    "The machine requires immediate maintenance "
                    "assessment. Engineering review should "
                    "determine the intervention strategy, while "
                    "a qualified technician can perform the "
                    "approved physical maintenance work."
                ),
            }

        # ========================================================
        # SAFE FALLBACK
        # ========================================================

        return {
            "engineer_required": False,
            "technician_required": False,
            "recommended_role": "NONE",
            "reason": (
                "No workforce assignment should be created "
                "automatically."
            ),
        }

    # ============================================================
    # OPERATIONAL RECOMMENDATION
    # ============================================================

    @classmethod
    def _operational_recommendation(
        cls,
        decision: str,
    ) -> dict[str, Any]:
        """
        Recommend a maintenance planning state.

        This is NOT a machine command.

        Actual machine operation remains under authorized
        plant procedures and human control.
        """

        if decision == "CONTINUE_MONITORING":

            return {
                "recommended_state":
                    "RUNNING",

                "machine_command":
                    None,

                "shutdown_required":
                    False,

                "reason":
                    (
                        "Continue normal operation with "
                        "Digital Twin monitoring."
                    ),
            }

        if decision == "PLAN_MAINTENANCE":

            return {
                "recommended_state":
                    "MAINTENANCE_PLANNED",

                "machine_command":
                    None,

                "shutdown_required":
                    False,

                "reason":
                    (
                        "Plan maintenance while the machine "
                        "continues operating according to "
                        "plant procedures."
                    ),
            }

        if decision == "SCHEDULE_MAINTENANCE":

            return {
                "recommended_state":
                    "MAINTENANCE_SCHEDULED",

                "machine_command":
                    None,

                "shutdown_required":
                    False,

                "reason":
                    (
                        "Schedule maintenance and allow "
                        "authorized plant personnel to "
                        "determine the operational response."
                    ),
            }

        if decision == "IMMEDIATE_INTERVENTION":

            return {
                "recommended_state":
                    "MAINTENANCE_REVIEW_REQUIRED",

                "machine_command":
                    None,

                "shutdown_required":
                    False,

                "reason":
                    (
                        "Immediate engineering/maintenance "
                        "assessment is required. CarbonTwin "
                        "does not issue an automatic shutdown "
                        "command."
                    ),
            }

        return {
            "recommended_state":
                "REVIEW",

            "machine_command":
                None,

            "shutdown_required":
                False,

            "reason":
                (
                    "Human review is required before "
                    "operational action."
                ),
        }

    # ============================================================
    # EXPLANATION
    # ============================================================

    @classmethod
    def _build_explanation(
        cls,
        decision: str,
        predictive_level: str,
        health_level: str,
        degradation_level: str,
        rul_level: str,
        anomaly_level: str,
        workforce: dict[str, Any],
    ) -> list[str]:

        evidence: list[str] = []

        evidence.append(
            f"Predictive risk: {predictive_level}"
        )

        evidence.append(
            f"Digital Twin health condition: "
            f"{health_level}"
        )

        evidence.append(
            f"Degradation evidence: "
            f"{degradation_level}"
        )

        evidence.append(
            f"RUL condition: {rul_level}"
        )

        evidence.append(
            f"Anomaly evidence: {anomaly_level}"
        )

        evidence.append(
            "Recommended workforce role: "
            + str(
                workforce.get(
                    "recommended_role",
                    "NONE",
                )
            )
        )

        if decision == "IMMEDIATE_INTERVENTION":

            evidence.append(
                "Human engineering review is required "
                "before operational action."
            )

        elif decision == "SCHEDULE_MAINTENANCE":

            evidence.append(
                "Maintenance planning is recommended "
                "before the machine condition worsens."
            )

        elif decision == "PLAN_MAINTENANCE":

            evidence.append(
                "Planned technician maintenance is "
                "recommended."
            )

        else:

            evidence.append(
                "No immediate maintenance intervention "
                "is recommended."
            )

        return evidence

    # ============================================================
    # PUBLIC ANALYZE
    # ============================================================

    @classmethod
    def analyze(
        cls,
        ai_condition: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Generate a maintenance decision from an AI condition result.

        The original AI condition dictionary is never modified.
        """

        if not isinstance(
            ai_condition,
            dict,
        ):

            raise ValueError(
                "ai_condition must be a dictionary."
            )

        if not ai_condition.get(
            "available",
            False,
        ):

            return {
                "available": False,

                "status":
                    "AI_CONDITION_UNAVAILABLE",

                "decision":
                    "REVIEW_REQUIRED",

                "reason":
                    (
                        "Maintenance decision cannot be "
                        "generated because AI condition analysis "
                        "is unavailable."
                    ),

                "operator_confirmation_required":
                    False,

                "automatic_assignment":
                    False,

                "automatic_shutdown":
                    False,
            }

        # ========================================================
        # Extract evidence
        # ========================================================

        predictive_level = (
            cls._extract_predictive_level(
                ai_condition
            )
        )

        predictive_probability = (
            cls._extract_predictive_probability(
                ai_condition
            )
        )

        health_level = (
            cls._health_level(
                ai_condition
            )
        )

        degradation_level = (
            cls._degradation_level(
                ai_condition
            )
        )

        rul_level = (
            cls._rul_level(
                ai_condition
            )
        )

        anomaly_level = (
            cls._anomaly_level(
                ai_condition
            )
        )

        # ========================================================
        # Priority
        # ========================================================

        priority_score = (
            cls._priority_score(
                predictive_level,
                health_level,
                degradation_level,
                rul_level,
                anomaly_level,
            )
        )

        # ========================================================
        # Decision
        # ========================================================

        decision, decision_reason = (
            cls._maintenance_decision(
                predictive_level,
                health_level,
                degradation_level,
                rul_level,
                anomaly_level,
                priority_score,
            )
        )

        # ========================================================
        # Workforce
        # ========================================================

        workforce = (
            cls._workforce_requirement(
                decision,
                predictive_level,
                degradation_level,
                health_level,
                rul_level,
            )
        )

        # ========================================================
        # Operational recommendation
        # ========================================================

        operational = (
            cls._operational_recommendation(
                decision
            )
        )

        # ========================================================
        # Explanation
        # ========================================================

        explanation = (
            cls._build_explanation(
                decision,
                predictive_level,
                health_level,
                degradation_level,
                rul_level,
                anomaly_level,
                workforce,
            )
        )

        # ========================================================
        # Machine information
        # ========================================================

        machine_id = ai_condition.get(
            "machine_id"
        )

        machine_type = ai_condition.get(
            "machine_type"
        )

        timestamp = ai_condition.get(
            "timestamp"
        )

        # ========================================================
        # RUL details
        # ========================================================

        rul = ai_condition.get(
            "rul",
            {},
        )

        if not isinstance(
            rul,
            dict,
        ):
            rul = {}

        remaining_rul = cls._float(
            rul.get(
                "remaining_useful_life_hours"
            )
        )

        rul_confidence = cls._float(
            rul.get(
                "confidence"
            )
        )

        # ========================================================
        # Predictive details
        # ========================================================

        predictive = ai_condition.get(
            "predictive_failure",
            {},
        )

        if not isinstance(
            predictive,
            dict,
        ):
            predictive = {}

        probabilities = predictive.get(
            "probability",
            {},
        )

        if not isinstance(
            probabilities,
            dict,
        ):
            probabilities = {}

        # ========================================================
        # Degradation details
        # ========================================================

        degradation = ai_condition.get(
            "degradation",
            {},
        )

        if not isinstance(
            degradation,
            dict,
        ):
            degradation = {}

        # ========================================================
        # Return
        # ========================================================

        return {
            "available": True,

            "machine_id":
                machine_id,

            "machine_type":
                machine_type,

            "timestamp":
                timestamp,

            "status":
                "MAINTENANCE_DECISION_AVAILABLE",

            # ----------------------------------------------------
            # Decision
            # ----------------------------------------------------

            "decision":
                decision,

            "decision_reason":
                decision_reason,

            "priority_score":
                priority_score,

            # ----------------------------------------------------
            # Evidence
            # ----------------------------------------------------

            "evidence": {

                "predictive": {

                    "level":
                        predictive_level,

                    "strongest_probability":
                        (
                            round(
                                predictive_probability,
                                4,
                            )
                            if predictive_probability
                            is not None
                            else None
                        ),

                    "probability":
                        {
                            "30m":
                                probabilities.get(
                                    "30m"
                                ),

                            "60m":
                                probabilities.get(
                                    "60m"
                                ),

                            "120m":
                                probabilities.get(
                                    "120m"
                                ),
                        },
                },

                "digital_twin": {

                    "health_score":
                        ai_condition.get(
                            "digital_twin_health_score"
                        ),

                    "condition":
                        health_level,
                },

                "degradation": {

                    "condition":
                        degradation_level,

                    "baseline_available":
                        bool(
                            degradation.get(
                                "baseline_available",
                                False,
                            )
                        ),

                    "anomaly_available":
                        bool(
                            degradation.get(
                                "anomaly_available",
                                False,
                            )
                        ),
                },

                "rul": {

                    "condition":
                        rul_level,

                    "remaining_useful_life_hours":
                        remaining_rul,

                    "confidence":
                        rul_confidence,
                },

                "anomaly": {

                    "condition":
                        anomaly_level,
                },
            },

            # ----------------------------------------------------
            # Operational recommendation
            # ----------------------------------------------------

            "operational_recommendation":
                operational,

            # ----------------------------------------------------
            # Workforce
            # ----------------------------------------------------

            "workforce":
                workforce,

            # ----------------------------------------------------
            # Human control
            # ----------------------------------------------------

            "human_control": {

                "operator_confirmation_required":
                    True,

                "automatic_assignment":
                    False,

                "automatic_shutdown":
                    False,

                "automatic_machine_command":
                    False,
            },

            # ----------------------------------------------------
            # Explainability
            # ----------------------------------------------------

            "explanation":
                explanation,

            # ----------------------------------------------------
            # Architecture
            # ----------------------------------------------------

            "architecture": {

                "ai_role":
                    (
                        "Predict machine condition "
                        "and failure risk."
                    ),

                "decision_role":
                    (
                        "Translate condition evidence "
                        "into a maintenance priority "
                        "and recommended response."
                    ),

                "workforce_role":
                    (
                        "Find qualified personnel after "
                        "the maintenance requirement "
                        "has been identified."
                    ),

                "operator_role":
                    (
                        "Review and confirm the maintenance "
                        "action and assignment."
                    ),

                "machine_control_role":
                    (
                        "Remain under authorized plant "
                        "operational and safety procedures."
                    ),
            },
        }