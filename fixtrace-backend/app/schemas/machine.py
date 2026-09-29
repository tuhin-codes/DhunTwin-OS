from datetime import datetime
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict

class MachineBase(BaseModel):
    name: str = Field(..., description="Equipment name")
    machine_type: str = Field(..., description="Industrial equipment classification")
    location: str = Field(..., description="Physical bay or facility location")
    status: Literal["OPERATIONAL", "WARNING", "MAINTENANCE"] = "OPERATIONAL"
    specifications: Optional[Dict[str, Any]] = None

class MachineCreate(MachineBase):
    id: str = Field(..., description="Unique Asset ID e.g. CNC-MOTOR-104")

class MachineUpdate(BaseModel):
    name: Optional[str] = None
    machine_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[Literal["OPERATIONAL", "WARNING", "MAINTENANCE"]] = None
    specifications: Optional[Dict[str, Any]] = None

class MachineResponse(MachineBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
