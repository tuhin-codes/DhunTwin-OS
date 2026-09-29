from dataclasses import dataclass


@dataclass
class RiskAssessment:
    risk_level: str
    risk_score: float
    failure_probability_30m: float
    failure_probability_60m: float
    failure_probability_120m: float
    action: str
    reason: str


class PredictiveRiskEngine:

    @staticmethod
    def _risk_level(
        p30: float,
        p60: float,
        p120: float,
    ) -> str:

        # Immediate danger
        if p30 >= 0.80 or p60 >= 0.85:
            return "CRITICAL"

        # Strong near-term risk
        if p30 >= 0.50 or p60 >= 0.60 or p120 >= 0.80:
            return "HIGH"

        # Meaningful predictive risk
        if p30 >= 0.25 or p60 >= 0.35 or p120 >= 0.30:
            return "MEDIUM"

        return "LOW"

    @staticmethod
    def _action(risk_level: str) -> str:

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

        return actions[risk_level]

    @staticmethod
    def _reason(
        risk_level: str,
        p30: float,
        p60: float,
        p120: float,
    ) -> str:

        if risk_level == "CRITICAL":
            return (
                "The predictive model indicates a very high "
                "probability of failure in the near term."
            )

        if risk_level == "HIGH":
            return (
                "The predictive model indicates significant "
                "failure risk within the prediction horizon."
            )

        if risk_level == "MEDIUM":
            return (
                "The machine is showing elevated predictive "
                "failure risk and should receive increased monitoring."
            )

        return (
            "The predictive model currently indicates low "
            "failure risk."
        )

    @classmethod
    def assess(
        cls,
        prediction: dict,
    ) -> RiskAssessment:

        risk = prediction["risk"]

        p30 = float(risk["30m"])
        p60 = float(risk["60m"])
        p120 = float(risk["120m"])

        # Weighted score is still useful for dashboard ranking.
        #
        # Near-term risk gets more weight, but the 120m
        # probability remains visible instead of dominating.
        score = max(
                    p30,
                    p60,
                    p120,
                )

        risk_level = cls._risk_level(
            p30,
            p60,
            p120,
        )

        return RiskAssessment(
            risk_level=risk_level,
            risk_score=round(score, 4),

            failure_probability_30m=round(
                p30,
                4,
            ),

            failure_probability_60m=round(
                p60,
                4,
            ),

            failure_probability_120m=round(
                p120,
                4,
            ),

            action=cls._action(
                risk_level
            ),

            reason=cls._reason(
                risk_level,
                p30,
                p60,
                p120,
            ),
        )

    @classmethod
    def assess_prediction(
        cls,
        prediction: dict,
    ) -> dict:

        assessment = cls.assess(
            prediction
        )

        return {
            "risk_level": assessment.risk_level,

            "risk_score": assessment.risk_score,

            "failure_probability": {
                "30m": assessment.failure_probability_30m,
                "60m": assessment.failure_probability_60m,
                "120m": assessment.failure_probability_120m,
            },

            "reason": assessment.reason,

            "recommended_action": assessment.action,
        }