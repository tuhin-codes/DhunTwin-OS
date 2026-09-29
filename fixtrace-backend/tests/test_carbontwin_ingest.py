import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from hindsight_client import RecallResponse, RecallResult, RetainResponse

import os
import tempfile
from app.main import app
from app.database import Base, get_db
from app import models as app_models  # Ensures Machine, Incident, Attempt are registered on Base.metadata
from app.models.machine import Machine
from app.models.incident import Incident
from app.models.attempt import Attempt
from app.services.hindsight_service import hindsight_service, HindsightServiceError

TEST_DB_FILE = os.path.join(tempfile.gettempdir(), "test_fixtrace_ingest.db")
TEST_DB_URL = f"sqlite:///{TEST_DB_FILE}"

ingest_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
IngestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ingest_engine)

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    old_override = app.dependency_overrides.get(get_db)
    Base.metadata.create_all(bind=ingest_engine)
    def _override():
        db = IngestSessionLocal()
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = _override
    yield
    if old_override is not None:
        app.dependency_overrides[get_db] = old_override
    else:
        app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=ingest_engine)
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

# Real CarbonTwin MTR-001 machine payload snapshot
MTR001_RAW_PAYLOAD = {
    "id": "MTR-001",
    "name": "Production Motor 1",
    "type": "Motor",
    "department": "Production",
    "location": "Plant B",
    "temperature": 85.66,
    "pressure": 3.22,
    "vibration": 1.54,
    "rpm": 1479,
    "torque": 260.95,
    "power": 291.2,
    "energy": 401.24,
    "carbon": 36.08,
    "water": 94.74,
    "utilization": 90.0,
    "operating_state": "RUNNING",
    "production_critical": True,
    "efficiency": 88.0,
    "health_score": 75.9,
    "failure_probability": 24.1,
    "remaining_useful_life": 410,
    "maintenance_status": "Needs Attention",
    "current_technician": "Anil Kapoor",
    "current_ticket": "MT-102",
    "ai_prediction": {
        "available": True,
        "model": "CarbonTwin Predictive Failure Model",
        "machine_id": "MTR-001",
        "machine_type": "Motor",
        "risk": {
            "30m": 0.5604,
            "60m": 0.5618,
            "120m": 0.5904
        },
        "risk_level": "HIGH",
        "risk_score": 0.5904,
        "reason": "The predictive model indicates significant failure risk within the prediction horizon.",
        "recommended_action": "Schedule maintenance inspection as soon as possible."
    }
}

def test_ingest_carbontwin_unconfigured_hindsight():
    """
    Test that ingesting MTR-001 when Hindsight is unconfigured:
    1. Auto-registers MTR-001 in SQLite.
    2. Persists the incident in SQLite.
    3. Returns honest unconfigured memory status with 0 fabricated results.
    """
    with patch.object(hindsight_service, "is_configured", return_value=False):
        res = client.post("/api/incidents/ingest-carbontwin", json=MTR001_RAW_PAYLOAD)
        assert res.status_code == 201
        data = res.json()

        # Check machine auto-registration
        assert data["machine_registered"] is True
        incident = data["incident"]
        assert incident["machine_id"] == "MTR-001"
        assert incident["severity"] == "HIGH"
        assert incident["status"] == "OPEN"
        assert incident["technician_name"] == "Anil Kapoor"
        assert "Vibration 1.54 mm/s" in incident["symptoms"]
        assert "1479 RPM" in incident["operating_conditions"]

        # Check honest memory status
        memory = data["hindsight_recall"]
        assert memory["status"] == "unconfigured"
        assert memory["configured"] is False
        assert memory["prior_experience_found"] is False
        assert memory["count"] == 0
        assert memory["memories"] == []
        assert "Motor" in memory["query"]

        # Check SQLite persistence
        db = IngestSessionLocal()
        db_machine = db.query(Machine).filter(Machine.id == "MTR-001").first()
        assert db_machine is not None
        assert db_machine.name == "Production Motor 1"
        assert db_machine.status == "MAINTENANCE"

        db_incident = db.query(Incident).filter(Incident.id == incident["id"]).first()
        assert db_incident is not None
        assert db_incident.machine_id == "MTR-001"
        db.close()

def test_ingest_carbontwin_with_mocked_hindsight_hit():
    """
    Test that when Hindsight is configured and finds previous experience:
    1. Returns actual un-fabricated memories with real text and real scores.
    2. Flags prior_experience_found as True.
    """
    mock_item = RecallResult(
        id="mem-exp-001",
        text="Previous motor coupling misalignment resolved by re-shimming and balancing rotor; lubrication failed.",
        type="experience",
        tags=["MTR-001", "motor"],
        entities=["MTR-001"],
        scores={"final": 0.92, "semantic_similarity": 0.88}
    )
    mock_resp = RecallResponse(results=[mock_item])

    with patch.object(hindsight_service, "is_configured", return_value=True), \
         patch.object(hindsight_service, "recall", return_value=mock_resp) as mock_recall:

        res = client.post("/api/incidents/ingest-carbontwin", json=MTR001_RAW_PAYLOAD)
        assert res.status_code == 201
        data = res.json()

        memory = data["hindsight_recall"]
        assert memory["status"] == "connected"
        assert memory["configured"] is True
        assert memory["prior_experience_found"] is True
        assert memory["count"] == 1
        assert len(memory["memories"]) == 1
        assert memory["memories"][0]["id"] == "mem-exp-001"
        assert memory["memories"][0]["scores"]["final"] == 0.92

        # Verify exact recall call arguments
        mock_recall.assert_called_once()
        call_kwargs = mock_recall.call_args[1]
        assert "MTR-001" in call_kwargs["tags"]
        assert "motor" in call_kwargs["tags"]
        assert "Vibration 1.54 mm/s" in call_kwargs["query"]

