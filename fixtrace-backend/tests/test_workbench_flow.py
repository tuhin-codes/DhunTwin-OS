import os
import tempfile
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from hindsight_client import RecallResponse, RecallResult, RetainResponse

from app.main import app
from app.database import Base, get_db
from app.models.incident import Incident
from app.models.attempt import Attempt
from app.models.machine import Machine
from app.services.hindsight_service import hindsight_service, HindsightServiceError
from app.schemas.incident import (
    CarbonTwinIngestRequest,
    CarbonTwinIngestResponse,
    HindsightRecallSummary,
    StructuredGuidance
)
from app.schemas.attempt import AttemptResponse

TEST_DB_FILE = os.path.join(tempfile.gettempdir(), "test_workbench_flow.db")
TEST_DB_URL = f"sqlite:///{TEST_DB_FILE}"

workbench_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
WorkbenchSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=workbench_engine)

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    old_override = app.dependency_overrides.get(get_db)
    Base.metadata.create_all(bind=workbench_engine)

    def _override():
        db = WorkbenchSessionLocal()
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
    Base.metadata.drop_all(bind=workbench_engine)
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


RAW_MTR001_PAYLOAD = {
    "id": "MTR-001",
    "name": "Production Motor 1",
    "type": "Motor",
    "department": "Production",
    "location": "Plant B",
    "temperature": 85.6,
    "vibration": 3.42,
    "rpm": 1785,
    "power": 290.0,
    "operating_state": "RUNNING",
    "symptoms": "Elevated 120Hz vibration harmonics and bearing thermal spike",
    "operating_conditions": "RPM: 1785, Temp: 85.6C, Load: 88%",
    "technician_name": "Marcus Vance"
}


def test_first_incident_with_empty_demo_bank():
    """Verify first incident ingestion against clean demo bank returns honest empty prior experience."""
    mock_empty_recall = RecallResponse(results=[])

    with patch.object(hindsight_service, "is_configured", return_value=True), \
         patch.object(hindsight_service, "recall", return_value=mock_empty_recall):

        res = client.post("/api/incidents/ingest-carbontwin", json=RAW_MTR001_PAYLOAD)
        assert res.status_code == 201
        data = res.json()

        # Incident verification
        assert data["incident"]["id"] is not None
        assert data["incident"]["status"] == "OPEN"
        assert data["incident"]["machine_id"] == "MTR-001"

        # Honest un-fabricated recall verification
        recall = data["hindsight_recall"]
        assert recall["status"] == "connected"
        assert recall["configured"] is True
        assert recall["prior_experience_found"] is False
        assert recall["count"] == 0
        assert "No prior experience found" in recall["message"]
        assert recall["guidance"]["prior_experience_found"] is False
        assert recall["guidance"]["failed_actions"] == []
        assert recall["guidance"]["successful_action"] is None
        assert recall["guidance"]["root_cause"] is None
        assert recall["memories"] == []


def test_failed_and_successful_attempt_recording_with_telemetry():
    """Verify logging attempts with action, outcome, notes, and telemetry before/after."""
    # 1. Create base incident
    with patch.object(hindsight_service, "is_configured", return_value=False):
        res_inc = client.post("/api/incidents/ingest-carbontwin", json=RAW_MTR001_PAYLOAD)
        inc_id = res_inc.json()["incident"]["id"]

    # 2. Record FAILED attempt with telemetry
    att1_payload = {
        "action_taken": "Applied high-viscosity synthetic grease to drive-end bearing",
        "result": "FAILED",
        "observed_notes": "Vibration remained at 3.42 mm/s; housing temp climbed to 91C within 15 mins",
        "performed_by": "Tech A",
        "telemetry_before": "vib: 3.42 mm/s, temp: 85.6C",
        "telemetry_after": "vib: 3.40 mm/s, temp: 91.2C"
    }
    res_att1 = client.post(f"/api/incidents/{inc_id}/attempts", json=att1_payload)
    assert res_att1.status_code == 201
    d1 = res_att1.json()
    assert d1["attempt_number"] == 1
    assert d1["result"] == "FAILED"
    assert d1["telemetry_before"] == "vib: 3.42 mm/s, temp: 85.6C"
    assert d1["telemetry_after"] == "vib: 3.40 mm/s, temp: 91.2C"

    # Status transitioned to IN_PROGRESS
    res_get = client.get(f"/api/incidents/{inc_id}")
    assert res_get.json()["status"] == "IN_PROGRESS"

    # 3. Record SUCCESSFUL attempt with telemetry
    att2_payload = {
        "action_taken": "Replaced drive-end bearing with SKF ceramic hybrid and laser aligned shaft",
        "result": "SUCCESSFUL",
        "observed_notes": "Vibration dropped to 0.78 mm/s ISO normal; temp stabilized at 42C",
        "performed_by": "Senior Tech B",
        "telemetry_before": "vib: 3.40 mm/s, temp: 91.2C",
        "telemetry_after": "vib: 0.78 mm/s, temp: 42.1C"
    }
    res_att2 = client.post(f"/api/incidents/{inc_id}/attempts", json=att2_payload)
    assert res_att2.status_code == 201
    d2 = res_att2.json()
    assert d2["attempt_number"] == 2
    assert d2["result"] == "SUCCESSFUL"
    assert d2["telemetry_after"] == "vib: 0.78 mm/s, temp: 42.1C"


