from fastapi import APIRouter, HTTPException

from app.services.ai_condition_service import (
    AIConditionService,
)

from app.services.maintenance_decision_service import (
    MaintenanceDecisionService,
)


router = APIRouter(
    prefix="/machines",
    tags=["AI Condition"],
)


# ============================================================
# AI CONDITION
# ============================================================

@router.get("/{machine_id}/ai-condition")
def get_ai_condition(machine_id: str):

    result = AIConditionService.analyze(
        machine_id
    )

    if not result.get(
        "available",
        False,
    ):
        raise HTTPException(
            status_code=404,
            detail=result,
        )

    return result


# ============================================================
# MAINTENANCE DECISION
# ============================================================

@router.get("/{machine_id}/maintenance-decision")
def get_maintenance_decision(
    machine_id: str,
):

    # --------------------------------------------------------
    # First obtain the existing AI condition analysis.
    #
    # IMPORTANT:
    # We do not modify the AI condition result.
    # --------------------------------------------------------

    ai_condition = (
        AIConditionService.analyze(
            machine_id
        )
    )

    if not ai_condition.get(
        "available",
        False,
    ):
        raise HTTPException(
            status_code=404,
            detail=ai_condition,
        )

    # --------------------------------------------------------
    # Pass the AI result into the new decision layer.
    # --------------------------------------------------------

    result = (
        MaintenanceDecisionService.analyze(
            ai_condition
        )
    )

    if not result.get(
        "available",
        False,
    ):
        raise HTTPException(
            status_code=404,
            detail=result,
        )

    return result