def test_ingest_carbontwin_zero_shot_no_prior_memory():
    """
    Test zero-shot case (Incident 1):
    When Hindsight search returns 0 results:
    1. Returns prior_experience_found: False.
    2. Does NOT fabricate fallback advice or fake memories.
    """
    mock_resp = RecallResponse(results=[])

    with patch.object(hindsight_service, "is_configured", return_value=True), \
         patch.object(hindsight_service, "recall", return_value=mock_resp):

        res = client.post("/api/incidents/ingest-carbontwin", json=MTR001_RAW_PAYLOAD)
        assert res.status_code == 201
        data = res.json()

        memory = data["hindsight_recall"]
        assert memory["status"] == "connected"
        assert memory["configured"] is True
        assert memory["prior_experience_found"] is False
        assert memory["count"] == 0
        assert memory["memories"] == []

def test_ingest_carbontwin_hindsight_service_error():
    """
    Test graceful degradation when Hindsight raises an error or is unreachable:
    1. Incident is still safely persisted in SQLite.
    2. Returns status: 'error' without crashing.
    3. No fabricated memories returned.
    """
    with patch.object(hindsight_service, "is_configured", return_value=True), \
         patch.object(hindsight_service, "recall", side_effect=HindsightServiceError("Vectorize cluster timeout", status_code=504)):

        res = client.post("/api/incidents/ingest-carbontwin", json=MTR001_RAW_PAYLOAD)
        assert res.status_code == 201
        data = res.json()

        assert data["incident"]["id"] is not None
        memory = data["hindsight_recall"]
        assert memory["status"] == "error"
        assert "Vectorize cluster timeout" in memory["message"]
        assert memory["prior_experience_found"] is False
        assert memory["memories"] == []

def test_incident_resolve_triggers_hindsight_retention():
    """
    Test that resolving an incident triggers Hindsight retain() with:
    - Failed attempts
    - Successful fix
    - Root cause
    - Lesson learned
    """
    # 1. Ingest incident
    with patch.object(hindsight_service, "is_configured", return_value=False):
        res = client.post("/api/incidents/ingest-carbontwin", json=MTR001_RAW_PAYLOAD)
        inc_id = res.json()["incident"]["id"]

    # 2. Log Attempt 1 (FAILED - Lubrication)
    client.post(f"/api/incidents/{inc_id}/attempts", json={
        "action_taken": "Applied grease to motor drive-end bearing",
        "result": "FAILED",
        "observed_notes": "Vibration remained at 1.54 mm/s; no thermal improvement.",
        "performed_by": "Anil Kapoor"
    })

    # 3. Log Attempt 2 (SUCCESSFUL - Coupling realignment)
    client.post(f"/api/incidents/{inc_id}/attempts", json={
        "action_taken": "Realigned motor coupling with laser tool and torqued bolts",
        "result": "SUCCESSFUL",
        "observed_notes": "Vibration dropped to 0.78 mm/s; temperature stabilized at 72°C.",
        "performed_by": "Anil Kapoor"
    })

    # 4. Resolve Incident with Mocked Retain
    mock_retain_res = RetainResponse(
        success=True,
        bank_id="fixtrace-industrial-01",
        items_count=1,
        var_async=False,
        operation_id="op-retain-9988"
    )

    with patch.object(hindsight_service, "is_configured", return_value=True), \
         patch.object(hindsight_service, "retain", return_value=mock_retain_res) as mock_retain:

        resolve_payload = {
            "root_cause": "Angular and parallel coupling misalignment causing 1X vibration harmonic",
            "resolution_summary": "Realigned coupling to within 0.05 mm tolerance; balanced rotor",
            "lesson_learned": "When MTR-001 shows 1.5+ mm/s vibration at 1480 RPM, check coupling alignment before bearing lubrication."
        }
        res_res = client.post(f"/api/incidents/{inc_id}/resolve", json=resolve_payload)
        assert res_res.status_code == 200
        data = res_res.json()
        assert data["status"] == "RESOLVED"
        assert data["hindsight_retained_id"] == "op-retain-9988"

        mock_retain.assert_called_once()
        retain_call_kwargs = mock_retain.call_args[1]
        retained_content = retain_call_kwargs["content"]
        assert "MTR-001" in retained_content
        assert "Applied grease" in retained_content
        assert "FAILED" in retained_content
        assert "Realigned coupling" in retained_content
        assert "Angular and parallel coupling misalignment" in retained_content
        assert "check coupling alignment before bearing lubrication" in retained_content
