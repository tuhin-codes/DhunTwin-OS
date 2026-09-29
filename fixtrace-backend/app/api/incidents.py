import logging
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.machine import Machine
from app.models.incident import Incident
from app.models.attempt import Attempt
from app.models.memory_operation import MemoryOperation
from app.schemas.incident import (
    IncidentCreate,
    IncidentResolve,
    IncidentResponse,
    CarbonTwinIngestRequest,
    CarbonTwinIngestResponse,
    HindsightRecallSummary,
    HindsightMemoryItem,
    StructuredGuidance
)
from app.schemas.attempt import AttemptCreate, AttemptResponse
from app.services.hindsight_service import hindsight_service, HindsightServiceError

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    machine_id: Optional[str] = Query(None, description="Filter by machine ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (OPEN, IN_PROGRESS, RESOLVED)"),
    db: Session = Depends(get_db)
):
    """List all incidents with optional filtering."""
    query = db.query(Incident)
    if machine_id:
        query = query.filter(Incident.machine_id == machine_id)
    if status_filter:
        query = query.filter(Incident.status == status_filter.upper())
    
    return query.order_by(Incident.created_at.desc()).all()

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    """Create a new maintenance incident and flag the associated machine."""
    machine = db.query(Machine).filter(Machine.id == payload.machine_id).first()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine '{payload.machine_id}' does not exist."
        )

    # Generate readable ID if not provided
    incident_id = payload.id if payload.id else f"INC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    # Check for duplicate ID
    existing = db.query(Incident).filter(Incident.id == incident_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incident with ID '{incident_id}' already exists."
        )

    incident = Incident(
        id=incident_id,
        machine_id=payload.machine_id,
        symptoms=payload.symptoms,
        operating_conditions=payload.operating_conditions,
        severity=payload.severity,
        status="OPEN",
        technician_name=payload.technician_name
    )
    db.add(incident)

    # Update machine status to WARNING or MAINTENANCE based on severity
    if payload.severity in ["HIGH", "CRITICAL"]:
        machine.status = "MAINTENANCE"
    else:
        machine.status = "WARNING"

    db.commit()
    db.refresh(incident)
    return incident


