import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, get_db
from app.models.machine import Machine
from app.models.incident import Incident
from app.models.memory_operation import MemoryOperation
from app.services.hindsight_service import hindsight_service

TEST_DB_FILE = os.path.join(tempfile.gettempdir(), "test_observability.db")
TEST_DB_URL = f"sqlite:///{TEST_DB_FILE}"

obs_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
ObsSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=obs_engine)

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    old_override = app.dependency_overrides.get(get_db)
    Base.metadata.create_all(bind=obs_engine)

    def _override():
        db = ObsSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides[get_db] = old_override
    Base.metadata.drop_all(bind=obs_engine)


def test_observability_endpoint_structure():
    """Verify that /api/memory/observability returns real, un-fabricated operational and memory state."""
    mock_status = {
        "configured": True,
        "api_url": "https://api.hindsight.vectorize.io",
        "bank_id": "fixtrace-demo-01",
        "reachable": True,
        "latency_ms": 42.5,
        "error": None
    }
    with patch.object(hindsight_service, "get_status", return_value=mock_status):
        response = client.get("/api/memory/observability")
        assert response.status_code == 200
        data = response.json()

        # Core keys
        assert "hindsight_status" in data
        assert "operational_sqlite" in data
        assert "experiential_memory" in data
        assert "lifecycle_events" in data

        # SQLite operational metrics
        sqlite = data["operational_sqlite"]
        assert "machines_registered" in sqlite
        assert "total_incidents" in sqlite
        assert "total_attempts" in sqlite
        assert "resolved_incidents" in sqlite
        assert isinstance(sqlite["machines_registered"], int)

        # Experiential memory metrics
        exp = data["experiential_memory"]
        assert exp["active_bank_id"] == "fixtrace-demo-01"
        assert "total_retain_events" in exp
        assert "total_recall_events" in exp
        assert "recent_retains" in exp
        assert "recent_recalls" in exp
        assert isinstance(exp["recent_retains"], list)
        assert isinstance(exp["recent_recalls"], list)


def test_observability_with_real_operations():
    """Verify retain and recall entries appear accurately in the observability payload."""
    mock_status = {
        "configured": True,
        "api_url": "https://api.hindsight.vectorize.io",
        "bank_id": "fixtrace-demo-01",
        "reachable": True,
        "latency_ms": 38.0,
        "error": None
    }

    db = ObsSessionLocal()
    # Insert test retain operation
    retain_op = MemoryOperation(
        operation_type="RETAIN",
        incident_id="INC-TEST-001",
        machine_id="MTR-001",
        bank_id="fixtrace-demo-01",
        retained_id="bank-fixtrace-demo-01",
        successful_action="Replaced inner bearing assembly",
        root_cause="Fatigue spalling",
        lesson_learned="Perform demodulation vibration analysis",
        content_snippet="[MAINTENANCE EXPERIENCE] Machine: MTR-001"
    )
    # Insert test recall operation
    recall_op = MemoryOperation(
        operation_type="RECALL",
        incident_id="INC-TEST-001",
        machine_id="MTR-001",
        bank_id="fixtrace-demo-01",
        query="Motor exhibiting vibration",
        prior_experience_found=True,
        memories_count=3,
        best_match_score=1.042,
        failed_actions='["Greased bearing", "Realigned coupling"]',
        successful_action="Replaced inner bearing assembly",
        root_cause="Fatigue spalling",
        lesson_learned="Perform demodulation vibration analysis"
    )
    db.add(retain_op)
    db.add(recall_op)
    db.commit()
    db.close()

    with patch.object(hindsight_service, "get_status", return_value=mock_status):
        response = client.get("/api/memory/observability")
        assert response.status_code == 200
        data = response.json()

        exp = data["experiential_memory"]
        assert len(exp["recent_retains"]) >= 1
        assert len(exp["recent_recalls"]) >= 1

        rec = exp["recent_recalls"][0]
        assert rec["incident_id"] == "INC-TEST-001"
        assert rec["machine_id"] == "MTR-001"
        assert rec["best_match_score"] == 1.042
        assert rec["prior_experience_found"] is True
        assert "Greased bearing" in rec["failed_actions"]

        ret = exp["recent_retains"][0]
        assert ret["incident_id"] == "INC-TEST-001"
        assert ret["retained_id"] == "bank-fixtrace-demo-01"
        assert ret["root_cause"] == "Fatigue spalling"
