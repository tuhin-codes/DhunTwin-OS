from app.ai.sustainability_agent import SustainabilityAgent
from app.ai.operations_agent import OperationsAgent
from app.services.ai_condition_service import AIConditionService


class AIEngine:

    @staticmethod
    def analyze(machine):

        # --------------------------------------------------------
        # CarbonTwin AI Condition Service is the authoritative
        # source for predictive risk, degradation, RUL and
        # operational condition.
        # --------------------------------------------------------

        condition = AIConditionService.analyze(
            machine.id
        )

        # --------------------------------------------------------
        # Operations analysis remains separate because it uses
        # Digital Twin operational state.
        # --------------------------------------------------------

        operations = OperationsAgent.analyze(
            machine
        )

        return {
            "predictive": condition.get(
                "predictive_failure",
                {
                    "available": False,
                    "risk_level": "UNKNOWN",
                    "risk_score": None,
                    "probability": None,
                    "ai_failure_probability": None,
                    "reason": (
                        "Predictive AI condition "
                        "analysis is unavailable."
                    ),
                    "recommended_action": (
                        "Continue Digital Twin monitoring."
                    ),
                },
            ),

            "condition": condition,

            "operations": operations,
        }

    @staticmethod
    def sustainability():

        return SustainabilityAgent.analyze()