from app.digital_twin.runtime import DigitalTwinRuntime


class RecommendationService:

    @staticmethod
    def recommendations():

        recommendations = []

        for machine in DigitalTwinRuntime.machines():

            if machine.health_score < 80:
                recommendations.append({
                    "priority": "High",
                    "machine": machine.id,
                    "title": "Schedule Predictive Maintenance",
                    "reason": (
                        f"{machine.name} health score "
                        f"is {machine.health_score}%."
                    ),
                    "expected_impact": (
                        "Reduce unexpected downtime."
                    ),
                })

            if machine.carbon > 300:
                recommendations.append({
                    "priority": "Medium",
                    "machine": machine.id,
                    "title": "Reduce Carbon Emissions",
                    "reason": (
                        f"{machine.name} emits "
                        f"{machine.carbon} kg CO₂e."
                    ),
                    "expected_impact": (
                        "Lower plant carbon footprint."
                    ),
                })

            if machine.efficiency < 85:
                recommendations.append({
                    "priority": "Medium",
                    "machine": machine.id,
                    "title": "Improve Machine Efficiency",
                    "reason": (
                        f"Efficiency is only "
                        f"{machine.efficiency}%."
                    ),
                    "expected_impact": (
                        "Reduce energy consumption."
                    ),
                })

        return recommendations