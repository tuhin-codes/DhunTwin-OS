from fastapi import APIRouter

from app.models import Factory
from app.services.factory_service import FactoryService

router = APIRouter(
    prefix="/factory",
    tags=["Factory"],
)


@router.get("/", response_model=Factory)
def get_factory():
    return FactoryService.get_factory()