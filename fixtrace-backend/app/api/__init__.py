from app.api.machines import router as machines_router
from app.api.incidents import router as incidents_router
from app.api.memory import router as memory_router

__all__ = ["machines_router", "incidents_router", "memory_router"]
