from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.optimization_service import (
    OptimizationService,
)


router = APIRouter(
    prefix="/optimization",
    tags=["Optimization"],
)


class OptimizationRequest(BaseModel):
    target_carbon: float = Field(
        ...,
        gt=0,
        description="Maximum allowed factory carbon in kg CO2e.",
    )


@router.post("/preview")
def preview_optimization(
    request: OptimizationRequest,
):
    try:
        return OptimizationService.preview(
            request.target_carbon
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.post("/apply")
def apply_optimization(
    request: OptimizationRequest,
):
    try:
        return OptimizationService.apply(
            request.target_carbon
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.post("/reset")
def reset_optimization():
    return OptimizationService.reset()