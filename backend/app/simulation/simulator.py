import random

from app.digital_twin.runtime import DigitalTwinRuntime
from app.carbon.calculator import CarbonCalculator


class Simulator:

    # ============================================================
    # MACHINE-SPECIFIC TELEMETRY LIMITS
    # ============================================================

    TEMPERATURE_LIMITS = {
        "Boiler": (160.0, 220.0),
        "Pump": (55.0, 100.0),
        "Motor": (60.0, 110.0),
        "Compressor": (65.0, 120.0),
    }

    PRESSURE_LIMITS = {
        "Boiler": (6.0, 10.0),
        "Pump": (3.5, 7.0),
        "Motor": (1.5, 5.0),
        "Compressor": (5.0, 9.0),
    }

    VIBRATION_LIMITS = {
        "Boiler": (0.5, 2.5),
        "Pump": (0.3, 2.0),
        "Motor": (0.5, 3.0),
        "Compressor": (0.4, 2.5),
    }

    @staticmethod
    def _clamp(
        value: float,
        minimum: float,
        maximum: float,
    ) -> float:
        return max(
            minimum,
            min(
                maximum,
                value,
            ),
        )

    @classmethod
    def update(cls):

        machines = DigitalTwinRuntime.machines()

        for machine in machines:

            # ==================================================
            # CONTROLLED MACHINE STATES
            # ==================================================

            if machine.maintenance_status in {
                "Stopped",
                "Emergency Stop",
                "Maintenance",
            }:
                # Machine is not operating.
                # Do not generate operational telemetry.
                continue

            machine_type = machine.type

            # ==================================================
            # TEMPERATURE
            # ==================================================

            temperature_min, temperature_max = (
                cls.TEMPERATURE_LIMITS.get(
                    machine_type,
                    (40.0, 120.0),
                )
            )

            machine.temperature += random.uniform(
                -1.2,
                1.2,
            )

            machine.temperature = cls._clamp(
                machine.temperature,
                temperature_min,
                temperature_max,
            )

            # ==================================================
            # PRESSURE
            # ==================================================

            pressure_min, pressure_max = (
                cls.PRESSURE_LIMITS.get(
                    machine_type,
                    (1.0, 10.0),
                )
            )

            machine.pressure += random.uniform(
                -0.15,
                0.15,
            )

            machine.pressure = cls._clamp(
                machine.pressure,
                pressure_min,
                pressure_max,
            )

            # ==================================================
            # VIBRATION
            # ==================================================

            vibration_min, vibration_max = (
                cls.VIBRATION_LIMITS.get(
                    machine_type,
                    (0.2, 2.5),
                )
            )

            machine.vibration += random.uniform(
                -0.05,
                0.05,
            )

            machine.vibration = cls._clamp(
                machine.vibration,
                vibration_min,
                vibration_max,
            )

            # ==================================================
            # POWER
            # ==================================================

            machine.power += random.uniform(
                -8.0,
                8.0,
            )

            machine.power = max(
                0.0,
                machine.power,
            )

            # ==================================================
            # ENERGY
            # ==================================================
            #
            # Energy is cumulative.
            # We therefore remember the previous value before
            # increasing it.
            # ==================================================

            previous_energy = machine.energy

            energy_increment = random.uniform(
                0.1,
                1.2,
            )

            machine.energy = max(
                0.0,
                machine.energy + energy_increment,
            )

            # ==================================================
            # CARBON
            # ==================================================
            #
            # IMPORTANT:
            #
            # factory.json contains the machine's starting carbon
            # value. We must NOT recalculate total historical
            # carbon from cumulative energy.
            #
            # Instead:
            #
            # starting carbon
            #       +
            # new energy consumed × emission factor
            #
            # This prevents:
            #
            # 44 → 434
            #
            # when energy = 530.
            # ==================================================

            carbon_increment = CarbonCalculator.calculate(
                machine.energy - previous_energy,
                "grid",
            )

            machine.carbon += carbon_increment

            # ==================================================
            # REALISTIC HEALTH VARIATION
            # ==================================================

            temperature_stress = 0.0

            temperature_warning = (
                temperature_max
                - (temperature_max - temperature_min) * 0.20
            )

            if machine.temperature > temperature_warning:
                temperature_stress = (
                    machine.temperature
                    - temperature_warning
                ) * 0.015

            vibration_stress = 0.0

            vibration_warning = (
                vibration_max
                - (vibration_max - vibration_min) * 0.25
            )

            if machine.vibration > vibration_warning:
                vibration_stress = (
                    machine.vibration
                    - vibration_warning
                ) * 0.8

            total_stress = (
                temperature_stress
                + vibration_stress
            )

            # Small natural movement.
            health_noise = random.uniform(
                -0.025,
                0.025,
            )

            # Stress causes small degradation.
            health_change = (
                health_noise
                - total_stress
            )

            machine.health_score += health_change

            # Keep health within realistic limits.
            machine.health_score = cls._clamp(
                machine.health_score,
                45.0,
                99.5,
            )

            # ==================================================
            # FAILURE PROBABILITY
            # ==================================================

            machine.failure_probability = round(
                cls._clamp(
                    100.0 - machine.health_score,
                    0.0,
                    100.0,
                ),
                2,
            )

            # ==================================================
            # ROUND VALUES
            # ==================================================

            machine.temperature = round(
                machine.temperature,
                2,
            )

            machine.pressure = round(
                machine.pressure,
                2,
            )

            machine.vibration = round(
                machine.vibration,
                2,
            )

            machine.power = round(
                machine.power,
                2,
            )

            machine.energy = round(
                machine.energy,
                2,
            )

            machine.carbon = round(
                machine.carbon,
                2,
            )

            machine.health_score = round(
                machine.health_score,
                2,
            )

            machine.failure_probability = round(
                machine.failure_probability,
                2,
            )

        return machines