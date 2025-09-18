from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from api.models import Assignment
from api.services import MatchService, AuthService, WaitlistService
from typing import List

router = APIRouter()


@router.get("/automatic-assignment")
async def root(current_user: dict = Depends(AuthService.get_programmatic_access)):
    """
        Called by a scheduled job and assigns each available appointment
        to the highest priority patient.
    """

    service = MatchService()
    result = await service.automatic_assignment()

    return result


@router.get("/get-candidates")
async def root(appointment_id: str, limit: int = 5, current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Returns top 5 best fit patients for a given slot
            
        :param str appointment_id: The ID of the appointment to match patients to
        :param int limit: number of patients to return
    """

    service = WaitlistService()
    result = await service.get_candidates(appointment_id, limit)

    return result


@router.post("/assign-selected")
async def assign_selected(appointment_ids: List[str], current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Assigns specific appointment slots to the highest priority patients.
        
        :param List[str] appointment_ids: List of appointment IDs to assign
    """

    service = MatchService()
    result = await service.assign_selected_appointments(appointment_ids)

    return result


@router.post("/manual-assign")
async def root(assignment: Assignment, current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Manually assign a patient to an appointment slot

        :param Assignment assignment: The assignment of a patient to an appointment.
    """

    service = MatchService()
    result = await service.manual_assign_patient(assignment)

    if result is None:
        return JSONResponse(status_code=400, content={"message": "Unable to assign appointment"}) #FIXME inconsistent error type compared to other HTTP errors

    return result
