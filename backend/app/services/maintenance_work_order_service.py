from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.digital_twin.runtime import DigitalTwinRuntime
from app.services.ai_condition_service import AIConditionService
from app.services.maintenance_decision_service import (
    MaintenanceDecisionService,
)
from app.services.maintenance_service import MaintenanceService


class MaintenanceWorkOrderService:
    """
    CarbonTwin Maintenance Work Order Service.

    A work order is a SNAPSHOT of a maintenance decision.

    Architecture:

        Digital Twin
             |
             v
        AI Condition
             |
             v
        Maintenance Decision
             |
             v
        WORK ORDER SNAPSHOT
             |
             v
        Workforce recommendation
             |
             v
        Human confirmation

    The work order does NOT:
        - modify ML models
        - modify Digital Twin state
        - issue machine commands
        - automatically shut down machines
        - automatically assign personnel

    Once created, the decision/evidence snapshot is stable.
    """

    DATA_FILE = (
        Path(__file__).resolve().parent.parent
        / "data"
        / "maintenance_work_orders.json"
    )

    ACTIVE_STATUSES = {
        "PENDING_OPERATOR_REVIEW",
        "APPROVED",
        "ASSIGNMENT_PENDING",
        "ASSIGNED",
        "IN_PROGRESS",
    }

    # ============================================================
    # STORAGE
    # ============================================================

    @classmethod
    def _load_data(
        cls,
    ) -> dict[str, Any]:

        if not cls.DATA_FILE.exists():

            return {
                "work_orders": []
            }

        try:

            with cls.DATA_FILE.open(
                "r",
                encoding="utf-8",
            ) as file:

                data = json.load(file)

        except (
            OSError,
            json.JSONDecodeError,
        ):

            return {
                "work_orders": []
            }

        if not isinstance(
            data,
            dict,
        ):

            return {
                "work_orders": []
            }

        if not isinstance(
            data.get(
                "work_orders"
            ),
            list,
        ):

            data["work_orders"] = []

        return data

    @classmethod
    def _save_data(
        cls,
        data: dict[str, Any],
    ) -> None:

        cls.DATA_FILE.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with cls.DATA_FILE.open(
            "w",
            encoding="utf-8",
        ) as file:

            json.dump(
                data,
                file,
                indent=2,
            )

    # ============================================================
    # HELPERS
    # ============================================================

    @staticmethod
    def _now() -> str:

        return datetime.now(
            timezone.utc
        ).isoformat()

    @staticmethod
    def _upper(
        value: Any,
        default: str = "",
    ) -> str:

        if value is None:

            return default

        return str(
            value
        ).strip().upper()

    @classmethod
    def _derive_problem_type(
        cls,
        machine: Any,
    ) -> str:
        """
        Derive a concrete maintenance problem label from the
        same MaintenanceService problem-identification logic
        used by workforce recommendation.

        The label is stored in the immutable work-order snapshot
        so completed work can later be matched against historical
        maintenance records.

        No problem is invented from the completion note.
        """

        try:

            problem = (
                MaintenanceService.identify_problem(
                    machine
                )
            )

        except Exception:

            problem = {}

        if not isinstance(
            problem,
            dict,
        ):

            return "General Maintenance"

        problems = problem.get(
            "problems",
            [],
        )

        if not isinstance(
            problems,
            list,
        ):

            return "General Maintenance"

        for item in problems:

            value = str(
                item
            ).strip()

            if value:

                return value

        return "General Maintenance"

    @staticmethod
    def _priority_from_decision(
        decision: str,
        priority_score: int,
    ) -> str:

        if decision == (
            "IMMEDIATE_INTERVENTION"
        ):

            return "CRITICAL"

        if decision == (
            "SCHEDULE_MAINTENANCE"
        ):

            return "HIGH"

        if decision == (
            "PLAN_MAINTENANCE"
        ):

            return "MEDIUM"

        if priority_score >= 75:

            return "CRITICAL"

        if priority_score >= 50:

            return "HIGH"

        if priority_score >= 25:

            return "MEDIUM"

        return "LOW"

    # ============================================================
    # WORK ORDER ID
    # ============================================================

    @classmethod
    def _next_work_order_id(
        cls,
        work_orders: list[dict[str, Any]],
    ) -> str:

        highest = 0

        for work_order in work_orders:

            work_order_id = str(
                work_order.get(
                    "work_order_id",
                    "",
                )
            )

            if not work_order_id.startswith(
                "WO-"
            ):

                continue

            try:

                number = int(
                    work_order_id[3:]
                )

                highest = max(
                    highest,
                    number,
                )

            except ValueError:

                continue

        return f"WO-{highest + 1:04d}"

    # ============================================================
    # ACTIVE WORK ORDER
    # ============================================================

    @classmethod
    def _is_active(
        cls,
        work_order: dict[str, Any],
    ) -> bool:

        return (
            cls._upper(
                work_order.get(
                    "status"
                )
            )
            in cls.ACTIVE_STATUSES
        )

    @classmethod
    def get_active_for_machine(
        cls,
        machine_id: str,
    ) -> dict[str, Any] | None:

        data = cls._load_data()

        target = str(
            machine_id
        )

        for work_order in reversed(
            data["work_orders"]
        ):

            if str(
                work_order.get(
                    "machine_id",
                    "",
                )
            ) != target:

                continue

            if cls._is_active(
                work_order
            ):

                return work_order

        return None

    # ============================================================
    # ATOMIC CURRENT-DECISION CREATION
    # ============================================================

    @classmethod
    def create_from_current_decision(
        cls,
        machine_id: str,
    ) -> dict[str, Any]:
        """
        Evaluate the current AI condition and maintenance
        decision exactly once, then immediately create the
        work-order snapshot from that exact decision.

        This prevents the live Digital Twin simulation from
        changing the decision between a GET request and a POST
        request.

        Flow:

            Current Digital Twin
                    |
                    v
            AIConditionService
                    |
                    v
            MaintenanceDecisionService
                    |
                    v
            create_from_decision()
                    |
                    v
            Frozen Work Order
        """

        machine = (
            DigitalTwinRuntime.get(
                machine_id
            )
        )

        if machine is None:

            raise ValueError(
                f"Machine {machine_id} not found."
            )

        # ========================================================
        # ONE AI CONDITION EVALUATION
        # ========================================================

        ai_condition = (
            AIConditionService.analyze(
                machine_id
            )
        )

        if not ai_condition.get(
            "available",
            False,
        ):

            return {
                "available": False,

                "created": False,

                "reused": False,

                "status":
                    "AI_CONDITION_UNAVAILABLE",

                "machine_id":
                    str(machine_id),

                "reason":
                    ai_condition.get(
                        "reason",
                        "AI condition unavailable.",
                    ),
            }

        # ========================================================
        # ONE MAINTENANCE DECISION EVALUATION
        # ========================================================

        decision = (
            MaintenanceDecisionService.analyze(
                ai_condition
            )
        )

        if not isinstance(
            decision,
            dict,
        ):

            raise ValueError(
                "Maintenance decision service "
                "returned an invalid response."
            )

        # ========================================================
        # IMMEDIATELY CREATE SNAPSHOT
        # ========================================================

        return cls.create_from_decision(
            machine_id,
            decision,
        )

    # ============================================================
    # CREATE FROM DECISION SNAPSHOT
    # ============================================================

    @classmethod
    def create_from_decision(
        cls,
        machine_id: str,
        decision: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Create a work order from an already evaluated
        MaintenanceDecisionService response.

        IMPORTANT:

        This method does NOT call AIConditionService.

        The supplied decision becomes the authoritative
        snapshot for the work order.
        """

        machine = (
            DigitalTwinRuntime.get(
                machine_id
            )
        )

        if machine is None:

            raise ValueError(
                f"Machine {machine_id} not found."
            )

        if not isinstance(
            decision,
            dict,
        ):

            raise ValueError(
                "Maintenance decision must be a dictionary."
            )

        if not decision.get(
            "available",
            False,
        ):

            return {
                "available": False,

                "created": False,

                "reused": False,

                "status":
                    "DECISION_UNAVAILABLE",

                "machine_id":
                    str(machine_id),

                "reason":
                    decision.get(
                        "reason",
                        "Maintenance decision unavailable.",
                    ),
            }

        maintenance_decision = str(
            decision.get(
                "decision",
                "REVIEW_REQUIRED",
            )
        ).strip().upper()

        # ========================================================
        # NO MAINTENANCE REQUIRED
        # ========================================================

        if maintenance_decision == (
            "CONTINUE_MONITORING"
        ):

            return {
                "available": True,

                "created": False,

                "reused": False,

                "status":
                    "NO_WORK_ORDER_REQUIRED",

                "machine_id":
                    str(machine_id),

                "decision":
                    maintenance_decision,

                "reason":
                    decision.get(
                        "decision_reason",
                        (
                            "No maintenance intervention "
                            "is currently required."
                        ),
                    ),
            }

        # ========================================================
        # EXISTING ACTIVE WORK ORDER
        # ========================================================

        active_work_order = (
            cls.get_active_for_machine(
                machine_id
            )
        )

        if active_work_order is not None:

            # IMPORTANT:
            #
            # Never update the existing snapshot with new
            # live AI evidence.
            #
            # The work order represents the condition at
            # the time it was created.

            return {
                "available": True,

                "created": False,

                "reused": True,

                "status":
                    "ACTIVE_WORK_ORDER_REUSED",

                "work_order":
                    active_work_order,
            }

        # ========================================================
        # WORKFORCE
        # ========================================================

        workforce = decision.get(
            "workforce",
            {},
        )

        if not isinstance(
            workforce,
            dict,
        ):

            workforce = {}

        recommended_role = str(
            workforce.get(
                "recommended_role",
                "NONE",
            )
        )

        # ========================================================
        # PERSONNEL RECOMMENDATION
        # ========================================================

        recommendation_result = (
            MaintenanceService.recommend(
                machine,
                limit=5,
            )
        )

        if not isinstance(
            recommendation_result,
            dict,
        ):

            recommendation_result = {}

        recommendations = (
            recommendation_result.get(
                "recommendations",
                [],
            )
        )

        if not isinstance(
            recommendations,
            list,
        ):

            recommendations = []

        recommended_person = (
            recommendations[0]
            if recommendations
            else None
        )

        # ========================================================
        # PRIORITY
        # ========================================================

        try:

            priority_score = int(
                decision.get(
                    "priority_score",
                    0,
                )
                or 0
            )

        except (
            TypeError,
            ValueError,
        ):

            priority_score = 0

        priority = (
            cls._priority_from_decision(
                maintenance_decision,
                priority_score,
            )
        )

        # ========================================================
        # WORK ORDER TYPE
        # ========================================================

        if maintenance_decision == (
            "IMMEDIATE_INTERVENTION"
        ):

            work_order_type = (
                "URGENT_MAINTENANCE"
            )

        elif maintenance_decision == (
            "SCHEDULE_MAINTENANCE"
        ):

            work_order_type = (
                "PREDICTIVE_MAINTENANCE"
            )

        elif maintenance_decision == (
            "PLAN_MAINTENANCE"
        ):

            work_order_type = (
                "PLANNED_MAINTENANCE"
            )

        else:

            work_order_type = (
                "MAINTENANCE_REVIEW"
            )

        # ========================================================
        # OPERATIONAL RECOMMENDATION
        # ========================================================

        operational = (
            decision.get(
                "operational_recommendation",
                {},
            )
        )

        if not isinstance(
            operational,
            dict,
        ):

            operational = {}

        # ========================================================
        # CREATE SNAPSHOT
        # ========================================================

        data = cls._load_data()

        work_orders = data[
            "work_orders"
        ]

        work_order_id = (
            cls._next_work_order_id(
                work_orders
            )
        )

        now = cls._now()

        # ========================================================
        # IMMUTABLE WORK ORDER SNAPSHOT
        # ========================================================

        work_order = {

            # ----------------------------------------------------
            # Identity
            # ----------------------------------------------------

            "work_order_id":
                work_order_id,

            "machine_id":
                str(machine_id),

            "machine_type":
                str(
                    getattr(
                        machine,
                        "type",
                        decision.get(
                            "machine_type"
                        ),
                    )
                ),

            "machine_name":
                str(
                    getattr(
                        machine,
                        "name",
                        machine_id,
                    )
                ),

            "problem_type":
                cls._derive_problem_type(
                    machine
                ),

            # ----------------------------------------------------
            # Creation / decision snapshot
            # ----------------------------------------------------

            "created_at":
                now,

            "decision_snapshot_at":
                decision.get(
                    "timestamp",
                    now,
                ),

            "decision":
                maintenance_decision,

            "decision_reason":
                decision.get(
                    "decision_reason",
                    "",
                ),

            "priority":
                priority,

            "priority_score":
                priority_score,

            "type":
                work_order_type,

            "reason":
                decision.get(
                    "decision_reason",
                    (
                        "Maintenance intervention "
                        "recommended."
                    ),
                ),

            # ----------------------------------------------------
            # Operational recommendation
            # ----------------------------------------------------

            "recommended_state":
                operational.get(
                    "recommended_state",
                    "REVIEW",
                ),

            # ----------------------------------------------------
            # Workforce snapshot
            # ----------------------------------------------------

            "workforce":
                {
                    "engineer_required":
                        bool(
                            workforce.get(
                                "engineer_required",
                                False,
                            )
                        ),

                    "technician_required":
                        bool(
                            workforce.get(
                                "technician_required",
                                False,
                            )
                        ),

                    "recommended_role":
                        recommended_role,

                    "reason":
                        workforce.get(
                            "reason",
                            "",
                        ),
                },

            "recommended_person":
                recommended_person,

            "candidate_count":
                len(
                    recommendations
                ),

            # ----------------------------------------------------
            # Evidence snapshot
            # ----------------------------------------------------

            "evidence":
                decision.get(
                    "evidence",
                    {},
                ),

            "explanation":
                decision.get(
                    "explanation",
                    [],
                ),

            # ----------------------------------------------------
            # Human control
            # ----------------------------------------------------

            "human_control":
                {
                    "operator_confirmation_required":
                        True,

                    "automatic_assignment":
                        False,

                    "automatic_shutdown":
                        False,

                    "automatic_machine_command":
                        False,
                },

            # ----------------------------------------------------
            # Assignment
            # ----------------------------------------------------

            "assignment":
                {
                    "status":
                        "PENDING_OPERATOR_REVIEW",

                    "technician_id":
                        None,

                    "technician":
                        None,

                    "assigned_at":
                        None,
                },

            # ----------------------------------------------------
            # Lifecycle
            # ----------------------------------------------------

            "status":
                "PENDING_OPERATOR_REVIEW",
        }

        work_orders.append(
            work_order
        )

        data[
            "work_orders"
        ] = work_orders

        cls._save_data(
            data
        )

        # ========================================================
        # RESPONSE
        # ========================================================

        return {
            "available": True,

            "created": True,

            "reused": False,

            "status":
                "WORK_ORDER_CREATED",

            "work_order":
                work_order,
        }

    # ============================================================
    # BACKWARD-COMPATIBLE CREATE
    # ============================================================

    @classmethod
    def create_from_machine(
        cls,
        machine_id: str,
    ) -> dict[str, Any]:
        """
        Convenience method.

        Evaluates AI condition once, evaluates the maintenance
        decision once, and passes that exact decision into
        create_from_decision().

        The newer atomic endpoint should be preferred by the UI.
        """

        machine = (
            DigitalTwinRuntime.get(
                machine_id
            )
        )

        if machine is None:

            raise ValueError(
                f"Machine {machine_id} not found."
            )

        ai_condition = (
            AIConditionService.analyze(
                machine_id
            )
        )

        if not ai_condition.get(
            "available",
            False,
        ):

            return {
                "available": False,

                "created": False,

                "reused": False,

                "status":
                    "AI_CONDITION_UNAVAILABLE",

                "machine_id":
                    str(machine_id),

                "reason":
                    ai_condition.get(
                        "reason",
                        "AI condition unavailable.",
                    ),
            }

        decision = (
            MaintenanceDecisionService.analyze(
                ai_condition
            )
        )

        return cls.create_from_decision(
            machine_id,
            decision,
        )

    # ============================================================
    # LIST
    # ============================================================

    @classmethod
    def list_work_orders(
        cls,
        machine_id: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:

        data = cls._load_data()

        result = []

        for work_order in data[
            "work_orders"
        ]:

            if (
                machine_id is not None
                and str(
                    work_order.get(
                        "machine_id",
                        "",
                    )
                )
                != str(machine_id)
            ):

                continue

            if (
                status is not None
                and cls._upper(
                    work_order.get(
                        "status"
                    )
                )
                != cls._upper(
                    status
                )
            ):

                continue

            result.append(
                work_order
            )

        return list(
            reversed(
                result
            )
        )

    # ============================================================
    # GET
    # ============================================================

    @classmethod
    def get_work_order(
        cls,
        work_order_id: str,
    ) -> dict[str, Any] | None:

        data = cls._load_data()

        for work_order in data[
            "work_orders"
        ]:

            if str(
                work_order.get(
                    "work_order_id",
                    "",
                )
            ) == str(
                work_order_id
            ):

                return work_order

        return None

    # ============================================================
    # APPROVE
    # ============================================================

    @classmethod
    def approve(
        cls,
        work_order_id: str,
    ) -> dict[str, Any]:

        data = cls._load_data()

        work_order = None

        for candidate in data[
            "work_orders"
        ]:

            if str(
                candidate.get(
                    "work_order_id",
                    "",
                )
            ) == str(
                work_order_id
            ):

                work_order = candidate

                break

        if work_order is None:

            raise ValueError(
                f"Work order {work_order_id} not found."
            )

        if cls._upper(
            work_order.get(
                "status"
            )
        ) != (
            "PENDING_OPERATOR_REVIEW"
        ):

            raise ValueError(
                "Only work orders pending operator "
                "review can be approved."
            )

        work_order[
            "status"
        ] = "ASSIGNMENT_PENDING"

        work_order[
            "approved_at"
        ] = cls._now()

        work_order[
            "human_control"
        ][
            "operator_confirmation_required"
        ] = False

        work_order[
            "assignment"
        ][
            "status"
        ] = "PENDING_ASSIGNMENT"

        cls._save_data(
            data
        )

        return work_order

    # ============================================================
    # ASSIGN
    # ============================================================

    @classmethod
    def mark_assigned(
        cls,
        work_order_id: str,
        technician_id: str,
        technician_name: str | None = None,
    ) -> dict[str, Any]:

        data = cls._load_data()

        work_order = None

        for candidate in data[
            "work_orders"
        ]:

            if str(
                candidate.get(
                    "work_order_id",
                    "",
                )
            ) == str(
                work_order_id
            ):

                work_order = candidate

                break

        if work_order is None:

            raise ValueError(
                f"Work order {work_order_id} not found."
            )

        status = cls._upper(
            work_order.get(
                "status"
            )
        )

        if status not in {
            "ASSIGNMENT_PENDING",
            "APPROVED",
        }:

            raise ValueError(
                "Work order is not ready for assignment."
            )

        # ========================================================
        # ROLE VALIDATION
        #
        # The role required by the frozen maintenance decision
        # must be respected at assignment time.
        #
        # AI recommends the workforce role.
        # The operator selects the person.
        # This service validates that the selected person's role
        # is compatible with the work-order requirement.
        # ========================================================

        workforce = work_order.get(
            "workforce",
            {},
        )

        if not isinstance(
            workforce,
            dict,
        ):

            workforce = {}

        required_role = cls._upper(
            workforce.get(
                "recommended_role",
                "NONE",
            )
        )

        # ========================================================
        # FIND SELECTED PERSON IN CURRENT WORKFORCE
        # ========================================================

        selected_worker = None

        try:

            machine = DigitalTwinRuntime.get(
                str(
                    work_order.get(
                        "machine_id",
                        "",
                    )
                )
            )

            if machine is not None:

                recommendation_result = (
                    MaintenanceService.recommend(
                        machine,
                        limit=100,
                    )
                )

                if isinstance(
                    recommendation_result,
                    dict,
                ):

                    recommendations = (
                        recommendation_result.get(
                            "recommendations",
                            [],
                        )
                    )

                    if isinstance(
                        recommendations,
                        list,
                    ):

                        for candidate in recommendations:

                            if not isinstance(
                                candidate,
                                dict,
                            ):

                                continue

                            candidate_id = str(
                                candidate.get(
                                    "technician_id",
                                    candidate.get(
                                        "id",
                                        "",
                                    ),
                                )
                            )

                            if candidate_id == str(
                                technician_id
                            ):

                                selected_worker = candidate

                                break

        except Exception:
            # Assignment validation must not fail merely because
            # workforce recommendation data is temporarily
            # unavailable. The stored work-order role remains the
            # authoritative requirement.
            selected_worker = None

        # ========================================================
        # ROLE CHECK
        # ========================================================

        if required_role in {
            "TECHNICIAN",
            "ENGINEER",
        }:

            if selected_worker is None:

                raise ValueError(
                    "Selected worker could not be verified "
                    "against the current qualified workforce."
                )

            worker_role_type = cls._upper(
                selected_worker.get(
                    "role_type",
                    "",
                )
            )

            if not worker_role_type:

                raw_role = cls._upper(
                    selected_worker.get(
                        "role",
                        "",
                    )
                )

                if "ENGINEER" in raw_role:

                    worker_role_type = "ENGINEER"

                elif "TECHNICIAN" in raw_role:

                    worker_role_type = "TECHNICIAN"

            if worker_role_type != required_role:

                raise ValueError(
                    "Selected worker role does not match "
                    f"the work-order requirement. Required: "
                    f"{required_role}; selected: "
                    f"{worker_role_type or 'UNKNOWN'}."
                )

        elif required_role == "ENGINEER_AND_TECHNICIAN":

            if selected_worker is None:

                raise ValueError(
                    "Selected worker could not be verified "
                    "against the current qualified workforce."
                )

            worker_role_type = cls._upper(
                selected_worker.get(
                    "role_type",
                    "",
                )
            )

            if not worker_role_type:

                raw_role = cls._upper(
                    selected_worker.get(
                        "role",
                        "",
                    )
                )

                if "ENGINEER" in raw_role:

                    worker_role_type = "ENGINEER"

                elif "TECHNICIAN" in raw_role:

                    worker_role_type = "TECHNICIAN"

            if worker_role_type not in {
                "ENGINEER",
                "TECHNICIAN",
            }:

                raise ValueError(
                    "Selected worker must be a qualified "
                    "engineer or technician for this "
                    "combined intervention."
                )

        elif required_role == "NONE":

            raise ValueError(
                "This work order does not require workforce "
                "assignment."
            )

        work_order[
            "status"
        ] = "ASSIGNED"

        assigned_role = None

        if selected_worker is not None:

            assigned_role = (
                selected_worker.get(
                    "role_type"
                )
                or selected_worker.get(
                    "role"
                )
            )

        work_order[
            "assignment"
        ] = {
            "status":
                "ASSIGNED",

            "technician_id":
                str(technician_id),

            "technician":
                technician_name
                or (
                    selected_worker.get(
                        "technician"
                    )
                    if selected_worker
                    else None
                ),

            "role_type":
                assigned_role,

            "required_role":
                required_role,

            "assigned_at":
                cls._now(),
        }

        cls._save_data(
            data
        )

        return work_order

    # ============================================================
    # START
    # ============================================================

    @classmethod
    def start(
        cls,
        work_order_id: str,
    ) -> dict[str, Any]:

        data = cls._load_data()

        work_order = None

        for candidate in data[
            "work_orders"
        ]:

            if str(
                candidate.get(
                    "work_order_id",
                    "",
                )
            ) == str(
                work_order_id
            ):

                work_order = candidate

                break

        if work_order is None:

            raise ValueError(
                f"Work order {work_order_id} not found."
            )

        if cls._upper(
            work_order.get(
                "status"
            )
        ) != "ASSIGNED":

            raise ValueError(
                "Only assigned work orders can be started."
            )

        work_order[
            "status"
        ] = "IN_PROGRESS"

        work_order[
            "started_at"
        ] = cls._now()

        cls._save_data(
            data
        )

        return work_order

    # ============================================================
    # MAINTENANCE HISTORY
    # ============================================================

    HISTORY_FILE = (
        Path(__file__).resolve().parent.parent
        / "data"
        / "maintenance_history.json"
    )

    @classmethod
    def _load_history(
        cls,
    ) -> dict[str, Any]:

        if not cls.HISTORY_FILE.exists():

            return {
                "maintenance_history": []
            }

        try:

            with cls.HISTORY_FILE.open(
                "r",
                encoding="utf-8",
            ) as file:

                data = json.load(file)

        except (
            OSError,
            json.JSONDecodeError,
        ):

            return {
                "maintenance_history": []
            }

        if not isinstance(
            data,
            dict,
        ):

            return {
                "maintenance_history": []
            }

        if not isinstance(
            data.get(
                "maintenance_history"
            ),
            list,
        ):

            data["maintenance_history"] = []

        return data

    @classmethod
    def _save_history(
        cls,
        data: dict[str, Any],
    ) -> None:

        cls.HISTORY_FILE.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with cls.HISTORY_FILE.open(
            "w",
            encoding="utf-8",
        ) as file:

            json.dump(
                data,
                file,
                indent=2,
            )

    @classmethod
    def _record_maintenance_history(
        cls,
        work_order: dict[str, Any],
        successful: bool,
        repeat_failure: bool,
    ) -> dict[str, Any]:

        history_data = cls._load_history()

        assignment = work_order.get(
            "assignment",
            {},
        )

        if not isinstance(
            assignment,
            dict,
        ):

            assignment = {}

        technician_id = (
            assignment.get(
                "technician_id"
            )
        )

        technician_name = (
            assignment.get(
                "technician"
            )
        )

        role_type = (
            assignment.get(
                "role_type"
            )
        )

        machine_id = str(
            work_order.get(
                "machine_id",
                "",
            )
        )

        machine_type = str(
            work_order.get(
                "machine_type",
                "",
            )
        )

        # Prevent duplicate history records if the same
        # completed work order is ever processed again.
        for existing in history_data[
            "maintenance_history"
        ]:

            if not isinstance(
                existing,
                dict,
            ):

                continue

            if str(
                existing.get(
                    "work_order_id",
                    "",
                )
            ) == str(
                work_order.get(
                    "work_order_id",
                    "",
                )
            ):

                return existing

        history_record = {
            "work_order_id":
                work_order.get(
                    "work_order_id"
                ),

            "machine_id":
                machine_id,

            "machine_type":
                machine_type,

            "problem_type":
                work_order.get(
                    "problem_type",
                    "General Maintenance",
                ),

            "technician_id":
                technician_id,

            "technician":
                technician_name,

            "role_type":
                role_type,

            "decision":
                work_order.get(
                    "decision"
                ),

            "priority":
                work_order.get(
                    "priority"
                ),

            "priority_score":
                work_order.get(
                    "priority_score"
                ),

            "maintenance_type":
                work_order.get(
                    "type",
                    "Maintenance",
                ),

            "successful":
                bool(successful),

            "repeat_failure":
                bool(repeat_failure),

            "completion_note":
                work_order.get(
                    "completion_note",
                    "",
                ),

            "completed_at":
                work_order.get(
                    "completed_at"
                ),

            "recorded_at":
                cls._now(),
        }

        history_data[
            "maintenance_history"
        ].append(
            history_record
        )

        cls._save_history(
            history_data
        )

        return history_record

    # ============================================================
    # COMPLETE
    # ============================================================

    @classmethod
    def complete(
        cls,
        work_order_id: str,
        completion_note: str = "",
        successful: bool = True,
        repeat_failure: bool = False,
    ) -> dict[str, Any]:

        data = cls._load_data()

        work_order = None

        for candidate in data[
            "work_orders"
        ]:

            if str(
                candidate.get(
                    "work_order_id",
                    "",
                )
            ) == str(
                work_order_id
            ):

                work_order = candidate

                break

        if work_order is None:

            raise ValueError(
                f"Work order {work_order_id} not found."
            )

        if cls._upper(
            work_order.get(
                "status"
            )
        ) != "IN_PROGRESS":

            raise ValueError(
                "Only work orders in progress can be completed."
            )

        # A repeated failure should never be recorded as a
        # successful maintenance outcome.
        if repeat_failure:

            successful = False

        completed_at = cls._now()

        work_order[
            "status"
        ] = "COMPLETED"

        work_order[
            "completed_at"
        ] = completed_at

        work_order[
            "completion_note"
        ] = str(
            completion_note
        )

        work_order[
            "completion_outcome"
        ] = {
            "successful":
                bool(successful),

            "repeat_failure":
                bool(repeat_failure),

            "recorded_at":
                completed_at,
        }

        work_order[
            "assignment"
        ][
            "status"
        ] = "COMPLETED"

        # Persist the completed work order first. This guarantees
        # the operational lifecycle is stored before historical
        # learning evidence is written.
        cls._save_data(
            data
        )

        history_record = (
            cls._record_maintenance_history(
                work_order,
                successful=bool(
                    successful
                ),
                repeat_failure=bool(
                    repeat_failure
                ),
            )
        )

        # Expose the historical record in the response so the
        # operator/API caller can verify exactly what was recorded.
        work_order[
            "history_record"
        ] = history_record

        return work_order

    # ============================================================
    # CANCEL
    # ============================================================

    @classmethod
    def cancel(
        cls,
        work_order_id: str,
        reason: str = "",
    ) -> dict[str, Any]:

        data = cls._load_data()

        work_order = None

        for candidate in data[
            "work_orders"
        ]:

            if str(
                candidate.get(
                    "work_order_id",
                    "",
                )
            ) == str(
                work_order_id
            ):

                work_order = candidate

                break

        if work_order is None:

            raise ValueError(
                f"Work order {work_order_id} not found."
            )

        status = cls._upper(
            work_order.get(
                "status"
            )
        )

        if status in {
            "COMPLETED",
            "CANCELLED",
        }:

            raise ValueError(
                "Work order is already closed."
            )

        work_order[
            "status"
        ] = "CANCELLED"

        work_order[
            "cancelled_at"
        ] = cls._now()

        work_order[
            "cancellation_reason"
        ] = str(
            reason
        )

        cls._save_data(
            data
        )

        return work_order