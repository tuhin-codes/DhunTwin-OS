import random

from app.models import Machine


class MachineSimulator:

    # ============================================================
    # INITIAL OPERATING PROFILES
    # ============================================================

    # These represent realistic operating conditions for the
    # Digital Twin demonstration.
    #
    # The values are intentionally deterministic by machine ID
    # so the factory does not randomly become completely different
    # every time the backend restarts.

    OPERATING_PROFILES = {
        "BLR-001": {
            "utilization": 92.0,
            "state": "RUNNING",
            "critical": True,
        },

        "BLR-002": {
            "utilization": 84.0,
            "state": "RUNNING",
            "critical": False,
        },

        "PMP-001": {
            "utilization": 42.0,
            "state": "LOW_LOAD",
            "critical": False,
        },

        "PMP-002": {
            "utilization": 74.0,
            "state": "RUNNING",
            "critical": False,
        },

        "MTR-001": {
            "utilization": 88.0,
            "state": "RUNNING",
            "critical": True,
        },

        "CMP-001": {
            "utilization": 3.0,
            "state": "IDLE",
            "critical": False,
        },
    }

    @classmethod
    def _operating_profile(
        cls,
        machine: Machine,
    ) -> dict:

        profile = cls.OPERATING_PROFILES.get(
            machine.id
        )

        if profile is not None:
            return profile

        # Safe fallback for future machines.
        return {
            "utilization": 75.0,
            "state": "RUNNING",
            "critical": False,
        }

    @classmethod
    def initialize(
        cls,
        machine: Machine,
    ):
        """
        Initialize the Digital Twin simulation using the machine's
        actual CarbonTwin telemetry.

        Operating state and utilization are initialized separately
        from telemetry so the optimization engine can identify:

            - normal production
            - low-load operation
            - idle / standby consumption
            - production-critical machines

        This remains a Digital Twin simulation and does not control
        physical machinery.
        """

        # --------------------------------------------------------
        # Keep the dataset's original values as the starting state.
        # Only small variations are introduced.
        # --------------------------------------------------------

        machine.temperature = round(
            machine.temperature
            + random.uniform(-1.0, 1.0),
            2,
        )

        machine.pressure = round(
            machine.pressure
            + random.uniform(-0.1, 0.1),
            2,
        )

        machine.vibration = round(
            max(
                0.0,
                machine.vibration
                + random.uniform(-0.05, 0.05),
            ),
            2,
        )

        machine.rpm = max(
            0,
            int(
                machine.rpm
                + random.randint(-5, 5)
            ),
        )

        machine.torque = round(
            max(
                0.0,
                machine.torque
                + random.uniform(-2.0, 2.0),
            ),
            2,
        )

        machine.power = round(
            max(
                0.0,
                machine.power
                + random.uniform(-5.0, 5.0),
            ),
            2,
        )

        machine.energy = round(
            max(
                0.0,
                machine.energy
                + random.uniform(-3.0, 3.0),
            ),
            2,
        )

        machine.water = round(
            max(
                0.0,
                machine.water
                + random.uniform(-2.0, 2.0),
            ),
            2,
        )

        # --------------------------------------------------------
        # Operating profile
        # --------------------------------------------------------

        profile = cls._operating_profile(
            machine
        )

        machine.utilization = round(
            float(
                profile["utilization"]
            )
            + random.uniform(
                -2.0,
                2.0,
            ),
            1,
        )

        machine.utilization = max(
            0.0,
            min(
                100.0,
                machine.utilization,
            ),
        )

        machine.operating_state = str(
            profile["state"]
        )

        machine.production_critical = bool(
            profile["critical"]
        )

        # --------------------------------------------------------
        # Keep IDLE machines genuinely idle.
        #
        # They can still consume power/carbon, which is precisely
        # the condition CarbonTwin's sustainability optimizer
        # should identify.
        # --------------------------------------------------------

        if machine.operating_state == "IDLE":

            machine.utilization = min(
                machine.utilization,
                5.0,
            )

        elif machine.operating_state == "LOW_LOAD":

            machine.utilization = max(
                10.0,
                min(
                    machine.utilization,
                    50.0,
                ),
            )

        return machine