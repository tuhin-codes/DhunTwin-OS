from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

class AttemptBase(BaseModel):
    action_taken: str = Field(..., description="Troubleshooting action executed")
    result: Literal["FAILED", "SUCCESSFUL"] = Field(..., description="Action outcome")
    observed_notes: str = Field(..., description="Technician observations and troubleshooting notes")
    performed_by: str = Field(..., description="Name of the technician executing the attempt")
    telemetry_before: Optional[str] = Field(None, description="Optional telemetry readings before attempt")
    telemetry_after: Optional[str] = Field(None, description="Optional telemetry readings after attempt")

class AttemptCreate(AttemptBase):
    pass

class AttemptResponse(AttemptBase):
    id: str
    incident_id: str
    attempt_number: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
