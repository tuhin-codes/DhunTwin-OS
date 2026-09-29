from collections import Counter

from app.models import Machine


class MachineRegistry:
    """
    Central registry and single source of truth for all
    machines currently loaded into CarbonTwin OS.
    """

    _machines: dict[str, Machine] = {}

    # --------------------------------------------------
    # Registration
    # --------------------------------------------------

    @classmethod
    def register(cls, machine: Machine):
        cls._machines[machine.id] = machine

    # --------------------------------------------------
    # Lookup
    # --------------------------------------------------

    @classmethod
    def get(cls, machine_id: str):
        return cls._machines.get(machine_id)

    # --------------------------------------------------
    # All machines
    # --------------------------------------------------

    @classmethod
    def all(cls) -> list[Machine]:
        return list(cls._machines.values())

    # --------------------------------------------------
    # Clear registry
    # --------------------------------------------------

    @classmethod
    def clear(cls):
        cls._machines.clear()

    # --------------------------------------------------
    # Machine types
    # --------------------------------------------------

    @classmethod
    def types(cls) -> list[str]:
        return sorted(
            {
                machine.type
                for machine in cls._machines.values()
            }
        )

    # --------------------------------------------------
    # Machine count
    # --------------------------------------------------

    @classmethod
    def count(cls) -> int:
        return len(cls._machines)

    # --------------------------------------------------
    # Count by machine type
    # --------------------------------------------------

    @classmethod
    def count_by_type(cls) -> dict[str, int]:

        counts = Counter(
            machine.type
            for machine in cls._machines.values()
        )

        return dict(counts)

    # --------------------------------------------------
    # Machines by type
    # --------------------------------------------------

    @classmethod
    def by_type(cls, machine_type: str) -> list[Machine]:

        return [
            machine
            for machine in cls._machines.values()
            if machine.type.lower() == machine_type.lower()
        ]

    # --------------------------------------------------
    # Machines by department
    # --------------------------------------------------

    @classmethod
    def by_department(cls, department: str) -> list[Machine]:

        return [
            machine
            for machine in cls._machines.values()
            if machine.department.lower() == department.lower()
        ]

    # --------------------------------------------------
    # Registry summary
    # --------------------------------------------------

    @classmethod
    def summary(cls) -> dict:

        return {
            "machine_count": cls.count(),
            "machine_types": cls.types(),
            "count_by_type": cls.count_by_type(),
            "departments": sorted(
                {
                    machine.department
                    for machine in cls._machines.values()
                }
            ),
        }