def extract_guidance_from_memories(memory_items: List[HindsightMemoryItem]) -> StructuredGuidance:
    if not memory_items:
        return StructuredGuidance(
            prior_experience_found=False,
            summary="No prior experience found in Hindsight persistent memory.",
            failed_actions=[],
            successful_action=None,
            root_cause=None,
            lesson_learned=None,
            best_match_score=None
        )

    failed_actions: List[str] = []
    successful_action: Optional[str] = None
    root_cause: Optional[str] = None
    lesson_learned: Optional[str] = None
    best_score: Optional[float] = None

    for item in memory_items:
        text = item.text or ""
        # Score tracking (supports dict or RecallScores model)
        if item.scores:
            s = None
            if isinstance(item.scores, dict):
                s = item.scores.get("final") or item.scores.get("reranker") or item.scores.get("semantic")
            else:
                s = getattr(item.scores, "final", None) or getattr(item.scores, "reranker", None) or getattr(item.scores, "semantic", None)
            if s is not None and (best_score is None or float(s) > best_score):
                best_score = round(float(s), 4)

        # Parse root cause
        if not root_cause:
            for line in text.splitlines():
                if "Root cause" in line or "Root Cause:" in line or "failure due to" in line:
                    if "Root Cause:" in line:
                        root_cause = line.split("Root Cause:")[-1].strip(" :|-")
                    elif "Root cause of incident" in line or "root cause of incident" in line.lower():
                        root_cause = line.split("|")[0].strip(" :|-")
                    else:
                        root_cause = line.split("Root cause")[-1].strip(" :|-")
                    break

        # Parse lesson learned
        if not lesson_learned:
            for line in text.splitlines():
                if "Lesson learned" in line or "Lesson Learned:" in line or "lesson learned" in line:
                    parts = line.split("Lesson Learned:") if "Lesson Learned:" in line else line.split("Lesson learned:")
                    lesson_learned = parts[-1].strip(" :|-")
                    break

        # Parse successful action
        if not successful_action:
            for line in text.splitlines():
                if "Successful Fix:" in line or "Successfully fixed" in line or "SUCCESS -" in line:
                    parts = line.split("Successful Fix:") if "Successful Fix:" in line else line.split("SUCCESS -")
                    successful_action = parts[-1].strip(" :|-")
                    break

        # Parse failed attempts
        for line in text.splitlines():
            if "FAILED -" in line:
                for part in line.split(";"):
                    p = part.strip()
                    if "FAILED -" in p and p not in failed_actions:
                        failed_actions.append(p)
            elif "failed attempts at" in line or "Attempted repairs including" in line:
                clean_p = line.strip(" |-\n")
                if clean_p and clean_p not in failed_actions:
                    failed_actions.append(clean_p)
            elif ("attempt" in line.lower() or "maintenance" in line.lower()) and ("fail" in line.lower() or "unsuccessful" in line.lower() or "did not resolve" in line.lower()):
                clean_p = line.split("|")[0].strip(" |-\n")
                if clean_p and clean_p not in failed_actions:
                    failed_actions.append(clean_p)

    # Fallback heuristic extraction if explicit prefix markers are absent
    if not root_cause:
        for item in memory_items:
            lower = item.text.lower()
            if "root cause" in lower or "cause was" in lower or "cause is" in lower:
                for segment in item.text.split("|"):
                    if "cause" in segment.lower():
                        root_cause = segment.strip(" |-\n")
                        break
                if root_cause:
                    break

    if not successful_action:
        for item in memory_items:
            lower = item.text.lower()
            if any(k in lower for k in ["successfully", "repaired", "fixed", "resolved", "replaced"]):
                for segment in item.text.split("|"):
                    if any(k in segment.lower() for k in ["successfully", "repaired", "fixed", "resolved", "replaced"]):
                        successful_action = segment.strip(" |-\n")
                        break
                if successful_action:
                    break

    if not lesson_learned:
        for item in memory_items:
            lower = item.text.lower()
            if any(k in lower for k in ["lesson", "lesson learned", "maintenance lesson", "avoid", "ensure"]):
                for segment in item.text.split("|"):
                    if any(k in segment.lower() for k in ["lesson", "avoid", "ensure"]):
                        lesson_learned = segment.strip(" |-\n")
                        break
                if lesson_learned:
                    break

    return StructuredGuidance(
        prior_experience_found=True,
        summary=f"Retrieved {len(memory_items)} relevant maintenance experience unit(s) from Hindsight memory bank.",
        failed_actions=failed_actions,
        successful_action=successful_action,
        root_cause=root_cause,
        lesson_learned=lesson_learned,
        best_match_score=best_score
    )


