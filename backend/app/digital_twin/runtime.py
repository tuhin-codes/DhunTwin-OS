from pathlib import Path
import json

from app.digital_twin.registry import MachineRegistry
from app.digital_twin.simulator import MachineSimulator
from app.services.machine_service import MachineService
from app.models import Machine


class DigitalTwinRuntime:

    # ============================================================
    # Initialize Digital Twin
    # ============================================================

    @staticmethod
    def initialize():

        MachineRegistry.clear()

        # --------------------------------------------------------
        # Load machines from factory.json
        # --------------------------------------------------------

        machines = MachineService.get_all()

        # --------------------------------------------------------
        # Initialize simulated telemetry
        # --------------------------------------------------------

        initialized_machines: list[Machine] = []

        for machine in machines:

            initialized_machine = (
                MachineSimulator.initialize(
                    machine
                )
            )

            initialized_machines.append(
                initialized_machine
            )

        # --------------------------------------------------------
        # Restore technician assignments
        # --------------------------------------------------------

        assignments = (
            DigitalTwinRuntime
            ._load_technician_assignments()
        )

        for machine in initialized_machines:

            assignment = assignments.get(
                machine.id
            )

            if assignment is None:
                continue

            machine.current_technician = (
                assignment["technician_name"]
            )

            machine.current_ticket = (
                assignment["ticket_id"]
            )

        # --------------------------------------------------------
        # Register final machine state
        # --------------------------------------------------------

        for machine in initialized_machines:

            MachineRegistry.register(
                machine
            )

    # ============================================================
    # Load technician assignments
    # ============================================================

    @staticmethod
    def _load_technician_assignments() -> dict:

        data_file = (
            Path(__file__).resolve().parent.parent
            / "data"
            / "technicians.json"
        )

        if not data_file.exists():
            return {}

        try:

            with data_file.open(
                "r",
                encoding="utf-8",
            ) as file:

                data = json.load(file)

        except (
            json.JSONDecodeError,
            OSError,
        ):

            return {}

        technicians = data.get(
            "technicians",
            [],
        )

        if not isinstance(
            technicians,
            list,
        ):
            return {}

        assignments: dict = {}

        for technician in technicians:

            if not isinstance(
                technician,
                dict,
            ):
                continue

            technician_id = str(
                technician.get(
                    "id",
                    "",
                )
            ).strip()

            technician_name = str(
                technician.get(
                    "name",
                    "",
                )
            ).strip()

            if not technician_id or not technician_name:
                continue

            # ----------------------------------------------------
            # New assignments[] format
            # ----------------------------------------------------

            technician_assignments = (
                technician.get(
                    "assignments"
                )
            )

            if isinstance(
                technician_assignments,
                list,
            ):

                for assignment in (
                    technician_assignments
                ):

                    if not isinstance(
                        assignment,
                        dict,
                    ):
                        continue

                    machine_id = assignment.get(
                        "machine_id"
                    )

                    if not machine_id:
                        continue

                    ticket_id = assignment.get(
                        "ticket_id"
                    )

                    machine_id = str(
                        machine_id
                    ).strip()

                    if not machine_id:
                        continue

                    assignments[machine_id] = {
                        "technician_id":
                            technician_id,

                        "technician_name":
                            technician_name,

                        "ticket_id":
                            str(
                                ticket_id or ""
                            ).strip(),
                    }

            # ----------------------------------------------------
            # Legacy assigned_machine format
            # ----------------------------------------------------

            legacy_machine = technician.get(
                "assigned_machine"
            )

            legacy_ticket = technician.get(
                "current_ticket"
            )

            if legacy_machine:

                machine_id = str(
                    legacy_machine
                ).strip()

                if (
                    machine_id
                    and machine_id not in assignments
                ):

                    assignments[machine_id] = {
                        "technician_id":
                            technician_id,

                        "technician_name":
                            technician_name,

                        "ticket_id":
                            str(
                                legacy_ticket or ""
                            ).strip(),
                    }

        return assignments

    # ============================================================
    # Get all machines
    # ============================================================

    @staticmethod
    def machines() -> list[Machine]:

        return MachineRegistry.all()

    # ============================================================
    # Get machine
    # ============================================================

    @staticmethod
    def get(
        machine_id: str,
    ):

        return MachineRegistry.get(
            machine_id
        )

    # ============================================================
    # Machine control
    # ============================================================

    @staticmethod
    def control(
        machine_id: str,
        action: str,
    ):

        machine = (
            DigitalTwinRuntime.get(
                machine_id
            )
        )

        if machine is None:
            return None

        action = (
            action
            .lower()
            .strip()
        )

        if action == "start":

            machine.maintenance_status = (
                "Operational"
            )

        elif action == "maintenance":

            machine.maintenance_status = (
                "Maintenance"
            )

        elif action == "stop":

            machine.maintenance_status = (
                "Stopped"
            )

        elif action == "emergency":

            machine.maintenance_status = (
                "Emergency Stop"
            )

        else:

            raise ValueError(
                f"Unsupported machine control action: {action}"
            )

        return machine