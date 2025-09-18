from fastapi import APIRouter, Depends
from api.services import DashboardService, AuthService

router = APIRouter()

@router.get("/")
async def root(current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Return dashboard statistics for the frontend
    """

    service = DashboardService()
    result = await service.get_dashboard_stats()

    return result
