from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.digital_twin.runtime import DigitalTwinRuntime
from app.digital_twin.telemetry_history import LiveTelemetryStore

from app.services.predictive_maintenance_service import (
    PredictiveMaintenanceService,
)

from app.services.ai_condition_service import (
    AIConditionService,
)

from app.services.maintenance_assignment_service import (
    MaintenanceAssignmentService,
)

from app.services.maintenance_decision_service import (
    MaintenanceDecisionService,
)

from app.services.maintenance_service import (
    MaintenanceService,
)

from app.websocket.socket_manager import broadcast


router = APIRouter(
    prefix="/machines",
    tags=["Machines"],
)


# ============================================================
# REQUEST MODELS
# ============================================================


class MachineControlRequest(BaseModel):
    action: str


class MaintenanceAssignmentRequest(BaseModel):
    technician_id: str


# ============================================================
# GET ALL MACHINES
# ============================================================


@router.get("/")
def get_machines():

    machines = DigitalTwinRuntime.machines()

    enriched_machines = []

    for machine in machines:

        machine_dict = machine.model_dump()

        prediction = (
            PredictiveMaintenanceService.analyze(
                machine
            )
        )

        machine_dict["ai_prediction"] = prediction

        enriched_machines.append(
            machine_dict
        )

    return enriched_machines


# ============================================================
# LIVE TELEMETRY HISTORY
# ============================================================


@router.get("/telemetry-history")
def get_telemetry_history():

    dataframe = LiveTelemetryStore.get_all()

    if dataframe.empty:

        return {
            "available": False,
            "machines": 0,
            "observations": 0,
            "history": [],
            "message": (
                "No live telemetry has been "
                "recorded yet."
            ),
        }

    history = []

    for machine_id, group in dataframe.groupby(
        "Machine_ID",
        sort=False,
    ):

        group = group.sort_values(
            "Timestamp"
        )

        latest = group.iloc[-1]

        history.append(
            {
                "machine_id": str(
                    machine_id
                ),

                "machine_type": str(
                    latest["Machine_Type"]
                ),

                "observations": int(
                    len(group)
                ),

                "latest_timestamp": str(
                    latest["Timestamp"]
                ),

                "latest": {
                    "temperature": round(
                        float(
                            latest["Temperature"]
                        ),
                        2,
                    ),

                    "pressure": round(
                        float(
                            latest["Pressure"]
                        ),
                        2,
                    ),

                    "vibration": round(
                        float(
                            latest["Vibration"]
                        ),
                        2,
                    ),

                    "power": round(
                        float(
                            latest["Power"]
                        ),
                        2,
                    ),
                },
            }
        )

    return {
        "available": True,

        "machines": int(
            dataframe["Machine_ID"].nunique()
        ),

        "observations": int(
            len(dataframe)
        ),

        "history": history,
    }


# ============================================================
# MACHINE TELEMETRY HISTORY
# ============================================================


@router.get("/{machine_id}/telemetry-history")
def get_machine_telemetry_history(
    machine_id: str,
):

    dataframe = LiveTelemetryStore.get(
        machine_id
    )

    if dataframe.empty:

        return {
            "available": False,
            "machine_id": machine_id,
            "observations": 0,
            "history": [],
            "message": (
                "No live telemetry has been "
                "recorded for this machine."
            ),
        }

    history = []

    for _, row in dataframe.iterrows():

        history.append(
            {
                "machine_id": str(
                    row["Machine_ID"]
                ),

                "timestamp": str(
                    row["Timestamp"]
                ),

                "machine_type": str(
                    row["Machine_Type"]
                ),

                "temperature": round(
                    float(
                        row["Temperature"]
                    ),
                    2,
                ),

                "pressure": round(
                    float(
                        row["Pressure"]
                    ),
                    2,
                ),

                "vibration": round(
                    float(
                        row["Vibration"]
                    ),
                    2,
                ),

                "power": round(
                    float(
                        row["Power"]
                    ),
                    2,
                ),
            }
        )

    return {
        "available": True,

        "machine_id": machine_id,

        "observations": len(
            history
        ),

        "history": history,
    }


