import time
import logging
from typing import List, Dict, Any, Optional
from hindsight_client import (
    Hindsight,
    RecallResponse,
    RecallResult,
    RetainResponse,
    ReflectResponse
)
from app.config import settings

logger = logging.getLogger(__name__)

class HindsightServiceError(Exception):
    """Exception raised when Hindsight operations fail or service is unconfigured."""
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code

class HindsightService:
    def __init__(self):
        self.base_url = settings.HINDSIGHT_API_URL.rstrip("/")
        self.api_key = settings.HINDSIGHT_API_KEY.strip()
        self.bank_id = settings.HINDSIGHT_BANK_ID.strip()
        
        self._client: Optional[Hindsight] = None
        if self.is_configured():
            self._client = Hindsight(
                base_url=self.base_url,
                api_key=self.api_key if self.api_key else None
            )

    def is_configured(self) -> bool:
        """Returns True if the required Hindsight configuration is present."""
        return bool(self.api_key) or ("localhost" in self.base_url or "127.0.0.1" in self.base_url)

    def get_status(self) -> Dict[str, Any]:
        """
        Returns the honest, un-fabricated status of the Hindsight memory layer.
        Does not fabricate connectivity or latency metrics.
        """
        configured = self.is_configured()
        status_info = {
            "configured": configured,
            "api_url": self.base_url,
            "bank_id": self.bank_id,
            "reachable": False,
            "latency_ms": None,
            "error": None
        }

        if not configured:
            status_info["error"] = "Hindsight API key not configured in .env."
            return status_info

        # Measure actual network latency to Hindsight endpoint
        try:
            start_time = time.perf_counter()
            # Attempt lightweight recall to check bank responsiveness
            client = self._get_client()
            client.recall(bank_id=self.bank_id, query="system_ping", budget="low")
            elapsed = (time.perf_counter() - start_time) * 1000
            status_info["reachable"] = True
            status_info["latency_ms"] = round(elapsed, 1)
        except Exception as e:
            status_info["reachable"] = False
            status_info["error"] = str(e)
            logger.warning(f"Hindsight connection test failed: {e}")

        return status_info

    def _get_client(self) -> Hindsight:
        """Internal helper to get or initialize client; raises error if unconfigured."""
        if not self.is_configured():
            raise HindsightServiceError(
                "Hindsight memory system is unconfigured. Set HINDSIGHT_API_KEY in .env.",
                status_code=503
            )
        if self._client is None:
            self._client = Hindsight(
                base_url=self.base_url,
                api_key=self.api_key if self.api_key else None
            )
        return self._client

    def retain(
        self,
        content: str,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, str]] = None,
        context: Optional[str] = None,
        retain_async: bool = False
    ) -> RetainResponse:
        """
        Retains an operational maintenance experience into Hindsight.
        Raises HindsightServiceError if unconfigured or unreachable.
        """
        client = self._get_client()
        try:
            response = client.retain(
                bank_id=self.bank_id,
                content=content,
                tags=tags,
                metadata=metadata,
                context=context,
                retain_async=retain_async
            )
            return response
        except Exception as e:
            logger.error(f"Hindsight retain operation failed: {e}")
            raise HindsightServiceError(f"Failed to retain experience in Hindsight: {str(e)}")

    def recall(
        self,
        query: str,
        budget: str = "mid",
        tags: Optional[List[str]] = None,
        max_tokens: int = 4096
    ) -> RecallResponse:
        """
        Recalls relevance-ranked memories from Hindsight.
        Raises HindsightServiceError if unconfigured or unreachable.
        """
        client = self._get_client()
        try:
            response = client.recall(
                bank_id=self.bank_id,
                query=query,
                budget=budget,
                tags=tags,
                max_tokens=max_tokens
            )
            return response
        except Exception as e:
            logger.error(f"Hindsight recall operation failed: {e}")
            raise HindsightServiceError(f"Failed to recall memories from Hindsight: {str(e)}")

    def reflect(
        self,
        query: str,
        budget: str = "low",
        tags: Optional[List[str]] = None
    ) -> ReflectResponse:
        """
        Synthesizes high-level observations and equipment mental models.
        Raises HindsightServiceError if unconfigured or unreachable.
        """
        client = self._get_client()
        try:
            response = client.reflect(
                bank_id=self.bank_id,
                query=query,
                budget=budget,
                tags=tags
            )
            return response
        except Exception as e:
            logger.error(f"Hindsight reflect operation failed: {e}")
            raise HindsightServiceError(f"Failed to reflect in Hindsight: {str(e)}")

# Global singleton service instance
hindsight_service = HindsightService()