def test_incident_resolution_and_mocked_retain():
    """Verify resolution constructs the full maintenance experience and invokes retain()."""
    with patch.object(hindsight_service, "is_configured", return_value=False):
        res_inc = client.post("/api/incidents/ingest-carbontwin", json=RAW_MTR001_PAYLOAD)
        inc_id = res_inc.json()["incident"]["id"]

    # Log 1 failed, 1 successful attempt
    client.post(f"/api/incidents/{inc_id}/attempts", json={
        "action_taken": "Re-torqued motor mounting bolts",
        "result": "FAILED",
        "observed_notes": "No vibration decrease",
        "performed_by": "Tech A",
        "telemetry_before": "3.4 mm/s",
        "telemetry_after": "3.4 mm/s"
    })
    client.post(f"/api/incidents/{inc_id}/attempts", json={
        "action_taken": "Replaced coupling element",
        "result": "SUCCESSFUL",
        "observed_notes": "Vibration dropped to 0.6 mm/s",
        "performed_by": "Tech A",
        "telemetry_before": "3.4 mm/s",
        "telemetry_after": "0.6 mm/s"
    })

    # Mock RetainResponse
    mock_retain_res = RetainResponse(
        success=True,
        bank_id="fixtrace-demo-01",
        items_count=1,
        var_async=False,
        operation_id="op-retain-demo-77"
    )

    with patch.object(hindsight_service, "is_configured", return_value=True), \
         patch.object(hindsight_service, "retain", return_value=mock_retain_res) as mock_retain:

        resolve_payload = {
            "root_cause": "Coupling elastomeric insert shear failure",
            "resolution_summary": "Installed heavy-duty polyurethane coupling spider and laser-aligned",
            "lesson_learned": "When vibration is predominantly radial at 1X RPM, check spider wear before bearing teardown"
        }
        res_res = client.post(f"/api/incidents/{inc_id}/resolve", json=resolve_payload)
        assert res_res.status_code == 200
        data = res_res.json()
        assert data["status"] == "RESOLVED"
        assert data["root_cause"] == resolve_payload["root_cause"]
        assert data["hindsight_retained_id"] == "op-retain-demo-77"

        # Verify retain arguments
        mock_retain.assert_called_once()
        kwargs = mock_retain.call_args[1]
        retained_content = kwargs["content"]
        assert "MTR-001" in retained_content
        assert "Coupling elastomeric insert shear failure" in retained_content
        assert "Re-torqued motor mounting bolts" in retained_content
        assert "FAILED" in retained_content
        assert "SUCCESS" in retained_content
        assert kwargs["tags"] == ["MTR-001", "maintenance_experience"]
        assert kwargs["metadata"] == {"incident_id": inc_id, "machine_id": "MTR-001"}

    # Attempting to log attempt or resolve again returns 400
    res_late_attempt = client.post(f"/api/incidents/{inc_id}/attempts", json={
        "action_taken": "Late action",
        "result": "FAILED",
        "observed_notes": "late",
        "performed_by": "Tech A"
    })
    assert res_late_attempt.status_code == 400

    res_late_resolve = client.post(f"/api/incidents/{inc_id}/resolve", json=resolve_payload)
    assert res_late_resolve.status_code == 400


