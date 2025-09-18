from fastapi import APIRouter, Depends
from api.services import DepartmentsService, AuthService

router = APIRouter()

@router.get("/")
async def root(current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Return all departments
    """

    service = DepartmentsService()
    result = await service.get_departments()

    return result
