from fastapi import APIRouter, Depends
from api.models import Assignment
from api.services import RejectedAppointmentsService, AuthService

router = APIRouter()


@router.post("/reject")
async def root(assignment: Assignment, current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Log a patient as having rejected a certain appointment slot.

        :param Assignment assignment: The assignment of a patient to an appointment.
    """

    service = RejectedAppointmentsService()
    result = await service.reject_appointment(assignment)

    return result


