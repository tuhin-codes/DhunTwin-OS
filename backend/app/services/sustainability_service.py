from app.carbon.sustainability_service import (
    SustainabilityService as CarbonSustainabilityService,
)


class SustainabilityService:

    @staticmethod
    def summary():
        """
        Service-layer interface for sustainability data.

        The actual carbon calculations remain inside
        app.carbon.sustainability_service.
        """

        return CarbonSustainabilityService.plant_summary()