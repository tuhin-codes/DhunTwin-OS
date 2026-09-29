from __future__ import annotations

from typing import Any

from app.digital_twin.runtime import DigitalTwinRuntime


class OptimizationService:
    """
    CarbonTwin factory carbon optimization engine.

    Decision-support / what-if optimization only.

    The optimizer does NOT directly control physical machinery.

    It evaluates:
        - carbon
        - power
        - energy
        - efficiency
        - health
        - utilization
        - operating state
        - idle consumption
        - production criticality

    Requested targets are never assumed to be achievable.

    Target classifications:

        REALISTIC
        AGGRESSIVE
        INFEASIBLE
    """

    MAX_RPM_REDUCTION_PERCENT = 10.0
    MIN_RPM_PERCENT = 0.80

    MAX_OPERATIONAL_REDUCTION_PERCENT = 35.0

    AGGRESSIVE_REDUCTION_THRESHOLD = 25.0

    # ============================================================
    # SAFE HELPERS
    # ============================================================

    @staticmethod
    def _safe_float(
        value: Any,
        default: float = 0.0,
    ) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_int(
        value: Any,
        default: int = 0,
    ) -> int:
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _machine_value(
        machine: Any,
        names: tuple[str, ...],
        default: Any = None,
    ) -> Any:

        for name in names:

            try:
                value = getattr(
                    machine,
                    name,
                    None,
                )
            except Exception:
                value = None

            if value is not None:
                return value

        return default

    # ============================================================
    # MACHINE STATE
    # ============================================================

    @classmethod
    def _utilization(
        cls,
        machine: Any,
    ) -> float:

        value = cls._machine_value(
            machine,
            (
                "utilization",
                "utilization_percent",
                "load_percent",
                "load",
            ),
            None,
        )

        if value is None:
            return 100.0

        return max(
            0.0,
            min(
                100.0,
                cls._safe_float(
                    value,
                    100.0,
                ),
            ),
        )

    @classmethod
    def _operating_state(
        cls,
        machine: Any,
    ) -> str:

        value = cls._machine_value(
            machine,
            (
                "status",
                "state",
                "operating_state",
                "machine_state",
            ),
            None,
        )

        if value is None:
            return "RUNNING"

        return str(
            value
        ).strip().upper()

    @classmethod
    def _is_idle(
        cls,
        machine: Any,
    ) -> bool:

        state = cls._operating_state(
            machine
        )

        if state in {
            "IDLE",
            "STANDBY",
            "STOPPED",
            "INACTIVE",
            "OFF",
        }:
            return True

        return (
            cls._utilization(machine)
            <= 5.0
        )

    @classmethod
    def _is_production_critical(
        cls,
        machine: Any,
    ) -> bool:

        value = cls._machine_value(
            machine,
            (
                "production_critical",
                "production_criticality",
                "critical",
                "critical_machine",
                "is_critical",
            ),
            False,
        )

        if isinstance(
            value,
            str,
        ):
            return (
                value.strip().lower()
                in {
                    "true",
                    "yes",
                    "critical",
                    "high",
                }
            )

        return bool(value)

    # ============================================================
    # MACHINE PRIORITY
    # ============================================================

    @classmethod
    def _machine_priority(
        cls,
        machine: Any,
    ) -> float:

        carbon = cls._safe_float(
            getattr(
                machine,
                "carbon",
                0.0,
            )
        )

        power = cls._safe_float(
            getattr(
                machine,
                "power",
                0.0,
            )
        )

        efficiency = cls._safe_float(
            getattr(
                machine,
                "efficiency",
                0.0,
            )
        )

        health = cls._safe_float(
            getattr(
                machine,
                "health_score",
                100.0,
            ),
            100.0,
        )

        utilization = cls._utilization(
            machine
        )

        efficiency_factor = max(
            0.0,
            100.0 - efficiency,
        )

        score = (
            carbon * 5.0
            + power * 0.5
            + efficiency_factor * 2.0
        )

        if cls._is_idle(machine):

            score += (
                carbon * 8.0
                + power * 2.0
                + 500.0
            )

        elif utilization < 50.0:

            score += (
                carbon * 2.0
            )

        if health < 65:

            score -= 1000.0

        elif health < 75:

            score -= 500.0

        if cls._is_production_critical(
            machine
        ):

            score -= (
                carbon * 6.0
                + 500.0
            )

        return score

    # ============================================================
    # SAFE OPTIMIZATION CAPACITY
    # ============================================================

    @classmethod
    def _machine_reduction_capacity(
        cls,
        machine: Any,
    ) -> float:

        utilization = cls._utilization(
            machine
        )

        health = cls._safe_float(
            getattr(
                machine,
                "health_score",
                100.0,
            ),
            100.0,
        )

        if cls._is_idle(machine):

            capacity = 0.20

        elif utilization <= 25.0:

            capacity = 0.15

        elif utilization <= 50.0:

            capacity = 0.10

        else:

            capacity = 0.06

        if cls._is_production_critical(
            machine
        ):

            capacity *= 0.40

        if health < 65:

            capacity *= 0.25

        elif health < 75:

            capacity *= 0.50

        elif health < 85:

            capacity *= 0.75

        return max(
            0.0,
            min(
                capacity,
                cls.MAX_OPERATIONAL_REDUCTION_PERCENT
                / 100.0,
            ),
        )

    # ============================================================
    # MACHINE WHAT-IF MODEL
    # ============================================================

    @classmethod
    def _calculate_machine_plan(
        cls,
        machine: Any,
        reduction_fraction: float,
    ) -> dict[str, Any]:

        machine_id = getattr(
            machine,
            "id",
            "",
        )

        machine_name = getattr(
            machine,
            "name",
            "",
        )

        machine_type = getattr(
            machine,
            "type",
            "",
        )

        department = getattr(
            machine,
            "department",
            "",
        )

        location = getattr(
            machine,
            "location",
            "",
        )

        current_rpm = cls._safe_int(
            getattr(
                machine,
                "rpm",
                0,
            )
        )

        current_power = cls._safe_float(
            getattr(
                machine,
                "power",
                0.0,
            )
        )

        current_carbon = cls._safe_float(
            getattr(
                machine,
                "carbon",
                0.0,
            )
        )

        current_energy = cls._safe_float(
            getattr(
                machine,
                "energy",
                0.0,
            )
        )

        current_efficiency = cls._safe_float(
            getattr(
                machine,
                "efficiency",
                0.0,
            )
        )

        health = cls._safe_float(
            getattr(
                machine,
                "health_score",
                100.0,
            ),
            100.0,
        )

        utilization = cls._utilization(
            machine
        )

        operating_state = (
            cls._operating_state(
                machine
            )
        )

        idle = cls._is_idle(
            machine
        )

        production_critical = (
            cls._is_production_critical(
                machine
            )
        )

        capacity = (
            cls._machine_reduction_capacity(
                machine
            )
        )

        requested_fraction = max(
            0.0,
            min(
                capacity,
                cls._safe_float(
                    reduction_fraction
                ),
            ),
        )

        effective_fraction = min(
            requested_fraction,
            capacity,
        )

        # ========================================================
        # IDLE / STANDBY
        # ========================================================

        if idle:

            action = (
                "Reduce unnecessary idle or "
                "standby operation before changing "
                "production speed."
            )

            power_factor = max(
                0.50,
                1.0 - effective_fraction,
            )

            carbon_factor = (
                0.35
                + 0.65 * power_factor
            )

            recommended_rpm = (
                current_rpm
            )

        # ========================================================
        # RUNNING
        # ========================================================

        else:

            rpm_reduction_fraction = min(
                effective_fraction,
                cls.MAX_RPM_REDUCTION_PERCENT
                / 100.0,
            )

            if current_rpm <= 0:

                rpm_reduction_fraction = 0.0

            rpm_reduction = (
                current_rpm
                * rpm_reduction_fraction
            )

            recommended_rpm = max(
                int(
                    round(
                        current_rpm
                        - rpm_reduction
                    )
                ),
                int(
                    round(
                        current_rpm
                        * cls.MIN_RPM_PERCENT
                    )
                ),
            )

            rpm_ratio = (
                recommended_rpm
                / current_rpm
                if current_rpm > 0
                else 1.0
            )

            power_factor = (
                0.35
                + 0.65 * rpm_ratio
            )

            carbon_factor = (
                0.30
                + 0.70 * power_factor
            )

            if production_critical:

                action = (
                    "Preserve production-critical "
                    "operation and use only conservative "
                    "efficiency optimization."
                )

            elif effective_fraction <= 0:

                action = (
                    "No operational reduction "
                    "recommended."
                )

            else:

                action = (
                    "Reduce operating speed within "
                    "the safe optimization limit."
                )

        # ========================================================
        # PROJECTED STATE
        # ========================================================

        projected_power = (
            current_power
            * power_factor
        )

        projected_carbon = (
            current_carbon
            * carbon_factor
        )

        projected_energy = (
            current_energy
            * power_factor
        )

        carbon_reduction = max(
            0.0,
            current_carbon
            - projected_carbon,
        )

        power_reduction = max(
            0.0,
            current_power
            - projected_power,
        )

        energy_reduction = max(
            0.0,
            current_energy
            - projected_energy,
        )

        actual_reduction_percent = (
            carbon_reduction
            / current_carbon
            * 100.0
            if current_carbon > 0
            else 0.0
        )

        efficiency_gain = (
            actual_reduction_percent
            * 0.08
        )

        projected_efficiency = min(
            100.0,
            current_efficiency
            + efficiency_gain,
        )

        return {
            "machine_id": machine_id,

            "machine_name": machine_name,

            "machine_type": machine_type,

            "department": department,

            "location": location,

            "operating_state": operating_state,

            "utilization_percent": round(
                utilization,
                2,
            ),

            "idle": idle,

            "production_critical": (
                production_critical
            ),

            "optimization_capacity_percent": round(
                capacity * 100.0,
                2,
            ),

            "current": {
                "rpm": current_rpm,

                "power_kw": round(
                    current_power,
                    2,
                ),

                "carbon_kg": round(
                    current_carbon,
                    2,
                ),

                "energy_kwh": round(
                    current_energy,
                    2,
                ),

                "efficiency": round(
                    current_efficiency,
                    2,
                ),

                "health_score": round(
                    health,
                    2,
                ),
            },

            "recommended": {
                "rpm": recommended_rpm,

                "power_kw": round(
                    projected_power,
                    2,
                ),

                "carbon_kg": round(
                    projected_carbon,
                    2,
                ),

                "energy_kwh": round(
                    projected_energy,
                    2,
                ),

                "efficiency": round(
                    projected_efficiency,
                    2,
                ),
            },

            "impact": {
                "rpm_reduction_percent": round(
                    (
                        (
                            current_rpm
                            - recommended_rpm
                        )
                        / current_rpm
                        * 100.0
                        if current_rpm > 0
                        else 0.0
                    ),
                    2,
                ),

                "power_reduction_kw": round(
                    power_reduction,
                    2,
                ),

                "carbon_reduction_kg": round(
                    carbon_reduction,
                    2,
                ),

                "energy_reduction_kwh": round(
                    energy_reduction,
                    2,
                ),
            },

            "action": action,

            "health_limited": (
                health < 85
            ),

            "reason": (
                "Idle consumption identified."
                if idle
                else (
                    "Production-critical asset "
                    "protected from aggressive "
                    "optimization."
                    if production_critical
                    else (
                        "Conservative operational "
                        "optimization based on "
                        "current machine condition."
                    )
                )
            ),
        }

    # ============================================================
    # PREVIEW
    # ============================================================

    @classmethod
    def preview(
        cls,
        target_carbon: float,
    ) -> dict[str, Any]:

        if target_carbon <= 0:

            raise ValueError(
                "Target carbon must be greater than zero."
            )

        machines = (
            DigitalTwinRuntime.machines()
        )

        if not machines:

            return {
                "status": "no_machines",
                "target_classification": "UNKNOWN",
                "target_carbon": target_carbon,
                "current_carbon": 0.0,
                "projected_carbon": 0.0,
                "reduction": 0.0,
                "reduction_percent": 0.0,
                "required_reduction": 0.0,
                "required_reduction_percent": 0.0,
                "realistic_reduction_potential": 0.0,
                "realistic_reduction_potential_percent": 0.0,
                "realistic_target_carbon": 0.0,
                "remaining_reduction": 0.0,
                "target_reached": False,
                "machines": [],
            }

        # ========================================================
        # CURRENT FACTORY STATE
        # ========================================================

        current_carbon = sum(
            cls._safe_float(
                getattr(
                    machine,
                    "carbon",
                    0.0,
                )
            )
            for machine in machines
        )

        current_power = sum(
            cls._safe_float(
                getattr(
                    machine,
                    "power",
                    0.0,
                )
            )
            for machine in machines
        )

        current_energy = sum(
            cls._safe_float(
                getattr(
                    machine,
                    "energy",
                    0.0,
                )
            )
            for machine in machines
        )

        # ========================================================
        # TARGET ALREADY MET
        # ========================================================

        if current_carbon <= target_carbon:

            plans = [
                cls._calculate_machine_plan(
                    machine,
                    0.0,
                )
                for machine in machines
            ]

            return {
                "status": "target_already_met",

                "target_classification": (
                    "REALISTIC"
                ),

                "target_carbon": round(
                    target_carbon,
                    2,
                ),

                "current_carbon": round(
                    current_carbon,
                    2,
                ),

                "projected_carbon": round(
                    current_carbon,
                    2,
                ),

                "reduction": 0.0,

                "reduction_percent": 0.0,

                "required_reduction": 0.0,

                "required_reduction_percent": 0.0,

                "realistic_reduction_potential": 0.0,

                "realistic_reduction_potential_percent": 0.0,

                "realistic_target_carbon": round(
                    current_carbon,
                    2,
                ),

                "remaining_reduction": 0.0,

                "target_reached": True,

                "current_power_kw": round(
                    current_power,
                    2,
                ),

                "projected_power_kw": round(
                    current_power,
                    2,
                ),

                "current_energy_kwh": round(
                    current_energy,
                    2,
                ),

                "projected_energy_kwh": round(
                    current_energy,
                    2,
                ),

                "machine_count": len(
                    machines
                ),

                "optimization_summary": {
                    "machines_analyzed": len(
                        machines
                    ),

                    "optimization_candidates": 0,

                    "idle_machines": sum(
                        1
                        for machine in machines
                        if cls._is_idle(
                            machine
                        )
                    ),

                    "production_critical_machines": sum(
                        1
                        for machine in machines
                        if cls._is_production_critical(
                            machine
                        )
                    ),

                    "realistic_target_carbon": round(
                        current_carbon,
                        2,
                    ),
                },

                "recommendations": [],

                "machines": plans,
            }

        # ========================================================
        # REQUIRED REDUCTION
        # ========================================================

        required_reduction = (
            current_carbon
            - target_carbon
        )

        required_reduction_percent = (
            required_reduction
            / current_carbon
            * 100.0
            if current_carbon > 0
            else 0.0
        )

        # ========================================================
        # DETERMINE ACTUAL REALISTIC CAPACITY
        #
        # IMPORTANT:
        #
        # We now calculate the maximum SAFE plan for every
        # machine and use the ACTUAL carbon reduction produced
        # by that plan.
        #
        # Therefore:
        #
        # realistic potential
        # =
        # actual achievable simulated reduction
        #
        # There is no theoretical-vs-actual mismatch.
        # ========================================================

        machine_capacity_data = []

        realistic_capacity = 0.0

        for machine in machines:

            capacity_fraction = (
                cls._machine_reduction_capacity(
                    machine
                )
            )

            maximum_plan = (
                cls._calculate_machine_plan(
                    machine,
                    capacity_fraction,
                )
            )

            actual_capacity = cls._safe_float(
                maximum_plan[
                    "impact"
                ].get(
                    "carbon_reduction_kg",
                    0.0,
                )
            )

            priority = max(
                0.0,
                cls._machine_priority(
                    machine
                ),
            )

            machine_capacity_data.append(
                {
                    "machine": machine,
                    "capacity_fraction": (
                        capacity_fraction
                    ),
                    "actual_capacity_kg": (
                        actual_capacity
                    ),
                    "priority": priority,
                }
            )

            realistic_capacity += (
                actual_capacity
            )

        # ========================================================
        # GLOBAL CAP
        # ========================================================

        global_capacity = (
            current_carbon
            * (
                cls.MAX_OPERATIONAL_REDUCTION_PERCENT
                / 100.0
            )
        )

        realistic_capacity = min(
            realistic_capacity,
            global_capacity,
        )

        realistic_capacity_percent = (
            realistic_capacity
            / current_carbon
            * 100.0
            if current_carbon > 0
            else 0.0
        )

        # ========================================================
        # TARGET CLASSIFICATION
        # ========================================================

        if (
            required_reduction
            <= realistic_capacity
        ):

            target_classification = (
                "REALISTIC"
            )

        elif (
            required_reduction_percent
            <= cls.AGGRESSIVE_REDUCTION_THRESHOLD
        ):

            target_classification = (
                "AGGRESSIVE"
            )

        else:

            target_classification = (
                "INFEASIBLE"
            )

        # ========================================================
        # REDUCTION BUDGET
        # ========================================================

        reduction_budget = min(
            required_reduction,
            realistic_capacity,
        )

        # ========================================================
        # PRIORITY ORDER
        # ========================================================

        machine_capacity_data.sort(
            key=lambda item: (
                item["priority"],
                item["actual_capacity_kg"],
            ),
            reverse=True,
        )

        allocated_reductions: dict[
            str,
            float,
        ] = {}

        remaining_budget = (
            reduction_budget
        )

        # ========================================================
        # ALLOCATE ACTUAL CARBON REDUCTION
        #
        # We allocate based on ACTUAL maximum savings.
        # ========================================================

        for item in machine_capacity_data:

            machine = item[
                "machine"
            ]

            machine_id = str(
                getattr(
                    machine,
                    "id",
                    "",
                )
            )

            maximum_saving = max(
                0.0,
                item[
                    "actual_capacity_kg"
                ],
            )

            if (
                remaining_budget <= 0
                or maximum_saving <= 0
            ):

                allocated_reductions[
                    machine_id
                ] = 0.0

                continue

            allocation = min(
                maximum_saving,
                remaining_budget,
            )

            allocated_reductions[
                machine_id
            ] = allocation

            remaining_budget -= (
                allocation
            )

        # ========================================================
        # BUILD PLANS
        #
        # For partial allocations we solve for the reduction
        # fraction that produces the requested carbon saving.
        # ========================================================

        plans = []

        for machine in machines:

            machine_id = str(
                getattr(
                    machine,
                    "id",
                    "",
                )
            )

            desired_reduction = (
                allocated_reductions.get(
                    machine_id,
                    0.0,
                )
            )

            maximum_fraction = (
                cls._machine_reduction_capacity(
                    machine
                )
            )

            if desired_reduction <= 0:

                plan = (
                    cls._calculate_machine_plan(
                        machine,
                        0.0,
                    )
                )

                plans.append(
                    plan
                )

                continue

            # ----------------------------------------------------
            # Find the reduction fraction that produces the
            # desired ACTUAL carbon saving.
            #
            # Binary search keeps the calculation stable.
            # ----------------------------------------------------

            low = 0.0
            high = maximum_fraction

            best_plan = (
                cls._calculate_machine_plan(
                    machine,
                    high,
                )
            )

            best_difference = abs(
                cls._safe_float(
                    best_plan[
                        "impact"
                    ].get(
                        "carbon_reduction_kg",
                        0.0,
                    )
                )
                - desired_reduction
            )

            for _ in range(30):

                middle = (
                    low + high
                ) / 2.0

                candidate = (
                    cls._calculate_machine_plan(
                        machine,
                        middle,
                    )
                )

                candidate_reduction = (
                    cls._safe_float(
                        candidate[
                            "impact"
                        ].get(
                            "carbon_reduction_kg",
                            0.0,
                        )
                    )
                )

                difference = abs(
                    candidate_reduction
                    - desired_reduction
                )

                if difference < best_difference:

                    best_plan = candidate

                    best_difference = (
                        difference
                    )

                if (
                    candidate_reduction
                    < desired_reduction
                ):

                    low = middle

                else:

                    high = middle

            plans.append(
                best_plan
            )

        # ========================================================
        # ACTUAL REDUCTION
        # ========================================================

        actual_reduction = sum(
            cls._safe_float(
                plan[
                    "impact"
                ].get(
                    "carbon_reduction_kg",
                    0.0,
                )
            )
            for plan in plans
        )

        actual_reduction = min(
            actual_reduction,
            realistic_capacity,
            required_reduction,
        )

        projected_carbon = max(
            0.0,
            current_carbon
            - actual_reduction,
        )

        actual_reduction_percent = (
            actual_reduction
            / current_carbon
            * 100.0
            if current_carbon > 0
            else 0.0
        )

        # ========================================================
        # POWER / ENERGY
        # ========================================================

        power_reduction = sum(
            cls._safe_float(
                plan[
                    "impact"
                ].get(
                    "power_reduction_kw",
                    0.0,
                )
            )
            for plan in plans
        )

        energy_reduction = sum(
            cls._safe_float(
                plan[
                    "impact"
                ].get(
                    "energy_reduction_kwh",
                    0.0,
                )
            )
            for plan in plans
        )

        projected_power = max(
            0.0,
            current_power
            - power_reduction,
        )

        projected_energy = max(
            0.0,
            current_energy
            - energy_reduction,
        )

        target_reached = (
            projected_carbon
            <= target_carbon
        )

        remaining_reduction = max(
            0.0,
            projected_carbon
            - target_carbon,
        )

        # ========================================================
        # STATUS
        # ========================================================

        if target_reached:

            status = (
                "target_reached"
            )

        elif (
            target_classification
            == "REALISTIC"
        ):

            status = (
                "best_effort"
            )

        elif (
            target_classification
            == "AGGRESSIVE"
        ):

            status = (
                "aggressive_target"
            )

        else:

            status = (
                "infeasible_target"
            )

        # ========================================================
        # RECOMMENDATIONS
        # ========================================================

        recommendations = [
            plan
            for plan in plans
            if cls._safe_float(
                plan[
                    "impact"
                ].get(
                    "carbon_reduction_kg",
                    0.0,
                )
            ) > 0.01
        ]

        recommendations.sort(
            key=lambda plan: (
                cls._safe_float(
                    plan[
                        "impact"
                    ].get(
                        "carbon_reduction_kg",
                        0.0,
                    )
                ),
                cls._safe_float(
                    plan.get(
                        "optimization_capacity_percent",
                        0.0,
                    )
                ),
            ),
            reverse=True,
        )

        # ========================================================
        # REALISTIC TARGET
        # ========================================================

        realistic_target_carbon = max(
            0.0,
            current_carbon
            - realistic_capacity,
        )

        # ========================================================
        # RESPONSE
        # ========================================================

        return {
            "status": status,

            "target_classification": (
                target_classification
            ),

            "target_carbon": round(
                target_carbon,
                2,
            ),

            "current_carbon": round(
                current_carbon,
                2,
            ),

            "projected_carbon": round(
                projected_carbon,
                2,
            ),

            "reduction": round(
                actual_reduction,
                2,
            ),

            "reduction_percent": round(
                actual_reduction_percent,
                2,
            ),

            "required_reduction": round(
                required_reduction,
                2,
            ),

            "required_reduction_percent": round(
                required_reduction_percent,
                2,
            ),

            "realistic_reduction_potential": round(
                realistic_capacity,
                2,
            ),

            "realistic_reduction_potential_percent": round(
                realistic_capacity_percent,
                2,
            ),

            "realistic_target_carbon": round(
                realistic_target_carbon,
                2,
            ),

            "remaining_reduction": round(
                remaining_reduction,
                2,
            ),

            "target_reached": (
                target_reached
            ),

            "current_power_kw": round(
                current_power,
                2,
            ),

            "projected_power_kw": round(
                projected_power,
                2,
            ),

            "current_energy_kwh": round(
                current_energy,
                2,
            ),

            "projected_energy_kwh": round(
                projected_energy,
                2,
            ),

            "machine_count": len(
                machines
            ),

            "optimization_summary": {
                "machines_analyzed": len(
                    machines
                ),

                "optimization_candidates": len(
                    recommendations
                ),

                "idle_machines": sum(
                    1
                    for machine in machines
                    if cls._is_idle(
                        machine
                    )
                ),

                "production_critical_machines": sum(
                    1
                    for machine in machines
                    if cls._is_production_critical(
                        machine
                    )
                ),

                "realistic_target_carbon": round(
                    realistic_target_carbon,
                    2,
                ),

                "required_reduction_percent": round(
                    required_reduction_percent,
                    2,
                ),

                "realistic_reduction_percent": round(
                    realistic_capacity_percent,
                    2,
                ),
            },

            "recommendations": (
                recommendations
            ),

            "machines": plans,
        }

    # ============================================================
    # APPLY TO DIGITAL TWIN
    # ============================================================

    @classmethod
    def apply(
        cls,
        target_carbon: float,
    ) -> dict[str, Any]:

        plan = cls.preview(
            target_carbon
        )

        if (
            plan["status"]
            == "no_machines"
        ):

            return plan

        applied_machines = []

        for machine_plan in plan[
            "machines"
        ]:

            machine_id = (
                machine_plan[
                    "machine_id"
                ]
            )

            machine = (
                DigitalTwinRuntime.get(
                    machine_id
                )
            )

            if machine is None:
                continue

            recommended = (
                machine_plan[
                    "recommended"
                ]
            )

            # ====================================================
            # DIGITAL TWIN ONLY
            #
            # This does NOT issue physical machine commands.
            # ====================================================

            machine.rpm = int(
                recommended[
                    "rpm"
                ]
            )

            machine.power = float(
                recommended[
                    "power_kw"
                ]
            )

            machine.carbon = float(
                recommended[
                    "carbon_kg"
                ]
            )

            machine.energy = float(
                recommended[
                    "energy_kwh"
                ]
            )

            machine.efficiency = float(
                recommended[
                    "efficiency"
                ]
            )

            applied_machines.append(
                machine_plan
            )

        return {
            **plan,

            "status": (
                "optimization_applied"
                if applied_machines
                else plan[
                    "status"
                ]
            ),

            "applied_machine_count": len(
                applied_machines
            ),

            "machines": (
                applied_machines
            ),
        }

    # ============================================================
    # RESET
    # ============================================================

    @classmethod
    def reset(cls) -> dict[str, Any]:

        DigitalTwinRuntime.initialize()

        machines = (
            DigitalTwinRuntime.machines()
        )

        return {
            "status": "reset",

            "machine_count": len(
                machines
            ),

            "message": (
                "Digital twin optimization "
                "state reset to baseline."
            ),
        }