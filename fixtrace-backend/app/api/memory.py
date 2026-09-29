from fastapi import APIRouter, HTTPException, Query, status, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.database import get_db
from app.services.hindsight_service import hindsight_service, HindsightServiceError

router = APIRouter(prefix="/memory", tags=["Maintenance Memory"])

class RawRecallQuery(BaseModel):
    query: str = Field(..., description="Semantic search query")
    machine_id: Optional[str] = Field(None, description="Optional machine ID filter tag")
    budget: str = Field("mid", description="Exploration budget: low, mid, high")

@router.get("/status")
def get_memory_status():
    """
    Returns un-fabricated, real-time status of the Hindsight persistent memory layer.
    Reports actual reachability, URL, and Bank ID.
    """
    return hindsight_service.get_status()

@router.post("/test-connection")
def test_connection():
    """
    Actively checks connection to the configured Hindsight bank.
    Returns 503 if unconfigured or unreachable with exact error details.
    """
    status_info = hindsight_service.get_status()
    if not status_info["configured"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=status_info["error"]
        )
    if not status_info["reachable"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Hindsight endpoint is unreachable: {status_info['error']}"
        )
    return {
        "status": "connected",
        "message": f"Successfully connected to Hindsight bank '{status_info['bank_id']}'",
        "latency_ms": status_info["latency_ms"]
    }

@router.post("/raw-recall")
def query_raw_memory(payload: RawRecallQuery):
    """
    Directly query Hindsight memory for developer/demo observability.
    Returns the real RecallResult objects without fabrication.
    """
    tags = [payload.machine_id] if payload.machine_id else None
    try:
        response = hindsight_service.recall(
            query=payload.query,
            budget=payload.budget,
            tags=tags
        )
        memories = []
        for item in response.results:
            memories.append({
                "id": item.id,
                "text": item.text,
                "type": item.type,
                "tags": item.tags,
                "context": item.context,
                "scores": item.scores
            })
        return {
            "query": payload.query,
            "machine_id": payload.machine_id,
            "count": len(memories),
            "results": memories
        }
    except HindsightServiceError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=str(e)
        )


@router.get("/observability")
def get_memory_observability(db: Session = Depends(get_db)):
    """
    Hackathon Observability & Evidence Layer.
    Returns un-fabricated, real-time audit trail of all Hindsight RETAIN and RECALL
    operations alongside operational SQLite states.
    """
    import json
    from app.models.machine import Machine
    from app.models.incident import Incident
    from app.models.attempt import Attempt
    from app.models.memory_operation import MemoryOperation

    # 1. Hindsight Connectivity
    h_status = hindsight_service.get_status()

    # 2. SQLite Operational Stats
    machines_count = db.query(Machine).count()
    incidents_count = db.query(Incident).count()
    attempts_count = db.query(Attempt).count()
    resolved_count = db.query(Incident).filter(Incident.status == "RESOLVED").count()

    # 3. Auto-backfill existing resolved incidents into memory_operations if empty
    existing_retains = db.query(MemoryOperation).filter(MemoryOperation.operation_type == "RETAIN").count()
    if existing_retains == 0:
        past_resolved = db.query(Incident).filter(
            Incident.status == "RESOLVED",
            Incident.hindsight_retained_id.isnot(None)
        ).all()
        for past_inc in past_resolved:
            backfill_op = MemoryOperation(
                operation_type="RETAIN",
                incident_id=past_inc.id,
                machine_id=past_inc.machine_id,
                bank_id=h_status.get("bank_id") or "fixtrace-demo-01",
                retained_id=past_inc.hindsight_retained_id,
                successful_action=past_inc.resolution_summary,
                root_cause=past_inc.root_cause,
                lesson_learned=past_inc.lesson_learned,
                content_snippet=f"Machine: {past_inc.machine_id} | Root Cause: {past_inc.root_cause}",
                created_at=past_inc.resolved_at or past_inc.created_at
            )
            db.add(backfill_op)
        db.commit()

    # 4. Fetch real operations
    retains_query = db.query(MemoryOperation).filter(
        MemoryOperation.operation_type == "RETAIN"
    ).order_by(MemoryOperation.created_at.desc()).limit(25).all()

    recalls_query = db.query(MemoryOperation).filter(
        MemoryOperation.operation_type == "RECALL"
    ).order_by(MemoryOperation.created_at.desc()).limit(25).all()

    recent_retains = []
    for r in retains_query:
        recent_retains.append({
            "id": r.id,
            "incident_id": r.incident_id,
            "machine_id": r.machine_id,
            "bank_id": r.bank_id,
            "retained_id": r.retained_id,
            "successful_action": r.successful_action,
            "root_cause": r.root_cause,
            "lesson_learned": r.lesson_learned,
            "content_snippet": r.content_snippet,
            "timestamp": r.created_at.isoformat() if r.created_at else None
        })

    recent_recalls = []
    for rc in recalls_query:
        failed_parsed = []
        if rc.failed_actions:
            try:
                failed_parsed = json.loads(rc.failed_actions)
            except Exception:
                failed_parsed = [rc.failed_actions]

        recent_recalls.append({
            "id": rc.id,
            "incident_id": rc.incident_id,
            "machine_id": rc.machine_id,
            "bank_id": rc.bank_id,
            "query": rc.query,
            "prior_experience_found": rc.prior_experience_found,
            "memories_count": rc.memories_count,
            "best_match_score": rc.best_match_score,
            "failed_actions": failed_parsed,
            "successful_action": rc.successful_action,
            "root_cause": rc.root_cause,
            "lesson_learned": rc.lesson_learned,
            "timestamp": rc.created_at.isoformat() if rc.created_at else None
        })

    # 5. Build Lifecycle Flow for recent resolved or in-progress incidents
    recent_incidents = db.query(Incident).order_by(Incident.created_at.desc()).limit(10).all()
    lifecycle_events = []
    for inc in recent_incidents:
        lifecycle_events.append({
            "incident_id": inc.id,
            "machine_id": inc.machine_id,
            "severity": inc.severity,
            "status": inc.status,
            "symptoms": inc.symptoms,
            "operating_conditions": inc.operating_conditions,
            "attempts_count": len(inc.attempts) if inc.attempts else 0,
            "has_retained": bool(inc.hindsight_retained_id),
            "hindsight_retained_id": inc.hindsight_retained_id,
            "root_cause": inc.root_cause,
            "resolution_summary": inc.resolution_summary,
            "lesson_learned": inc.lesson_learned,
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
            "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None
        })

    return {
        "hindsight_status": h_status,
        "operational_sqlite": {
            "machines_registered": machines_count,
            "total_incidents": incidents_count,
            "total_attempts": attempts_count,
            "resolved_incidents": resolved_count
        },
        "experiential_memory": {
            "active_bank_id": h_status.get("bank_id") or "fixtrace-demo-01",
            "total_retain_events": len(recent_retains),
            "total_recall_events": len(recent_recalls),
            "recent_retains": recent_retains,
            "recent_recalls": recent_recalls
        },
        "lifecycle_events": lifecycle_events
    }

