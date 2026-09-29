from app.services.sustainability_service import SustainabilityService


class SustainabilityAgent:

    @staticmethod
    def analyze():

        summary = SustainabilityService.summary()

        recommendations = summary["recommendations"]

        top_emitters = summary["top_emitters"]

        risk = "Low"

        if summary["summary"]["carbon"] > 500:
            risk = "High"
        elif summary["summary"]["carbon"] > 250:
            risk = "Medium"

        return {
            "summary": summary["summary"],
            "top_emitters": top_emitters,
            "recommendations": recommendations,
            "carbon_risk": risk,
        }