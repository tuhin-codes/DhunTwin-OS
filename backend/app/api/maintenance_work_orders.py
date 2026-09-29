from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.maintenance_work_order_service import (
    MaintenanceWorkOrderService,
)


router = APIRouter(
    prefix="/maintenance-work-orders",
    tags=["Maintenance Work Orders"],
)


# ============================================================
# CREATE FROM CURRENT LIVE STATE
# ============================================================

@router.post("/{machine_id}/create-from-current-decision")
def create_from_current_decision(
    machine_id: str,
):
    """
    Atomically evaluate the current AI/maintenance state and
    create a work-order snapshot from that exact evaluation.

    The decision is calculated ONCE.

    The resulting work order therefore cannot accidentally
    contain a different decision caused by the Digital Twin
    changing between separate GET and POST requests.
    """

    try:

        return (
            MaintenanceWorkOrderService
            .create_from_current_decision(
                machine_id
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# ============================================================
# CREATE FROM EXPLICIT DECISION SNAPSHOT
# ============================================================

@router.post("/{machine_id}")
def create_work_order(
    machine_id: str,
    decision: dict[str, Any],
):
    """
    Create a work order from an already evaluated
    maintenance-decision snapshot.

    This is useful when the frontend has already received
    the decision and explicitly wants to submit that exact
    decision for work-order creation.
    """

    try:

        return (
            MaintenanceWorkOrderService
            .create_from_decision(
                machine_id,
                decision,
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# ============================================================
# LIST
# ============================================================

@router.get("")
def list_work_orders(
    machine_id: str | None = None,
    status: str | None = None,
):

    return (
        MaintenanceWorkOrderService.list_work_orders(
            machine_id=machine_id,
            status=status,
        )
    )


# ============================================================
# GET
# ============================================================

@router.get("/{work_order_id}")
def get_work_order(
    work_order_id: str,
):

    result = (
        MaintenanceWorkOrderService.get_work_order(
            work_order_id
        )
    )

    if result is None:

        raise HTTPException(
            status_code=404,
            detail="Work order not found.",
        )

    return result


# ============================================================
# APPROVE
# ============================================================

@router.post("/{work_order_id}/approve")
def approve_work_order(
    work_order_id: str,
):

    try:

        return (
            MaintenanceWorkOrderService.approve(
                work_order_id
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# ============================================================
# ASSIGN
# ============================================================

@router.post("/{work_order_id}/assign")
def assign_work_order(
    work_order_id: str,
    technician_id: str,
    technician_name: str | None = None,
):

    try:

        return (
            MaintenanceWorkOrderService.mark_assigned(
                work_order_id,
                technician_id,
                technician_name,
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# ============================================================
# START
# ============================================================

@router.post("/{work_order_id}/start")
def start_work_order(
    work_order_id: str,
):

    try:

        return (
            MaintenanceWorkOrderService.start(
                work_order_id
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# ============================================================
# COMPLETE
# ============================================================

@router.post("/{work_order_id}/complete")
def complete_work_order(
    work_order_id: str,
    completion_note: str = "",
    successful: bool = True,
    repeat_failure: bool = False,
):
    """
    Complete an in-progress work order and record the
    operator's maintenance outcome.

    successful:
        Whether the maintenance intervention successfully
        restored the machine condition.

    repeat_failure:
        Whether the same/similar failure subsequently
        repeated.

    IMPORTANT:

    Completion itself does not automatically imply that
    maintenance was successful. The outcome is explicitly
    recorded so it can later become historical evidence
    for workforce recommendations.
    """

    try:

        return (
            MaintenanceWorkOrderService.complete(
                work_order_id,
                completion_note,
                successful,
                repeat_failure,
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# ============================================================
# CANCEL
# ============================================================

@router.post("/{work_order_id}/cancel")
def cancel_work_order(
    work_order_id: str,
    reason: str = "",
):

    try:

        return (
            MaintenanceWorkOrderService.cancel(
                work_order_id,
                reason,
            )
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )