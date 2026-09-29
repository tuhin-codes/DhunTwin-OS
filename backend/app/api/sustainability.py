from fastapi import APIRouter

from app.carbon.sustainability_service import SustainabilityService

router = APIRouter(
    prefix="/sustainability",
    tags=["Sustainability"],
)


@router.get("/")
def sustainability():

    return SustainabilityService.plant_summary()
        