import json
from pathlib import Path
from typing import Any

from app.digital_twin.runtime import DigitalTwinRuntime


class MaintenanceAssignmentService:

    DATA_FILE = (
        Path(__file__).resolve().parent.parent
        / "data"
        / "technicians.json"
    )

    # ========================================================
    # LOAD
    # ========================================================

    @classmethod
    def _load_data(cls) -> dict[str, Any]:

        if not cls.DATA_FILE.exists():
            return {
                "technicians": []
            }

        try:
            with cls.DATA_FILE.open(
                "r",
                encoding="utf-8",
            ) as file:

                data = json.load(file)

        except json.JSONDecodeError as error:

            raise ValueError(
                f"Invalid technicians.json: {error}"
            ) from error

        if not isinstance(data, dict):
            raise ValueError(
                "technicians.json must contain an object."
            )

        technicians = data.get(
            "technicians",
            [],
        )

        if not isinstance(
            technicians,
            list,
        ):

            raise ValueError(
                "'technicians' must be a list."
            )

        return data

    # ========================================================
    # SAVE
    # ========================================================

    @classmethod
    def _save_data(
        cls,
        data: dict[str, Any],
    ) -> None:

        with cls.DATA_FILE.open(
            "w",
            encoding="utf-8",
        ) as file:

            json.dump(
                data,
                file,
                indent=2,
            )

    # ========================================================
    # FIND TECHNICIAN
    # ========================================================

    @classmethod
    def _find_technician(
        cls,
        technicians: list[dict[str, Any]],
        technician_id: str,
    ) -> dict[str, Any] | None:

        target_id = str(
            technician_id
        )

        for technician in technicians:

            if str(
                technician.get(
                    "id",
                    "",
                )
            ) == target_id:

                return technician

        return None

    # ========================================================
    # NORMALIZE EXISTING ASSIGNMENTS
    #
    # IMPORTANT:
    #
    # assignments[] is now authoritative.
    #
    # We ONLY create assignments[] from legacy fields when
    # assignments is completely absent.
    #
    # We DO NOT recreate deleted assignments from stale
    # assigned_machine/current_ticket fields.
    # ========================================================

    @classmethod
    def _normalize_assignments(
        cls,
        technician: dict[str, Any],
    ) -> list[dict[str, str]]:

        if "assignments" in technician:

            assignments = technician.get(
                "assignments"
            )

            if not isinstance(
                assignments,
                list,
            ):

                assignments = []

        else:

            assignments = []

            legacy_machine = technician.get(
                "assigned_machine"
            )

            legacy_ticket = technician.get(
                "current_ticket"
            )

            if legacy_machine:

                assignments.append(
                    {
                        "machine_id":
                            str(
                                legacy_machine
                            ),

                        "ticket_id":
                            str(
                                legacy_ticket
                                or ""
                            ),
                    }
                )

        normalized: list[
            dict[str, str]
        ] = []

        seen_machine_ids: set[str] = set()

        for assignment in assignments:

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

            machine_id = str(
                machine_id
            )

            # Prevent duplicate machine assignments
            # inside one technician record.
            if machine_id in seen_machine_ids:
                continue

            ticket_id = assignment.get(
                "ticket_id"
            )

            normalized.append(
                {
                    "machine_id":
                        machine_id,

                    "ticket_id":
                        str(
                            ticket_id
                            or ""
                        ),
                }
            )

            seen_machine_ids.add(
                machine_id
            )

        technician[
            "assignments"
        ] = normalized

        return normalized

    # ========================================================
    # SYNC LEGACY FIELDS
    # ========================================================

    @classmethod
    def _sync_legacy_fields(
        cls,
        technician: dict[str, Any],
    ) -> None:

        assignments = (
            technician.get(
                "assignments",
                [],
            )
        )

        if not isinstance(
            assignments,
            list,
        ):

            assignments = []

        technician[
            "current_workload"
        ] = len(
            assignments
        )

        if not assignments:

            technician[
                "assigned_machine"
            ] = None

            technician[
                "current_ticket"
            ] = None

            return

        primary = assignments[0]

        technician[
            "assigned_machine"
        ] = primary.get(
            "machine_id"
        )

        technician[
            "current_ticket"
        ] = (
            primary.get(
                "ticket_id"
            )
            or None
        )

    # ========================================================
    # FIND MACHINE ASSIGNMENT
    # ========================================================

    @classmethod
    def _find_machine_assignment(
        cls,
        technician: dict[str, Any],
        machine_id: str,
    ) -> dict[str, str] | None:

        assignments = (
            cls._normalize_assignments(
                technician
            )
        )

        target_machine_id = str(
            machine_id
        )

        for assignment in assignments:

            if (
                str(
                    assignment.get(
                        "machine_id",
                        "",
                    )
                )
                == target_machine_id
            ):

                return assignment

        return None

    # ========================================================
    # REMOVE MACHINE ASSIGNMENT
    #
    # This function deliberately updates BOTH:
    #
    # assignments[]
    # assigned_machine/current_ticket
    #
    # so stale legacy state cannot remain.
    # ========================================================

    @classmethod
    def _remove_machine_assignment(
        cls,
        technician: dict[str, Any],
        machine_id: str,
    ) -> dict[str, Any] | None:

        assignments = (
            cls._normalize_assignments(
                technician
            )
        )

        target_machine_id = str(
            machine_id
        )

        removed = None

        remaining = []

        for assignment in assignments:

            assignment_machine_id = str(
                assignment.get(
                    "machine_id",
                    "",
                )
            )

            if (
                assignment_machine_id
                == target_machine_id
            ):

                if removed is None:

                    removed = assignment.copy()

                continue

            remaining.append(
                assignment
            )

        technician[
            "assignments"
        ] = remaining

        cls._sync_legacy_fields(
            technician
        )

        return removed

    # ========================================================
    # ASSIGN / REASSIGN
    # ========================================================

    @classmethod
    def assign(
        cls,
        machine_id: str,
        technician_id: str,
    ) -> dict[str, Any]:

        machine = (
            DigitalTwinRuntime.get(
                machine_id
            )
        )

        if machine is None:

            raise ValueError(
                f"Machine {machine_id} not found"
            )

        data = cls._load_data()

        technicians = data[
            "technicians"
        ]

        technician = (
            cls._find_technician(
                technicians,
                technician_id,
            )
        )

        if technician is None:

            raise ValueError(
                f"Technician {technician_id} "
                f"not found"
            )

        # ----------------------------------------------------
        # Normalize all existing technician assignment data.
        # ----------------------------------------------------

        for candidate in technicians:

            cls._normalize_assignments(
                candidate
            )

        # ----------------------------------------------------
        # Requested technician cannot already own machine.
        # ----------------------------------------------------

        existing_assignment = (
            cls._find_machine_assignment(
                technician,
                machine_id,
            )
        )

        if existing_assignment:

            raise ValueError(
                f"Technician {technician_id} "
                f"is already assigned to "
                f"machine {machine_id}"
            )

        # ----------------------------------------------------
        # Availability
        # ----------------------------------------------------

        availability = str(
            technician.get(
                "availability",
                "",
            )
        ).strip().lower()

        if availability != "available":

            raise ValueError(
                f"Technician {technician_id} "
                f"is not available"
            )

        # ----------------------------------------------------
        # Workload
        # ----------------------------------------------------

        assignments = technician.get(
            "assignments",
            [],
        )

        if not isinstance(
            assignments,
            list,
        ):

            assignments = []

        current_workload = len(
            assignments
        )

        max_workload = int(
            technician.get(
                "max_workload",
                1,
            )
            or 1
        )

        if current_workload >= max_workload:

            raise ValueError(
                f"Technician {technician_id} "
                f"has reached maximum workload "
                f"({current_workload}/"
                f"{max_workload})"
            )

        # ====================================================
        # DETERMINE EXISTING TICKET
        # ====================================================

        current_ticket = (
            machine.current_ticket
        )

        # ----------------------------------------------------
        # If runtime has no ticket, look through persisted
        # assignments.
        # ----------------------------------------------------

        if not current_ticket:

            for candidate in technicians:

                assignment = (
                    cls._find_machine_assignment(
                        candidate,
                        machine_id,
                    )
                )

                if assignment:

                    candidate_ticket = (
                        assignment.get(
                            "ticket_id"
                        )
                    )

                    if candidate_ticket:

                        current_ticket = (
                            candidate_ticket
                        )

                        break

        # ----------------------------------------------------
        # Generate ticket if genuinely new.
        # ----------------------------------------------------

        if not current_ticket:

            current_ticket = (
                f"MT-{machine_id}-1"
            )

        # ====================================================
        # RELEASE ALL EXISTING OWNERS
        # ====================================================

        released_technicians = []

        for candidate in technicians:

            # Requested technician has already been checked.
            if candidate is technician:
                continue

            removed = (
                cls._remove_machine_assignment(
                    candidate,
                    machine_id,
                )
            )

            if removed is not None:

                released_technicians.append(
                    {
                        "technician_id":
                            candidate.get(
                                "id"
                            ),

                        "technician":
                            candidate.get(
                                "name"
                            ),

                        "released":
                            True,

                        "machine_id":
                            machine_id,

                        "previous_ticket":
                            (
                                removed.get(
                                    "ticket_id"
                                )
                                or current_ticket
                            ),
                    }
                )

        # ====================================================
        # ADD TO NEW TECHNICIAN
        # ====================================================

        assignments = technician.get(
            "assignments",
            [],
        )

        if not isinstance(
            assignments,
            list,
        ):

            assignments = []

        assignments.append(
            {
                "machine_id":
                    str(machine_id),

                "ticket_id":
                    str(current_ticket),
            }
        )

        technician[
            "assignments"
        ] = assignments

        cls._sync_legacy_fields(
            technician
        )

        # ====================================================
        # UPDATE RUNTIME MACHINE
        # ====================================================

        machine.current_technician = (
            technician.get(
                "name"
            )
        )

        machine.current_ticket = (
            current_ticket
        )

        # ====================================================
        # SAVE
        # ====================================================

        cls._save_data(
            data
        )

        # ====================================================
        # VERIFY PERSISTED STATE
        #
        # Read the JSON directly from disk.
        # Do NOT normalize it here.
        # We want to verify the exact persisted structure.
        # ====================================================

        verification_data = (
            cls._load_data()
        )

        verification_technicians = (
            verification_data.get(
                "technicians",
                [],
            )
        )

        persisted_owner_ids = []

        for candidate in (
            verification_technicians
        ):

            assignments = candidate.get(
                "assignments",
                [],
            )

            if not isinstance(
                assignments,
                list,
            ):

                assignments = []

            for assignment in assignments:

                if not isinstance(
                    assignment,
                    dict,
                ):
                    continue

                if str(
                    assignment.get(
                        "machine_id",
                        "",
                    )
                ) == str(machine_id):

                    persisted_owner_ids.append(
                        str(
                            candidate.get(
                                "id"
                            )
                        )
                    )

                    break

        # ----------------------------------------------------
        # Exactly one persisted owner must exist.
        # ----------------------------------------------------

        expected_owner = str(
            technician_id
        )

        if persisted_owner_ids != [
            expected_owner
        ]:

            raise ValueError(
                "Maintenance assignment could not "
                "be persisted consistently. "
                f"Machine {machine_id} has "
                f"persisted owners: "
                f"{persisted_owner_ids}"
            )

        # ====================================================
        # RESPONSE
        # ====================================================

        is_reassignment = bool(
            released_technicians
        )

        previous_technician = (
            released_technicians[0]
            if released_technicians
            else None
        )

        return {

            "success":
                True,

            "action":
                (
                    "reassigned"
                    if is_reassignment
                    else "assigned"
                ),

            "message":
                (
                    "Maintenance engineer "
                    f"{'reassigned' if is_reassignment else 'assigned'} "
                    "successfully. Machine "
                    f"{machine_id} is now assigned to "
                    f"{technician.get('name')}."
                ),

            "machine":
                machine.model_dump(),

            "previous_technician":
                previous_technician,

            "released_technicians":
                released_technicians,

            "technician":
                technician,

            "ticket": {

                "id":
                    current_ticket,

                "machine_id":
                    machine_id,

                "technician_id":
                    technician_id,

                "technician_name":
                    technician.get(
                        "name"
                    ),

                "status":
                    (
                        "Reassigned"
                        if is_reassignment
                        else "Assigned"
                    ),
            },
        }