# ============================================================
# MACHINE CONTROL
# ============================================================


@router.post("/{machine_id}/control")
async def control_machine(
    machine_id: str,
    request: MachineControlRequest,
):

    machine = DigitalTwinRuntime.get(
        machine_id
    )

    if machine is None:

        raise HTTPException(
            status_code=404,
            detail="Machine not found",
        )

    try:

        updated_machine = (
            DigitalTwinRuntime.control(
                machine_id,
                request.action,
            )
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    if updated_machine is None:

        raise HTTPException(
            status_code=404,
            detail="Machine not found",
        )

    machines = (
        DigitalTwinRuntime.machines()
    )

    machine_snapshot = [
        machine.model_dump()
        for machine in machines
    ]

    await broadcast(
        "machine_control_update",
        {
            "machine_id": machine_id,

            "action": request.action,

            "timestamp": (
                datetime.now(
                    timezone.utc
                ).isoformat()
            ),

            "machines": machine_snapshot,
        },
    )

    return {
        "success": True,

        "message": (
            f"Machine {machine_id} "
            f"control action "
            f"'{request.action}' applied."
        ),

        "machine": (
            updated_machine.model_dump()
        ),
    }


# ============================================================
# MAINTENANCE ASSIGNMENT
# ============================================================


@router.post(
    "/{machine_id}/maintenance/assign"
)
async def assign_maintenance_engineer(
    machine_id: str,
    request: MaintenanceAssignmentRequest,
):

    try:

        result = (
            MaintenanceAssignmentService.assign(
                machine_id=machine_id,
                technician_id=(
                    request.technician_id
                ),
            )
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    machines = (
        DigitalTwinRuntime.machines()
    )

    machine_snapshot = [
        machine.model_dump()
        for machine in machines
    ]

    await broadcast(
        "maintenance_assignment_update",
        {
            "machine_id": machine_id,

            "technician_id": (
                request.technician_id
            ),

            "timestamp": (
                datetime.now(
                    timezone.utc
                ).isoformat()
            ),

            "assignment": result,

            "machines": machine_snapshot,
        },
    )

    return result


# ============================================================
# PREDICTIVE MAINTENANCE
# ============================================================


@router.get(
    "/{machine_id}/predictive-maintenance"
)
def get_predictive_maintenance(
    machine_id: str,
):

    machine = DigitalTwinRuntime.get(
        machine_id
    )

    if machine is None:

        return {
            "available": False,
            "machine_id": machine_id,
            "status": "Machine not found",
        }

    return (
        PredictiveMaintenanceService.analyze(
            machine
        )
    )


# ============================================================
# MAINTENANCE RECOMMENDATIONS
# ============================================================


@router.get(
    "/{machine_id}/maintenance-recommendations"
)
def get_maintenance_recommendations(
    machine_id: str,
):

    machine = DigitalTwinRuntime.get(
        machine_id
    )

    if machine is None:

        raise HTTPException(
            status_code=404,
            detail="Machine not found",
        )

    # ========================================================
    # AUTHORITATIVE AI CONDITION
    # ========================================================

    condition = (
        AIConditionService.analyze(
            machine_id
        )
    )

    if not condition.get(
        "available",
        False,
    ):

        return {
            "available": False,

            "machine": {
                "id": machine.id,
                "name": machine.name,
                "type": machine.type,
            },

            "maintenance_problem": {
                "severity": "Unknown",

                "problems": [
                    condition.get(
                        "reason",
                        "AI condition analysis "
                        "is not available yet.",
                    )
                ],

                "degradation_condition":
                    "INSUFFICIENT_EVIDENCE",

                "model_risk_level":
                    "UNKNOWN",
            },

            "required_skills": [],

            "recommended_engineer": None,

            "recommendations": [],

            "excluded_engineers": [],

            "prediction": None,

            "decision": {
                "status":
                    "INSUFFICIENT_EVIDENCE",

                "action":
                    "Continue Digital Twin "
                    "monitoring until sufficient "
                    "AI evidence is available.",

                "operator_assignment_required":
                    False,

                "ai_recommendation_available":
                    False,

                "automatic_assignment":
                    False,
            },
        }

    # ========================================================
    # AUTHORITATIVE MAINTENANCE DECISION
    # ========================================================
    #
    # The AI condition is evaluated once above.
    # This decision layer translates that same condition into
    # a maintenance action and workforce requirement.
    #
    # It does NOT assign anyone and does NOT control the machine.
    # ========================================================

    maintenance_decision = (
        MaintenanceDecisionService.analyze(
            condition
        )
    )

    if not maintenance_decision.get(
        "available",
        False,
    ):

        return {
            "available": True,

            "machine": {
                "id": machine.id,
                "name": machine.name,
                "type": machine.type,
            },

            "maintenance_problem": {
                "severity": "Unknown",

                "problems": [
                    maintenance_decision.get(
                        "reason",
                        "Maintenance decision is not available.",
                    )
                ],

                "degradation_condition":
                    "UNKNOWN",

                "model_risk_level":
                    "UNKNOWN",
            },

            "required_skills": [],

            "recommended_role":
                "NONE",

            "recommended_engineer":
                None,

            "recommended_worker":
                None,

            "recommendations": [],

            "excluded_engineers": [],

            "excluded_workers": [],

            "prediction": None,

            "decision": {
                "status":
                    "INSUFFICIENT_EVIDENCE",

                "action":
                    maintenance_decision.get(
                        "reason",
                        "Continue Digital Twin monitoring.",
                    ),

                "operator_assignment_required":
                    False,

                "ai_recommendation_available":
                    False,

                "automatic_assignment":
                    False,
            },
        }

    decision_workforce = (
        maintenance_decision.get(
            "workforce",
            {},
        )
    )

    if not isinstance(
        decision_workforce,
        dict,
    ):

        decision_workforce = {}

    workforce_required_role = str(
        decision_workforce.get(
            "recommended_role",
            "NONE",
        )
    ).strip().upper()

    workforce_engineer_required = bool(
        decision_workforce.get(
            "engineer_required",
            False,
        )
    )

    workforce_technician_required = bool(
        decision_workforce.get(
            "technician_required",
            False,
        )
    )

    # ========================================================
    # AI COMPONENTS
    # ========================================================

    predictive = condition.get(
        "predictive_failure",
        {},
    )

    operational = condition.get(
        "operational_condition",
        {},
    )

    rul = condition.get(
        "rul",
        {},
    )

    degradation = condition.get(
        "degradation",
        {},
    )

    # ========================================================
    # RISK
    # ========================================================

    risk_level = str(
        predictive.get(
            "risk_level",
            "UNKNOWN",
        )
    ).upper()

    operational_level = str(
        operational.get(
            "level",
            risk_level,
        )
    ).upper()

    # ========================================================
    # PREDICTIVE MODEL AVAILABILITY
    # ========================================================

    predictive_available = bool(
        predictive.get(
            "available",
            False,
        )
    )

    predictive_risk_level = str(
        predictive.get(
            "risk_level",
            "UNKNOWN",
        )
    ).upper()

    # ========================================================
    # NORMALIZE PROBABILITIES
    # ========================================================

    def normalize_probability(
        value,
    ):

        try:

            value = float(value)

        except (
            TypeError,
            ValueError,
        ):

            return None

        return max(
            0.0,
            min(
                1.0,
                value,
            ),
        )

    risk_score = (
        normalize_probability(
            predictive.get(
                "risk_score"
            )
        )
    )

    ai_failure_probability = (
        normalize_probability(
            predictive.get(
                "ai_failure_probability"
            )
        )
    )

    probability = predictive.get(
        "probability",
        {},
    )

    normalized_probability = {}

    if isinstance(
        probability,
        dict,
    ):

        for horizon, value in (
            probability.items()
        ):

            normalized = (
                normalize_probability(
                    value
                )
            )

            if normalized is not None:

                normalized_probability[
                    horizon
                ] = normalized

    # ========================================================
    # DEGRADATION
    # ========================================================

    degradation_condition = str(
        operational.get(
            "degradation_condition",
            degradation.get(
                "condition",
                "UNKNOWN",
            ),
        )
    ).upper()

    model_risk_level = str(
        operational.get(
            "model_risk_level",
            predictive_risk_level,
        )
    ).upper()

    # ========================================================
    # FINAL AI DECISION LEVEL
    #
    # Predictive model takes priority when available.
    # Degradation is supporting evidence and must not cancel
    # a valid predictive result.
    # ========================================================

    if predictive_available:

        decision_risk_level = (
            predictive_risk_level
        )

    else:

        decision_risk_level = (
            operational_level
        )

    # ========================================================
    # SEVERITY
    # ========================================================

    severity_map = {
        "CRITICAL": "Critical",
        "HIGH": "High",
        "MEDIUM": "Medium",
        "LOW": "Low",
        "ATTENTION": "Medium",
        "DEGRADED": "High",
    }

    severity = severity_map.get(
        decision_risk_level,
        "Unknown",
    )

    # ========================================================
    # ACTION
    # ========================================================

    action = str(
        predictive.get(
            "recommended_action",
            operational.get(
                "action",
                "Continue Digital Twin monitoring.",
            ),
        )
    )

    reason = str(
        predictive.get(
            "reason",
            "",
        )
    )

    # ========================================================
    # MAINTENANCE PROBLEM
    # ========================================================

    problems = []

    if reason:

        problems.append(
            reason
        )

    if (
        degradation_condition
        == "INSUFFICIENT_EVIDENCE"
    ):

        problems.append(
            "Learned degradation baseline "
            "is not available for this machine "
            "type; predictive risk remains "
            "available from the trained model."
        )

    if not problems:

        problems.append(
            action
        )

    # ========================================================
    # REQUIRED TECHNICAL SKILLS
    # ========================================================

    machine_type = str(
        getattr(
            machine,
            "type",
            "",
        )
        or ""
    )

    machine_type_lower = (
        machine_type.strip().lower()
    )

    if "motor" in machine_type_lower:

        required_skills = [
            "Motor",
            "Electrical Systems",
            "Drives",
            "Vibration Analysis",
        ]

    elif "pump" in machine_type_lower:

        required_skills = [
            "Pump",
            "Hydraulics",
            "Fluid Systems",
            "Mechanical Maintenance",
        ]

    elif "boiler" in machine_type_lower:

        required_skills = [
            "Boiler",
            "Thermal Systems",
            "Pressure Systems",
            "Preventive Maintenance",
        ]

    elif "compressor" in machine_type_lower:

        required_skills = [
            "Compressor",
            "Pneumatics",
            "Pressure Systems",
            "Mechanical Maintenance",
        ]

    else:

        required_skills = [
            "Mechanical Maintenance",
            "Preventive Maintenance",
        ]

    # ========================================================
    # WORKFORCE
    # ========================================================

    workforce = (
        MaintenanceAssignmentService
        ._load_data()
    )

    technicians = workforce.get(
        "technicians",
        [],
    )

    recommendations = []

    excluded_workers = []

    for technician in technicians:

        technician_id = technician.get(
            "id"
        )

        name = technician.get(
            "name",
            "Unknown",
        )

        role = str(
            technician.get(
                "role",
                "Technician",
            )
        ).strip()

        department = str(
            technician.get(
                "department",
                "",
            )
        ).strip()

        specialization = str(
            technician.get(
                "specialization",
                "",
            )
        ).strip()

        skills = technician.get(
            "skills",
            [],
        )

        if not isinstance(
            skills,
            list,
        ):

            skills = []

        certifications = technician.get(
            "certifications",
            [],
        )

        if not isinstance(
            certifications,
            list,
        ):

            certifications = []

        availability = str(
            technician.get(
                "availability",
                "Unknown",
            )
        ).strip()

        current_workload = int(
            technician.get(
                "current_workload",
                0,
            )
            or 0
        )

        max_workload = int(
            technician.get(
                "max_workload",
                1,
            )
            or 1
        )

        experience_years = int(
            technician.get(
                "experience_years",
                0,
            )
            or 0
        )

        # ====================================================
        # HISTORICAL EXPERIENCE
        #
        # Use the same maintenance-history engine that powers
        # workforce relevance. Keep the evidence attached to
        # the candidate so the API/frontend can explain why a
        # worker is recommended.
        # ====================================================

        historical_experience = (
            MaintenanceService
            ._historical_experience(
                machine,
                str(
                    technician.get(
                        "id",
                        "",
                    )
                ),
            )
        )

        if not isinstance(
            historical_experience,
            dict,
        ):

            historical_experience = {
                "similar_cases": 0,
                "successful_cases": 0,
                "repeat_failures": 0,
                "success_rate": 0.0,
                "records": [],
            }

        shift = technician.get(
            "shift",
            {},
        )

        if not isinstance(
            shift,
            dict,
        ):

            shift = {}

        plant_area = str(
            technician.get(
                "plant_area",
                "",
            )
        ).strip()

        # ====================================================
        # AVAILABILITY
        # ====================================================

        availability_lower = (
            availability.lower()
        )

        if availability_lower not in {
            "available",
            "on call",
        }:

            excluded_workers.append(
                {
                    "technician_id":
                        technician_id,

                    "technician":
                        name,

                    "reason":
                        "Currently unavailable",
                }
            )

            continue

        # ====================================================
        # WORKLOAD
        # ====================================================

        if current_workload >= max_workload:

            excluded_workers.append(
                {
                    "technician_id":
                        technician_id,

                    "technician":
                        name,

                    "reason":
                        "Maximum workload reached",
                }
            )

            continue

        # ====================================================
        # SKILL MATCH
        # ====================================================

        skill_set = {
            str(skill).strip().lower()
            for skill in skills
        }

        certification_set = {
            str(cert).strip().lower()
            for cert in certifications
        }

        matched_skills = [
            skill
            for skill in required_skills
            if skill.lower()
            in skill_set
        ]

        matched_certifications = [
            skill
            for skill in required_skills
            if skill.lower()
            in certification_set
        ]

        # ====================================================
        # SPECIALIZATION
        # ====================================================

        specialization_lower = (
            specialization.lower()
        )

        specialization_match = (
            bool(machine_type_lower)
            and machine_type_lower
            in specialization_lower
        )

        # ====================================================
        # DEPARTMENT
        # ====================================================

        machine_department = str(
            getattr(
                machine,
                "department",
                "",
            )
            or ""
        ).strip()

        same_department = (
            bool(machine_department)
            and department.lower()
            == machine_department.lower()
        )

        # ====================================================
        # PLANT AREA
        # ====================================================

        machine_area = str(
            getattr(
                machine,
                "plant_area",
                "",
            )
            or ""
        ).strip()

        same_area = (
            bool(machine_area)
            and bool(plant_area)
            and plant_area.lower()
            == machine_area.lower()
        )

        # ====================================================
        # TECHNICAL SCORE
        #
        # Ranking priority:
        #
        # 1. Required technical skills
        # 2. Machine specialization
        # 3. Relevant certifications
        # 4. Availability
        # 5. Workload capacity
        # 6. Plant area
        # 7. Department
        # 8. Experience
        # 9. Engineer role as a tie-breaker
        #
        # Technical suitability is intentionally dominant.
        # A job title must not override a stronger technical
        # match.
        # ====================================================

        role_lower = role.lower()

        is_engineer = (
            "engineer" in role_lower
        )

        is_technician = (
            not is_engineer
        )

        # ====================================================
        # REQUIRED ROLE FILTER
        #
        # Workforce selection is driven by the maintenance
        # decision, not by machine operating state.
        #
        # TECHNICIAN:
        #     physical maintenance / inspection execution.
        #
        # ENGINEER:
        #     engineering diagnosis / review.
        #
        # ENGINEER_AND_TECHNICIAN:
        #     both categories may be considered. The response
        #     exposes the worker role so the operator can see
        #     which part of the workflow each person supports.
        #
        # NONE:
        #     no workforce recommendation.
        # ====================================================

        if workforce_required_role == "ENGINEER":

            if not is_engineer:

                excluded_workers.append(
                    {
                        "technician_id":
                            technician_id,

                        "technician":
                            name,

                        "role":
                            role,

                        "reason":
                            "Worker role does not match "
                            "the engineering requirement.",
                    }
                )

                continue

        elif workforce_required_role == "TECHNICIAN":

            if not is_technician:

                excluded_workers.append(
                    {
                        "technician_id":
                            technician_id,

                        "technician":
                            name,

                        "role":
                            role,

                        "reason":
                            "Worker role does not match "
                            "the technician execution requirement.",
                    }
                )

                continue

        elif workforce_required_role == "NONE":

            excluded_workers.append(
                {
                    "technician_id":
                        technician_id,

                    "technician":
                        name,

                    "role":
                        role,

                    "reason":
                        "No workforce intervention is "
                        "currently required.",
                }
            )

            continue

        score = 0

        # ----------------------------------------------------
        # 1. REQUIRED TECHNICAL SKILLS
        # ----------------------------------------------------

        score += (
            len(matched_skills) * 40
        )

        # ----------------------------------------------------
        # 2. MACHINE SPECIALIZATION
        # ----------------------------------------------------

        if specialization_match:

            score += 25

        # ----------------------------------------------------
        # 3. RELEVANT CERTIFICATIONS
        # ----------------------------------------------------

        score += min(
            len(matched_certifications) * 4,
            12,
        )

        # ----------------------------------------------------
        # 4. AVAILABILITY
        # ----------------------------------------------------

        if availability_lower == "available":

            score += 8

        elif availability_lower == "on call":

            score += 3

        # ----------------------------------------------------
        # 5. WORKLOAD / REMAINING CAPACITY
        # ----------------------------------------------------

        remaining_capacity = max(
            0,
            max_workload
            - current_workload,
        )

        score += min(
            remaining_capacity * 3,
            12,
        )

        # ----------------------------------------------------
        # 6. SAME PLANT AREA
        # ----------------------------------------------------

        if same_area:

            score += 8

        # ----------------------------------------------------
        # 7. SAME DEPARTMENT
        # ----------------------------------------------------

        if same_department:

            score += 6

        # ----------------------------------------------------
        # 8. EXPERIENCE
        # ----------------------------------------------------

        score += min(
            experience_years,
            10,
        )

        # ====================================================
        # MATCH QUALITY
        # ====================================================

        matched_count = len(
            matched_skills
        )

        if (
            matched_count >= 3
            and specialization_match
        ):

            relevance = "Excellent"

        elif (
            matched_count >= 2
            and specialization_match
        ):

            relevance = "High"

        elif (
            matched_count >= 2
            or specialization_match
        ):

            relevance = "Good"

        elif matched_count == 1:

            relevance = "Partial"

        else:

            relevance = "Fallback"

        # ====================================================
        # UNRELATED WORKERS
        # ====================================================

        if (
            matched_count == 0
            and not specialization_match
        ):

            excluded_workers.append(
                {
                    "technician_id":
                        technician_id,

                    "technician":
                        name,

                    "reason":
                        "No relevant technical "
                        "skill or machine "
                        "specialization match",
                }
            )

            continue

        # ====================================================
        # EVIDENCE
        # ====================================================

        evidence = []

        if matched_skills:

            evidence.append(
                "Matched skills: "
                + ", ".join(
                    matched_skills
                )
            )

        if specialization_match:

            evidence.append(
                "Machine specialization match"
            )

        if matched_certifications:

            evidence.append(
                "Relevant certifications: "
                + ", ".join(
                    matched_certifications
                )
            )

        if same_department:

            evidence.append(
                "Same department"
            )

        if same_area:

            evidence.append(
                "Same plant area"
            )

        evidence.append(
            f"{experience_years} years experience"
        )

        evidence.append(
            f"Workload "
            f"{current_workload}/"
            f"{max_workload}"
        )

        evidence.append(
            "Shift: "
            f"{shift.get('name', 'Not specified')}"
        )

        evidence.append(
            f"Availability: {availability}"
        )

        # ----------------------------------------------------
        # HISTORICAL MAINTENANCE EVIDENCE
        # ----------------------------------------------------

        similar_cases = int(
            historical_experience.get(
                "similar_cases",
                0,
            )
            or 0
        )

        successful_cases = int(
            historical_experience.get(
                "successful_cases",
                0,
            )
            or 0
        )

        repeat_failures = int(
            historical_experience.get(
                "repeat_failures",
                0,
            )
            or 0
        )

        success_rate = float(
            historical_experience.get(
                "success_rate",
                0.0,
            )
            or 0.0
        )

        evidence.append(
            "Historical experience: "
            f"{similar_cases} similar cases, "
            f"{successful_cases} successful, "
            f"{repeat_failures} repeat failures, "
            f"{success_rate:.0%} success rate"
        )

        # ====================================================
        # CANDIDATE
        # ====================================================

        recommendations.append(
            {
                "technician_id":
                    technician_id,

                "technician":
                    name,

                "role":
                    role,

                "role_type":
                    (
                        "ENGINEER"
                        if is_engineer
                        else "TECHNICIAN"
                    ),

                "specialization":
                    specialization,

                "department":
                    department,

                "skills":
                    skills,

                "matched_skills":
                    matched_skills,

                "certifications":
                    certifications,

                "matched_certifications":
                    matched_certifications,

                "availability":
                    availability,

                "current_workload":
                    current_workload,

                "max_workload":
                    max_workload,

                "experience_years":
                    experience_years,

                "historical_experience":
                    historical_experience,

                "shift":
                    shift,

                "plant_area":
                    plant_area,

                "relevance":
                    relevance,

                "specialization_match":
                    bool(
                        specialization_match
                    ),

                "same_department":
                    same_department,

                "same_area":
                    same_area,

                "evidence":
                    evidence,

                "_score":
                    score,
            }
        )

    # ========================================================
    # SORT
    #
    # Technical fit remains the primary ordering criterion.
    # The additional fields provide deterministic tie-breaking.
    # ========================================================

    recommendations.sort(
        key=lambda item: (
            item["_score"],

            len(
                item["matched_skills"]
            ),

            len(
                item["matched_certifications"]
            ),

            item["specialization_match"],

            item["same_area"],

            item["same_department"],

            item["experience_years"],

            -item["current_workload"],
        ),
        reverse=True,
    )

    # ========================================================
    # SINGLE SOURCE OF TRUTH
    #
    # The first ranked eligible worker IS the AI
    # recommendation.
    # ========================================================

    # ========================================================
    # ROLE-AWARE RECOMMENDATION
    # ========================================================

    recommended_worker = (
        recommendations[0]
        if recommendations
        else None
    )

    # Backward-compatible field retained for the existing UI.
    # It now represents the top worker for the required role,
    # rather than implying that every worker is an engineer.
    recommended_engineer = (
        recommended_worker
    )

    # ========================================================
    # REMOVE INTERNAL SCORE
    # ========================================================

    for recommendation in recommendations:

        recommendation.pop(
            "_score",
            None,
        )

    # ========================================================
    # MAINTENANCE DECISION
    #
    # Use the authoritative MaintenanceDecisionService result
    # generated from the same AI condition snapshot.
    # ========================================================

    decision_name = str(
        maintenance_decision.get(
            "decision",
            "REVIEW_REQUIRED",
        )
    ).strip().upper()

    decision_reason = str(
        maintenance_decision.get(
            "decision_reason",
            maintenance_decision.get(
                "reason",
                "",
            ),
        )
    )

    if decision_name == "IMMEDIATE_INTERVENTION":

        decision_status = (
            "IMMEDIATE_INTERVENTION"
        )

    elif decision_name == "SCHEDULE_MAINTENANCE":

        decision_status = (
            "MAINTENANCE_REQUIRED"
        )

    elif decision_name == "PLAN_MAINTENANCE":

        decision_status = (
            "PLANNED_MAINTENANCE"
        )

    elif decision_name == "CONTINUE_MONITORING":

        decision_status = "MONITOR"

    else:

        decision_status = decision_name

    operator_assignment_required = (
        decision_name
        != "CONTINUE_MONITORING"
        and workforce_required_role
        != "NONE"
        and recommended_worker
        is not None
    )

    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    return {
        "available": True,

        "machine": {
            "id":
                machine.id,

            "name":
                machine.name,

            "type":
                machine.type,

            "department":
                getattr(
                    machine,
                    "department",
                    "",
                ),

            "health_score":
                condition.get(
                    "digital_twin_health_score"
                ),

            "ai_health_score":
                condition.get(
                    "ai_health_score"
                ),

            "risk_level":
                decision_risk_level,

            "risk_score":
                risk_score,

            "ai_failure_probability":
                ai_failure_probability,

            "failure_probability":
                ai_failure_probability,

            "rul_hours":
                rul.get(
                    "remaining_useful_life_hours"
                ),

            "rul_confidence":
                rul.get(
                    "confidence"
                ),
        },

        "maintenance_problem": {
            "severity":
                severity,

            "problems":
                problems,

            "degradation_condition":
                degradation_condition,

            "model_risk_level":
                model_risk_level,
        },

        "decision": {
            "status":
                decision_status,

            "action":
                action,

            "reason":
                decision_reason,

            "operator_assignment_required":
                operator_assignment_required,

            "ai_recommendation_available":
                recommended_worker
                is not None,

            "automatic_assignment":
                False,

            "message": (
                "AI has ranked the most suitable "
                "available workforce candidate. "
                "The operator must review and "
                "confirm the assignment."
            ),
        },

        "prediction": {
            "available":
                predictive_available,

            "probability":
                normalized_probability,

            "risk_score":
                risk_score,

            "risk_level":
                predictive_risk_level,
        },

        "required_skills":
            required_skills,

        "required_role":
            workforce_required_role,

        "engineer_required":
            workforce_engineer_required,

        "technician_required":
            workforce_technician_required,

        "recommended_role":
            workforce_required_role,

        "recommended_worker":
            recommended_worker,

        # Backward-compatible field for the current frontend.
        "recommended_engineer":
            recommended_engineer,

        "recommendations":
            recommendations,

        "excluded_engineers":
            excluded_workers,

        "scoring_note": (
            "The Maintenance Decision Engine determines "
            "the required workforce role before candidate "
            "ranking. TECHNICIAN means hands-on maintenance "
            "execution; ENGINEER means engineering diagnosis "
            "and review; ENGINEER_AND_TECHNICIAN allows both "
            "roles for complex intervention. Candidates are "
            "then ranked using technical skills, machine "
            "specialization, certifications, availability, "
            "workload capacity, plant area, department and "
            "experience. Technical suitability has priority "
            "over job title. Predictive risk remains "
            "independent from degradation-baseline "
            "availability. The AI recommendation never "
            "automatically assigns personnel; the operator "
            "retains final assignment authority."
        ),
    }