def execute_hindsight_recall(
    query: str,
    tags: Optional[List[str]] = None,
    incident_id: Optional[str] = None,
    machine_id: Optional[str] = None,
    db: Optional[Session] = None
) -> HindsightRecallSummary:
    if not hindsight_service.is_configured():
        return HindsightRecallSummary(
            status="unconfigured",
            configured=False,
            message="Hindsight memory layer is unconfigured. Set HINDSIGHT_API_KEY in .env.",
            query=query,
            prior_experience_found=False,
            count=0,
            guidance=StructuredGuidance(
                prior_experience_found=False,
                summary="Hindsight memory layer is unconfigured.",
                failed_actions=[],
                successful_action=None,
                root_cause=None,
                lesson_learned=None,
                best_match_score=None
            ),
            memories=[]
        )

    try:
        recall_resp = hindsight_service.recall(
            query=query,
            budget="mid",
            tags=tags
        )
        raw_results = recall_resp.results or []
        memory_items = [
            HindsightMemoryItem(
                id=item.id,
                text=item.text,
                type=item.type,
                tags=item.tags,
                context=item.context,
                scores=item.scores
            )
            for item in raw_results
        ]
        guidance = extract_guidance_from_memories(memory_items)
        prior_found = len(memory_items) > 0
        message = (
            f"Retrieved {len(memory_items)} prior maintenance experiences from bank '{hindsight_service.bank_id}'."
            if prior_found
            else f"No prior experience found in memory bank '{hindsight_service.bank_id}' for this machine and symptom profile."
        )

        # Log recall operation for Hackathon Observability & Evidence Layer
        if db:
            try:
                import json
                mem_op = MemoryOperation(
                    operation_type="RECALL",
                    incident_id=incident_id,
                    machine_id=machine_id,
                    bank_id=hindsight_service.bank_id or "fixtrace-demo-01",
                    query=query,
                    prior_experience_found=prior_found,
                    memories_count=len(memory_items),
                    best_match_score=guidance.best_match_score,
                    failed_actions=json.dumps(guidance.failed_actions) if guidance.failed_actions else None,
                    successful_action=guidance.successful_action,
                    root_cause=guidance.root_cause,
                    lesson_learned=guidance.lesson_learned,
                )
                db.add(mem_op)
                db.commit()
            except Exception as log_err:
                logger.warning(f"Could not persist recall operation to observability audit log: {log_err}")

        return HindsightRecallSummary(
            status="connected",
            configured=True,
            message=message,
            query=query,
            prior_experience_found=prior_found,
            count=len(memory_items),
            guidance=guidance,
            memories=memory_items
        )
    except HindsightServiceError as err:
        return HindsightRecallSummary(
            status="error",
            configured=True,
            message=f"Hindsight service error: {str(err)}",
            query=query,
            prior_experience_found=False,
            count=0,
            guidance=StructuredGuidance(
                prior_experience_found=False,
                summary=f"Hindsight service error: {str(err)}",
                failed_actions=[],
                successful_action=None,
                root_cause=None,
                lesson_learned=None,
                best_match_score=None
            ),
            memories=[]
        )
    except Exception as err:
        return HindsightRecallSummary(
            status="error",
            configured=True,
            message=f"Hindsight connection error: {str(err)}",
            query=query,
            prior_experience_found=False,
            count=0,
            guidance=StructuredGuidance(
                prior_experience_found=False,
                summary=f"Hindsight connection error: {str(err)}",
                failed_actions=[],
                successful_action=None,
                root_cause=None,
                lesson_learned=None,
                best_match_score=None
            ),
            memories=[]
        )


