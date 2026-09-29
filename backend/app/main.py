from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from app.api.health import router as health_router
from app.api.machines import router as machine_router
from app.api.factory import router as factory_router
from app.api.sustainability import router as sustainability_router
from app.api.ai import router as ai_router
from app.api.ai_condition import router as ai_condition_router
from app.api.optimization import router as optimization_router
from app.api.reports import router as reports_router
from app.api.maintenance_work_orders import (
    router as maintenance_work_orders_router,
)

from app.simulation.background import BackgroundSimulation
from app.websocket.socket_manager import sio
from app.digital_twin.runtime import DigitalTwinRuntime


# ============================================================
# CARBONTWIN OS APPLICATION
# ============================================================

app = FastAPI(
    title="CarbonTwin OS API",
    description="Enterprise Digital Twin Platform",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# API ROUTERS
# ============================================================

app.include_router(
    health_router
)

app.include_router(
    machine_router
)

app.include_router(
    factory_router
)

app.include_router(
    sustainability_router
)

app.include_router(
    ai_router
)

app.include_router(
    ai_condition_router
)

app.include_router(
    optimization_router
)

app.include_router(
    reports_router
)

# ------------------------------------------------------------
# Maintenance Work Orders
# ------------------------------------------------------------

app.include_router(
    maintenance_work_orders_router
)


# ============================================================
# APPLICATION STARTUP
# ============================================================

@app.on_event("startup")
async def startup():
    """
    Initialize the Digital Twin and start the
    background factory simulation.
    """

    DigitalTwinRuntime.initialize()

    BackgroundSimulation.start()


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
def root():

    return {
        "message":
            "CarbonTwin OS Backend Running",

        "status":
            "online",

        "version":
            "1.0.0",
    }


# ============================================================
# SOCKET.IO
# ============================================================

app = socketio.ASGIApp(
    sio,
    other_asgi_app=app,
)