from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from hindsight_client import RecallResponse, RecallResult, RetainResponse, ReflectResponse

from app.main import app
from app.services.hindsight_service import HindsightService, HindsightServiceError, hindsight_service

client = TestClient(app)

def test_unconfigured_service():
    """Verify that unconfigured Hindsight returns honest status and does not fabricate data."""
    service = HindsightService()
    # Force unconfigured state
    service.api_key = ""
    service.base_url = "https://api.hindsight.vectorize.io"
    service._client = None

    status_info = service.get_status()
    assert status_info["configured"] is False
    assert status_info["reachable"] is False
    assert "not configured" in status_info["error"]
    assert status_info["latency_ms"] is None # No fabricated latency!

    # Attempting retain without config must raise HindsightServiceError
    with pytest.raises(HindsightServiceError) as exc_info:
        service.retain(content="Test maintenance experience")
    assert "unconfigured" in str(exc_info.value)
    assert exc_info.value.status_code == 503

    # Attempting recall without config must raise HindsightServiceError
    with pytest.raises(HindsightServiceError) as exc_info:
        service.recall(query="Test query")
    assert "unconfigured" in str(exc_info.value)

def test_configured_service_mocked_calls():
    """Verify that HindsightService correctly interfaces with official SDK methods."""
    service = HindsightService()
    service.api_key = "test_key_xyz"
    service.base_url = "https://api.hindsight.vectorize.io"
    service.bank_id = "fixtrace-test-bank"

    mock_client = MagicMock()
    service._client = mock_client

    # 1. Test Retain Call
    mock_retain_res = RetainResponse(
        success=True,
        bank_id="fixtrace-test-bank",
        items_count=1,
        var_async=False,
        operation_id="op-123"
    )
    mock_client.retain.return_value = mock_retain_res

    res = service.retain(
        content="[MAINTENANCE] Machine CNC-MOTOR-104 overheat resolved by clearing shroud",
        tags=["CNC-MOTOR-104", "overheating"],
        metadata={"machine_id": "CNC-MOTOR-104"}
    )
    assert res.success is True
    assert res.bank_id == "fixtrace-test-bank"
    mock_client.retain.assert_called_once_with(
        bank_id="fixtrace-test-bank",
        content="[MAINTENANCE] Machine CNC-MOTOR-104 overheat resolved by clearing shroud",
        tags=["CNC-MOTOR-104", "overheating"],
        metadata={"machine_id": "CNC-MOTOR-104"},
        context=None,
        retain_async=False
    )

    # 2. Test Recall Call
    mock_recall_result = RecallResult(
        id="mem-001",
        text="Cooling airflow shroud inspection was successful; bearing replacement failed previously.",
        type="experience",
        entities=["CNC-MOTOR-104"],
        tags=["CNC-MOTOR-104"]
    )
    mock_recall_res = RecallResponse(
        results=[mock_recall_result]
    )
    mock_client.recall.return_value = mock_recall_res

    recall_res = service.recall(query="CNC-MOTOR-104 high-load overheat", budget="high")
    assert len(recall_res.results) == 1
    assert recall_res.results[0].id == "mem-001"
    assert "Cooling airflow" in recall_res.results[0].text
    mock_client.recall.assert_called_once_with(
        bank_id="fixtrace-test-bank",
        query="CNC-MOTOR-104 high-load overheat",
        budget="high",
        tags=None,
        max_tokens=4096
    )

def test_memory_status_api_endpoint():
    """Verify /api/memory/status endpoint returns honest unconfigured state."""
    res = client.get("/api/memory/status")
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
    assert "api_url" in data
    assert "bank_id" in data
    assert "reachable" in data

def test_memory_test_connection_endpoint_fails_when_unconfigured():
    """Verify /api/memory/test-connection returns 503 when unconfigured rather than fabricating success."""
    with patch.object(hindsight_service, "is_configured", return_value=False):
        res = client.post("/api/memory/test-connection")
        # In unconfigured test environment, it must reject with 503
        assert res.status_code == 503
        assert "Hindsight API key not configured" in res.json()["detail"]