@router.post("/ingest-carbontwin", response_model=CarbonTwinIngestResponse, status_code=status.HTTP_201_CREATED)
def ingest_carbontwin_incident(payload: CarbonTwinIngestRequest, db: Session = Depends(get_db)):
    """
    Ingest a machine anomaly / incident directly from CarbonTwin OS.
    
    1. Resolves machine fields (supporting both raw machine payload and structured request).
    2. Auto-registers machine in SQLite if not yet present.
    3. Persists incident in SQLite with initial OPEN status and severity.
    4. Constructs semantic recall query from machine type, symptoms, and operating conditions.
    5. Calls real Hindsight recall() if configured.
    6. Returns incident + un-fabricated Hindsight recall results.
    """
    try:
        machine_id = payload.get_resolved_machine_id()
        machine_name = payload.get_resolved_machine_name()
        machine_type = payload.get_resolved_machine_type()
        location = payload.get_resolved_location()
        severity = payload.get_resolved_severity()
        technician_name = payload.get_resolved_technician()
        symptoms = payload.get_resolved_symptoms()
        operating_conditions = payload.get_resolved_operating_conditions()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 1. Check or auto-register machine in SQLite
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    machine_registered = False
    if not machine:
        specs = {
            "department": payload.department,
            "rpm": payload.rpm,
            "power": payload.power,
            "temperature": payload.temperature,
            "vibration": payload.vibration,
            "pressure": payload.pressure,
            "operating_state": payload.operating_state
        }
        machine = Machine(
            id=machine_id,
            name=machine_name,
            machine_type=machine_type,
            location=location,
            status="MAINTENANCE" if severity in ["HIGH", "CRITICAL"] else "WARNING",
            specifications={k: v for k, v in specs.items() if v is not None}
        )
        db.add(machine)
        db.commit()
        db.refresh(machine)
        machine_registered = True
    else:
        if severity in ["HIGH", "CRITICAL"]:
            machine.status = "MAINTENANCE"
        elif machine.status != "MAINTENANCE":
            machine.status = "WARNING"
        db.commit()

    # 2. Generate Incident ID & Persist in SQLite
    incident_id = f"INC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    incident = Incident(
        id=incident_id,
        machine_id=machine_id,
        symptoms=symptoms,
        operating_conditions=operating_conditions,
        severity=severity,
        status="OPEN",
        technician_name=technician_name
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # 3. Formulate genuine Hindsight recall query
    query = f"{machine_type} exhibiting {symptoms} under operating conditions: {operating_conditions}"
    tags = [machine_id, machine_type.lower()]

    # 4. Call Real Hindsight Memory Recall
    hindsight_summary = execute_hindsight_recall(
        query=query,
        tags=tags,
        incident_id=incident.id,
        machine_id=machine_id,
        db=db
    )

    return CarbonTwinIngestResponse(
        incident=IncidentResponse.model_validate(incident),
        hindsight_recall=hindsight_summary,
        machine_registered=machine_registered
    )

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Retrieve an incident with its full attempt history."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found."
        )
    return incident

