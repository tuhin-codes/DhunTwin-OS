import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from unittest.mock import patch
from hindsight_client import RetainResponse
from app.services.hindsight_service import hindsight_service

from app.main import app
from app.database import Base, get_db

# Use an in-memory SQLite database with StaticPool for isolated test execution
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_machine_crud():
    # 1. Create a Machine
    payload = {
        "id": "CNC-MOTOR-104",
        "name": "High-Speed Spindle Motor 104",
        "machine_type": "CNC Milling Spindle",
        "location": "Bay 4 - Precision Machining",
        "status": "OPERATIONAL",
        "specifications": {"voltage": "480V", "max_rpm": 12000}
    }
    res = client.post("/api/machines", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == "CNC-MOTOR-104"
    assert data["status"] == "OPERATIONAL"

    # 2. Reject duplicate Machine ID
    res_dup = client.post("/api/machines", json=payload)
    assert res_dup.status_code == 400

    # 3. List Machines
    res_list = client.get("/api/machines")
    assert res_list.status_code == 200
    machines = res_list.json()
    assert len(machines) == 1
    assert machines[0]["id"] == "CNC-MOTOR-104"

    # 4. Get Machine Detail
    res_get = client.get("/api/machines/CNC-MOTOR-104")
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "High-Speed Spindle Motor 104"

def test_incident_and_attempt_lifecycle():
    # 1. Register base machine
    client.post("/api/machines", json={
        "id": "CNC-MOTOR-104",
        "name": "High-Speed Spindle Motor 104",
        "machine_type": "CNC Milling Spindle",
        "location": "Bay 4",
        "status": "OPERATIONAL"
    })

    # 2. Reject incident for non-existent machine
    res_fail = client.post("/api/incidents", json={
        "machine_id": "NON-EXISTENT-999",
        "symptoms": "Strange rattle",
        "operating_conditions": "Normal",
        "severity": "LOW",
        "technician_name": "Marcus Vance"
    })
    assert res_fail.status_code == 404

    # 3. Create active incident on CNC-MOTOR-104
    inc_payload = {
        "id": "INC-101",
        "machine_id": "CNC-MOTOR-104",
        "symptoms": "Motor overheating during high-load operation",
        "operating_conditions": "Continuous high load (>10,000 RPM, continuous cut >20 min)",
        "severity": "HIGH",
        "technician_name": "Marcus Vance"
    }
    res_inc = client.post("/api/incidents", json=inc_payload)
    assert res_inc.status_code == 201
    inc_data = res_inc.json()
    assert inc_data["id"] == "INC-101"
    assert inc_data["status"] == "OPEN"

    # 4. Machine status should have transitioned to MAINTENANCE (due to HIGH severity)
    res_m = client.get("/api/machines/CNC-MOTOR-104")
    assert res_m.json()["status"] == "MAINTENANCE"

    # 5. Log Attempt 1 (FAILED - Lubrication check)
    att1_payload = {
        "action_taken": "Checked lubrication level and viscosity",
        "result": "FAILED",
        "observed_notes": "Lubrication level was normal; temperature remained high above 85°C",
        "performed_by": "Marcus Vance"
    }
    res_att1 = client.post("/api/incidents/INC-101/attempts", json=att1_payload)
    assert res_att1.status_code == 201
    att1_data = res_att1.json()
    assert att1_data["attempt_number"] == 1
    assert att1_data["result"] == "FAILED"

    # 6. Incident status should have transitioned to IN_PROGRESS
    res_inc_check = client.get("/api/incidents/INC-101")
    assert res_inc_check.json()["status"] == "IN_PROGRESS"
    assert len(res_inc_check.json()["attempts"]) == 1

    # 7. Log Attempt 2 (FAILED - Bearing replacement)
    att2_payload = {
        "action_taken": "Replaced forward spindle bearing",
        "result": "FAILED",
        "observed_notes": "Replaced forward bearing; temperature spiked again after 20 minutes under load",
        "performed_by": "Marcus Vance"
    }
    res_att2 = client.post("/api/incidents/INC-101/attempts", json=att2_payload)
    assert res_att2.status_code == 201
    assert res_att2.json()["attempt_number"] == 2

    # 8. Log Attempt 3 (SUCCESSFUL - Cooling airflow shroud inspection)
    att3_payload = {
        "action_taken": "Inspected cooling airflow shroud",
        "result": "SUCCESSFUL",
        "observed_notes": "Found compressed aluminum chip accumulation choking intake behind shroud. Cleared obstruction.",
        "performed_by": "Marcus Vance"
    }
    res_att3 = client.post("/api/incidents/INC-101/attempts", json=att3_payload)
    assert res_att3.status_code == 201
    assert res_att3.json()["attempt_number"] == 3

    # Verify attempt sequence in Incident
    res_inc_full = client.get("/api/incidents/INC-101")
    attempts = res_inc_full.json()["attempts"]
    assert len(attempts) == 3
    assert [a["attempt_number"] for a in attempts] == [1, 2, 3]

    # 9. Resolve the Incident
    resolve_payload = {
        "root_cause": "Cooling airflow restriction caused by chip buildup behind the motor shroud",
        "resolution_summary": "Cleared compressed aluminum shavings from air intake; airflow normalized",
        "lesson_learned": "For high-load overheating on CNC-MOTOR-104, inspect and clear cooling airflow intake before ordering or executing a bearing replacement."
    }
    mock_retain_res = RetainResponse(success=True, bank_id="test-bank", items_count=1, var_async=False, operation_id="test-op")
    with patch.object(hindsight_service, "retain", return_value=mock_retain_res):
        res_resolve = client.post("/api/incidents/INC-101/resolve", json=resolve_payload)
    assert res_resolve.status_code == 200
    resolved_data = res_resolve.json()
    assert resolved_data["status"] == "RESOLVED"
    assert resolved_data["root_cause"] == resolve_payload["root_cause"]
    assert resolved_data["resolved_at"] is not None

    # 10. Machine status should have transitioned back to OPERATIONAL
    res_m_after = client.get("/api/machines/CNC-MOTOR-104")
    assert res_m_after.json()["status"] == "OPERATIONAL"

    # 11. Cannot log attempt on already RESOLVED incident
    res_late_att = client.post("/api/incidents/INC-101/attempts", json=att1_payload)
    assert res_late_att.status_code == 400
