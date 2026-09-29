import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.config import settings
from app.database import get_db, engine, Base
import app.models # Ensure all models are registered on Base.metadata
from app.api.machines import router as machines_router
from app.api.incidents import router as incidents_router
from app.api.memory import router as memory_router

from app.models.machine import Machine
from app.database import SessionLocal

def seed_initial_machines_if_empty():
    with SessionLocal() as db:
        if db.query(Machine).count() == 0:
            demo_machines = [
                Machine(id="CNC-MOTOR-104", name="High-Speed Spindle Motor 104", machine_type="CNC Milling Spindle", location="Bay 4 - Precision Machining", status="OPERATIONAL", specifications={"voltage": "480V", "max_rpm": 12000}),
                Machine(id="HVAC-CHILLER-12", name="Industrial Coolant Chiller 12", machine_type="Process Chiller", location="Utility Mezzanine", status="OPERATIONAL", specifications={"cooling_capacity_tons": 50, "refrigerant": "R-134a"}),
                Machine(id="HYDRAULIC-PRESS-07", name="500-Ton Hydraulic Forming Press", machine_type="Hydraulic Press", location="Bay 1 Heavy Stamping", status="OPERATIONAL", specifications={"tonnage": 500, "max_psi": 3000}),
                Machine(id="EXTRUDER-LINE-02", name="Polymer Extrusion Barrel 02", machine_type="Extruder Drive", location="Plastics Line 2", status="OPERATIONAL", specifications={"barrel_zones": 4, "temp_max_c": 350}),
                Machine(id="COMPRESSOR-AIR-05", name="Rotary Screw Air Compressor 05", machine_type="Pneumatics", location="Central Plant", status="OPERATIONAL", specifications={"cfm": 250, "pressure_psi": 125})
            ]
            db.add_all(demo_machines)
            db.commit()

def migrate_db_columns():
    with engine.connect() as conn:
        try:
            cols = [row[1] for row in conn.execute(text("PRAGMA table_info(attempts)")).fetchall()]
            if cols and "telemetry_before" not in cols:
                conn.execute(text("ALTER TABLE attempts ADD COLUMN telemetry_before TEXT"))
            if cols and "telemetry_after" not in cols:
                conn.execute(text("ALTER TABLE attempts ADD COLUMN telemetry_after TEXT"))
            conn.commit()
        except Exception:
            pass

Base.metadata.create_all(bind=engine)
migrate_db_columns()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create DB tables if they don't exist yet
    Base.metadata.create_all(bind=engine)
    migrate_db_columns()
    seed_initial_machines_if_empty()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FixTrace - Industrial Maintenance Decision Memory Agent (Hindsight Vectorize)",
    lifespan=lifespan
)

# CORS Configuration for local Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(machines_router, prefix="/api")
app.include_router(incidents_router, prefix="/api")
app.include_router(memory_router, prefix="/api")

@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "tagline": "Remember the failure. Remember the fix.",
        "version": settings.APP_VERSION,
        "status": "OPERATIONAL"
    }

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """
    Health check inspecting:
    1. FastAPI backend runtime
    2. SQLite database connectivity
    3. Hindsight configuration state
    4. LLM provider configuration state
    """
    # 1. DB Check
    db_status = "error"
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    # 2. Hindsight Configuration Check
    hindsight_configured = bool(settings.HINDSIGHT_API_KEY.strip())
    hindsight_status = {
        "configured": hindsight_configured,
        "api_url": settings.HINDSIGHT_API_URL,
        "bank_id": settings.HINDSIGHT_BANK_ID,
        "mode": "cloud" if "vectorize.io" in settings.HINDSIGHT_API_URL else "local_or_custom"
    }

    # 3. LLM Configuration Check
    llm_configured = bool(settings.GROQ_API_KEY.strip())
    llm_status = {
        "configured": llm_configured,
        "provider": "Groq",
        "model": settings.GROQ_MODEL
    }

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "timestamp": time.time(),
        "database": db_status,
        "hindsight": hindsight_status,
        "llm": llm_status
    }