@router.post("/{incident_id}/attempts", response_model=AttemptResponse, status_code=status.HTTP_201_CREATED)
def log_attempt(incident_id: str, payload: AttemptCreate, db: Session = Depends(get_db)):
    """Log a troubleshooting attempt (action taken, outcome, notes)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found."
        )

    if incident.status == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot log attempt on already RESOLVED incident '{incident_id}'."
        )

    # Compute next attempt number
    current_attempts_count = db.query(Attempt).filter(Attempt.incident_id == incident_id).count()
    next_number = current_attempts_count + 1

    attempt_id = f"ATT-{uuid.uuid4().hex[:8].upper()}"
    attempt = Attempt(
        id=attempt_id,
        incident_id=incident_id,
        attempt_number=next_number,
        action_taken=payload.action_taken,
        result=payload.result,
        observed_notes=payload.observed_notes,
        performed_by=payload.performed_by,
        telemetry_before=payload.telemetry_before,
        telemetry_after=payload.telemetry_after
    )
    db.add(attempt)

    # Automatically transition status to IN_PROGRESS
    incident.status = "IN_PROGRESS"

    db.commit()
    db.refresh(attempt)
    return attempt

@router.post("/{incident_id}/resolve", response_model=IncidentResponse)
@router.patch("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(incident_id: str, payload: IncidentResolve, db: Session = Depends(get_db)):
    """
    Resolve an incident by recording confirmed root cause, resolution summary, and lesson learned.
    Retains the complete troubleshooting experience in Hindsight persistent memory when configured.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found."
        )

    if incident.status == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incident '{incident_id}' is already RESOLVED."
        )

    incident.status = "RESOLVED"
    incident.root_cause = payload.root_cause
    incident.resolution_summary = payload.resolution_summary
    incident.lesson_learned = payload.lesson_learned
    incident.resolved_at = datetime.utcnow()

    # Call real Hindsight retain if configured
    if hindsight_service.is_configured():
        try:
            attempts = db.query(Attempt).filter(Attempt.incident_id == incident_id).order_by(Attempt.attempt_number).all()
            failed_attempts = []
            successful_attempts = []
            for a in attempts:
                telemetry_str = f" [Telemetry before={a.telemetry_before}, after={a.telemetry_after}]" if (a.telemetry_before or a.telemetry_after) else ""
                if a.result == "FAILED":
                    failed_attempts.append(f"Attempt {a.attempt_number} ({a.action_taken}){telemetry_str}: FAILED - {a.observed_notes}")
                elif a.result == "SUCCESSFUL":
                    successful_attempts.append(f"Attempt {a.attempt_number} ({a.action_taken}){telemetry_str}: SUCCESS - {a.observed_notes}")

            success_details = payload.resolution_summary
            if successful_attempts:
                success_details = f"{payload.resolution_summary} | Verified Actions: {'; '.join(successful_attempts)}"

            content = (
                f"[MAINTENANCE EXPERIENCE]\n"
                f"Machine: {incident.machine_id}\n"
                f"Symptoms: {incident.symptoms}\n"
                f"Operating Conditions: {incident.operating_conditions}\n"
                f"Failed Troubleshooting: {'; '.join(failed_attempts) if failed_attempts else 'None'}\n"
                f"Successful Fix: {success_details}\n"
                f"Root Cause: {payload.root_cause}\n"
                f"Lesson Learned: {payload.lesson_learned}"
            )
            retain_res = hindsight_service.retain(
                content=content,
                tags=[incident.machine_id, "maintenance_experience"],
                metadata={"incident_id": incident.id, "machine_id": incident.machine_id}
            )
            op_id = getattr(retain_res, "operation_id", None)
            bank_identifier = getattr(retain_res, "bank_id", "retained")
            incident.hindsight_retained_id = str(op_id if op_id else f"bank-{bank_identifier}")
            logger.info(f"Hindsight retain succeeded for {incident.id}: {incident.hindsight_retained_id}")

            try:
                mem_op = MemoryOperation(
                    operation_type="RETAIN",
                    incident_id=incident.id,
                    machine_id=incident.machine_id,
                    bank_id=hindsight_service.bank_id or "fixtrace-demo-01",
                    retained_id=incident.hindsight_retained_id,
                    successful_action=payload.resolution_summary,
                    root_cause=payload.root_cause,
                    lesson_learned=payload.lesson_learned,
                    content_snippet=content[:300],
                )
                db.add(mem_op)
                db.commit()
            except Exception as log_err:
                logger.warning(f"Could not persist retain operation to observability audit log: {log_err}")
        except Exception as e:
            logger.error(f"Hindsight retain failed during resolve for {incident.id}: {e}", exc_info=True)

    # Check if this machine has any remaining open incidents
    other_open = db.query(Incident).filter(
        Incident.machine_id == incident.machine_id,
        Incident.id != incident.id,
        Incident.status != "RESOLVED"
    ).count()

    if other_open == 0:
        machine = db.query(Machine).filter(Machine.id == incident.machine_id).first()
        if machine:
            machine.status = "OPERATIONAL"

    db.commit()
    db.refresh(incident)
    return incident


@router.get("/{incident_id}/recall", response_model=HindsightRecallSummary)
def get_incident_recall(incident_id: str, db: Session = Depends(get_db)):
    """
    On-demand Hindsight memory recall for a specific incident.
    Exposes prior experience guidance, failed attempts to avoid, verified fixes,
    root cause, and lesson learned for the Workbench UI.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found."
        )

    machine = db.query(Machine).filter(Machine.id == incident.machine_id).first()
    machine_type = machine.machine_type if machine else "Industrial Asset"

    query = f"{machine_type} exhibiting {incident.symptoms} under operating conditions: {incident.operating_conditions}"
    tags = [incident.machine_id, machine_type.lower()]

    return execute_hindsight_recall(
        query=query,
        tags=tags,
        incident_id=incident.id,
        machine_id=incident.machine_id,
        db=db
    )