def test_mocked_recall_and_structured_guidance():
    """Verify recall correctly parses structured guidance (failed attempts, fix, root cause, lesson) from memories."""
    # Simulated Hindsight memories returned from cloud bank
    mock_results = [
        RecallResult(
            id="mem-1",
            text="Machine MTR-001 experienced failure due to fatigue spalling on the drive-end inner raceway.",
            type="observation",
            tags=["MTR-001", "maintenance_experience"],
            scores={"final": 0.945, "reranker": 0.88, "semantic": 0.85}
        ),
        RecallResult(
            id="mem-2",
            text="Lesson learned: 120Hz harmonics combined with ultrasonic spikes indicate early raceway spalling requiring immediate replacement.",
            type="world",
            tags=["MTR-001", "maintenance_experience"],
            scores={"final": 0.892, "reranker": 0.82, "semantic": 0.81}
        ),
        RecallResult(
            id="mem-3",
            text="Successfully fixed MTR-001 by replacing the drive-end bearing with an SKF 6208 ceramic hybrid and laser-aligning shaft.",
            type="world",
            tags=["MTR-001", "maintenance_experience"],
            scores={"final": 0.780, "reranker": 0.71, "semantic": 0.75}
        ),
        RecallResult(
            id="mem-4",
            text="Attempt 1 (Applied grease): FAILED - Vibration persisted; Attempt 2 (Adjusted belt tension): FAILED - Amplitude unchanged",
            type="observation",
            tags=["MTR-001", "maintenance_experience"],
            scores={"final": 0.650, "reranker": 0.58, "semantic": 0.69}
        )
    ]
    mock_recall = RecallResponse(results=mock_results)

    with patch.object(hindsight_service, "is_configured", return_value=True), \
         patch.object(hindsight_service, "recall", return_value=mock_recall):

        # Ingest incident to trigger recall
        res = client.post("/api/incidents/ingest-carbontwin", json=RAW_MTR001_PAYLOAD)
        assert res.status_code == 201
        data = res.json()
        inc_id = data["incident"]["id"]

        recall = data["hindsight_recall"]
        assert recall["prior_experience_found"] is True
        assert recall["count"] == 4

        # Structured guidance verification
        guidance = recall["guidance"]
        assert guidance["prior_experience_found"] is True
        assert "spalling" in guidance["root_cause"].lower()
        assert "lesson" in guidance["lesson_learned"].lower() or "120hz" in guidance["lesson_learned"].lower()
        assert "replacing" in guidance["successful_action"].lower() or "skf" in guidance["successful_action"].lower()
        assert len(guidance["failed_actions"]) >= 1
        assert guidance["best_match_score"] == 0.945

        # Also test on-demand GET /api/incidents/{id}/recall
        res_on_demand = client.get(f"/api/incidents/{inc_id}/recall")
        assert res_on_demand.status_code == 200
        od_data = res_on_demand.json()
        assert od_data["prior_experience_found"] is True
        assert od_data["count"] == 4
        assert od_data["guidance"]["best_match_score"] == 0.945


def test_unconfigured_hindsight_graceful_handling():
    """Verify graceful behavior when Hindsight is unconfigured."""
    with patch.object(hindsight_service, "is_configured", return_value=False):
        res = client.post("/api/incidents/ingest-carbontwin", json=RAW_MTR001_PAYLOAD)
        assert res.status_code == 201
        data = res.json()

        recall = data["hindsight_recall"]
        assert recall["status"] == "unconfigured"
        assert recall["configured"] is False
        assert recall["prior_experience_found"] is False
        assert recall["memories"] == []


def test_hindsight_service_failure_graceful_handling():
    """Verify system does not crash when Hindsight cloud raises network/cluster error."""
    with patch.object(hindsight_service, "is_configured", return_value=True), \
         patch.object(hindsight_service, "recall", side_effect=HindsightServiceError("Vectorize cluster 504 Gateway Timeout", status_code=504)):

        res = client.post("/api/incidents/ingest-carbontwin", json=RAW_MTR001_PAYLOAD)
        assert res.status_code == 201
        data = res.json()

        recall = data["hindsight_recall"]
        assert recall["status"] == "error"
        assert "Vectorize cluster 504 Gateway Timeout" in recall["message"]
        assert recall["prior_experience_found"] is False
        assert recall["memories"] == []


def test_response_serialization_schemas():
    """Verify Pydantic response models serialize properly."""
    with patch.object(hindsight_service, "is_configured", return_value=False):
        res = client.post("/api/incidents/ingest-carbontwin", json=RAW_MTR001_PAYLOAD)
        assert res.status_code == 201

        # Test Pydantic model validation on the returned payload
        parsed = CarbonTwinIngestResponse.model_validate(res.json())
        assert parsed.incident.machine_id == "MTR-001"
        assert parsed.hindsight_recall.status == "unconfigured"
        assert parsed.machine_registered is True
