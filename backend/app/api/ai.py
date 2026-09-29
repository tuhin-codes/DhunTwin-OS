from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ai.engine import AIEngine
from app.ai.copilot_service import CopilotService
from app.digital_twin.runtime import DigitalTwinRuntime


router = APIRouter(
    prefix="/ai",
    tags=["Artificial Intelligence"],
)


# ============================================================
# COPILOT REQUEST MODEL
# ============================================================

class CopilotMessage(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=4000,
    )

    history: list[dict[str, str]] = Field(
        default_factory=list,
    )

    machine_id: str | None = None


# ============================================================
# MACHINE AI ANALYSIS
# ============================================================

@router.get("/machine/{machine_id}")
def analyze_machine(
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

    return AIEngine.analyze(
        machine
    )


# ============================================================
# SUSTAINABILITY AI
# ============================================================

@router.get("/sustainability")
def sustainability():

    return AIEngine.sustainability()


# ============================================================
# FACTORY AI
# ============================================================

@router.get("/factory")
def analyze_factory():

    machines = (
        DigitalTwinRuntime.machines()
    )

    results = []

    for machine in machines:

        results.append(
            {
                "machine": machine.id,
                "analysis": AIEngine.analyze(
                    machine
                ),
            }
        )

    return results


# ============================================================
# REAL AI COPILOT
# ============================================================

@router.post("/copilot")
def copilot(
    request: CopilotMessage,
) -> dict[str, Any]:

    try:

        result = CopilotService.chat(
            message=request.message,
            history=request.history,
            machine_id=request.machine_id,
        )

        return result

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except RuntimeError as exc:

        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "AI Copilot failed: "
                f"{exc}"
            ),
        )