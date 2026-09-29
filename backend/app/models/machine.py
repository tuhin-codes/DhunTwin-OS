from pydantic import BaseModel


class Machine(BaseModel):
    # --------------------------------------------------
    # Machine Identity
    # --------------------------------------------------

    id: str
    name: str
    type: str

    department: str
    location: str

    # --------------------------------------------------
    # Digital Twin Telemetry
    # --------------------------------------------------

    temperature: float
    pressure: float
    vibration: float

    rpm: int
    torque: float

    power: float
    energy: float
    carbon: float
    water: float

    # --------------------------------------------------
    # Operating State
    # --------------------------------------------------
    #
    # These fields allow CarbonTwin to distinguish between:
    #
    # RUNNING
    # LOW_LOAD
    # IDLE
    # STANDBY
    #
    # This is important for carbon optimization because an
    # idle machine may still consume energy and generate
    # carbon.
    # --------------------------------------------------

    utilization: float = 100.0
    operating_state: str = "RUNNING"
    production_critical: bool = False

    # --------------------------------------------------
    # Digital Twin State
    # --------------------------------------------------

    efficiency: float
    health_score: float

    # --------------------------------------------------
    # AI Outputs
    # --------------------------------------------------

    failure_probability: float = 0.0
    remaining_useful_life: int = 0

    maintenance_status: str = "Unknown"

    current_technician: str | None = None
    current_ticket: str | None = None