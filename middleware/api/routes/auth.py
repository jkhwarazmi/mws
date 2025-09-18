from fastapi import APIRouter, Depends
from api.services import AuthService

router = APIRouter()

@router.post("/")
async def verify_user_login(current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
    This endpoint is called immediately after a user signs in on the frontend.
    It implicitly verifies their token and email approval via the get_current_user_or_service dependency.
    """
    # If the code reaches here, the user is valid.
    # The dependency already handled all checks and exceptions.
    return {"status": "success"}