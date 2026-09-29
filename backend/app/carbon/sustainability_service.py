from app.digital_twin.runtime import DigitalTwinRuntime
from app.carbon.hotspot_service import HotspotService
from app.carbon.recommendation_service import RecommendationService


class SustainabilityService:

    @staticmethod
    def plant_summary():

        machines = DigitalTwinRuntime.machines()

        total_power = sum(m.power for m in machines)
        total_carbon = sum(m.carbon for m in machines)
        total_energy = sum(m.energy for m in machines)
        total_water = sum(m.water for m in machines)

        return {
    "summary": {
        "machines": len(machines),
        "power": round(total_power, 2),
        "carbon": round(total_carbon, 2),
        "energy": round(total_energy, 2),
        "water": round(total_water, 2),
    },
    "top_emitters": HotspotService.top_emitters(),
    "recommendations": RecommendationService.recommendations(),
}