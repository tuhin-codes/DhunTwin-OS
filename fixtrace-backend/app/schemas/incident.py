from datetime import datetime
from typing import Optional, List, Literal, Any, Union, Dict
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.attempt import AttemptResponse

class IncidentBase(BaseModel):
    machine_id: str = Field(..., description="Target Machine ID e.g. CNC-MOTOR-104")
    symptoms: str = Field(..., description="Observed machine symptoms")
    operating_conditions: str = Field(..., description="Load, speed, ambient temperature, runtime")
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    technician_name: str = Field(..., description="Reporting technician name")

class IncidentCreate(IncidentBase):
    id: Optional[str] = Field(None, description="Optional custom Incident ID (e.g. INC-2026-101)")

class IncidentResolve(BaseModel):
    root_cause: str = Field(..., description="Confirmed mechanical/electrical root cause")
    resolution_summary: str = Field(..., description="Steps taken that permanently cleared the symptom")
    lesson_learned: str = Field(..., description="Operational rule/heuristic to avoid repeat mistakes")

class IncidentResponse(IncidentBase):
    id: str
    status: Literal["OPEN", "IN_PROGRESS", "RESOLVED"]
    root_cause: Optional[str] = None
    resolution_summary: Optional[str] = None
    lesson_learned: Optional[str] = None
    hindsight_retained_id: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    attempts: List[AttemptResponse] = []

    model_config = ConfigDict(from_attributes=True)


class CarbonTwinIngestRequest(BaseModel):
    # Supports both CarbonTwin raw machine object or explicit payload
    id: Optional[str] = Field(None, description="CarbonTwin machine ID (e.g. MTR-001)")
    machine_id: Optional[str] = Field(None, description="Explicit target machine ID")
    name: Optional[str] = Field(None, description="CarbonTwin machine name (e.g. Production Motor 1)")
    machine_name: Optional[str] = Field(None, description="Explicit machine name")
    type: Optional[str] = Field(None, description="CarbonTwin machine type (e.g. Motor)")
    machine_type: Optional[str] = Field(None, description="Explicit machine type")
    location: Optional[str] = Field(None, description="Location in plant")
    department: Optional[str] = Field(None, description="Department name")

    # Live telemetry fields
    temperature: Optional[float] = None
    pressure: Optional[float] = None
    vibration: Optional[float] = None
    rpm: Optional[int] = None
    power: Optional[float] = None
    torque: Optional[float] = None
    operating_state: Optional[str] = None
    maintenance_status: Optional[str] = None

    # Incident descriptions
    symptoms: Optional[str] = Field(None, description="Observed machine symptoms")
    operating_conditions: Optional[Union[str, Dict[str, Any]]] = Field(None, description="Operating conditions snapshot")
    severity: Optional[Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]] = None
    technician_name: Optional[str] = None
    current_technician: Optional[str] = None

    # AI prognostics
    ai_prediction: Optional[dict] = None

    model_config = ConfigDict(extra="allow")

    def get_resolved_machine_id(self) -> str:
        val = self.machine_id or self.id
        if not val:
            raise ValueError("Machine ID must be provided (either machine_id or id).")
        return str(val).strip()

    def get_resolved_machine_name(self) -> str:
        return str(self.machine_name or self.name or self.get_resolved_machine_id()).strip()

    def get_resolved_machine_type(self) -> str:
        return str(self.machine_type or self.type or "Industrial Asset").strip()

    def get_resolved_location(self) -> str:
        loc = self.location or self.department or "Production Bay"
        return str(loc).strip()

    def get_resolved_severity(self) -> str:
        if self.severity:
            return self.severity
        if self.ai_prediction and isinstance(self.ai_prediction, dict):
            risk_level = str(self.ai_prediction.get("risk_level", "")).upper()
            if risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
                return risk_level
        if self.vibration and self.vibration >= 1.5:
            return "HIGH"
        return "MEDIUM"

    def get_resolved_technician(self) -> str:
        tech = self.technician_name or self.current_technician or "Field Technician"
        return str(tech).strip()

    def get_resolved_symptoms(self) -> str:
        if self.symptoms and self.symptoms.strip():
            return self.symptoms.strip()
        parts = []
        if self.vibration is not None:
            parts.append(f"Vibration {self.vibration:.2f} mm/s")
        if self.temperature is not None:
            parts.append(f"Temperature {self.temperature:.1f}°C")
        if self.pressure is not None:
            parts.append(f"Pressure {self.pressure:.1f} bar")
        if self.ai_prediction and isinstance(self.ai_prediction, dict):
            reason = self.ai_prediction.get("reason")
            if reason:
                parts.append(str(reason))
        if not parts:
            parts.append("Elevated sensor deviation flagged by digital twin")
        return "; ".join(parts)

    def get_resolved_operating_conditions(self) -> str:
        if self.operating_conditions:
            if isinstance(self.operating_conditions, str) and self.operating_conditions.strip():
                return self.operating_conditions.strip()
            elif isinstance(self.operating_conditions, dict):
                return ", ".join(f"{k}: {v}" for k, v in self.operating_conditions.items())
        parts = []
        if self.rpm is not None:
            parts.append(f"{self.rpm} RPM")
        if self.power is not None:
            parts.append(f"{self.power:.1f} kW load")
        if self.operating_state:
            parts.append(f"State: {self.operating_state}")
        if not parts:
            parts.append("Standard operating load")
        return ", ".join(parts)


class HindsightMemoryItem(BaseModel):
    id: Optional[str] = None
    text: str
    type: Optional[str] = None
    tags: Optional[List[str]] = None
    context: Optional[str] = None
    scores: Optional[Any] = None


class StructuredGuidance(BaseModel):
    prior_experience_found: bool
    summary: Optional[str] = None
    failed_actions: List[str] = []
    successful_action: Optional[str] = None
    root_cause: Optional[str] = None
    lesson_learned: Optional[str] = None
    best_match_score: Optional[float] = None


class HindsightRecallSummary(BaseModel):
    status: Literal["connected", "unconfigured", "error"]
    configured: bool
    message: Optional[str] = None
    query: str
    prior_experience_found: bool
    count: int = 0
    guidance: Optional[StructuredGuidance] = None
    memories: List[HindsightMemoryItem] = []


class CarbonTwinIngestResponse(BaseModel):
    incident: IncidentResponse
    hindsight_recall: HindsightRecallSummary
    machine_registered: bool

