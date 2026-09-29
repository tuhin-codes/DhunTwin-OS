from app.carbon.emission_factors import EMISSION_FACTORS


class CarbonCalculator:

    @staticmethod
    def calculate(
        energy_kwh: float,
        source: str = "grid",
    ) -> float:

        factor = EMISSION_FACTORS.get(
            source,
            0.82,
        )

        return round(
            energy_kwh * factor,
            2,
        )