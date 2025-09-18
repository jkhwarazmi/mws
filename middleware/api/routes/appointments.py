from fastapi import APIRouter, Depends
from api.services import AppointmentsService, AuthService, MatchService
from api.models import AppointmentsFilterParams, AppointmentCreate

router = APIRouter()

@router.get("/")
async def root(params: AppointmentsFilterParams = Depends(), current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Return slots matching filter criteria
            
        :param str | None (optional) appointment_id: 
        :param datetime | None (optional) start_time: Filter by dates after this datetime (ISO 8601)
        :param datetime | None (optional) end_time: Filter by dates before this datetime (ISO 8601)
        :param str | None (optional) hospital_id: Hospital ID of the slot
        :param str | None (optional) department_id: Department ID of the slot
    """
        
    service = AppointmentsService()
    result = await service.get_paginated_appointments(params)

    return result


@router.post("/add")
async def add_appointment(appointment: AppointmentCreate, current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Add an appointment to the system. If auto_assign is true, automatically assigns it to the best patient.
        
        :param AppointmentCreate appointment: The appointment data including time, department, hospital, and auto_assign flag
    """
    
    appointments_service = AppointmentsService()
    result = await appointments_service.add_appointment(appointment)
    
    #REFACTOR into the service, don't check this at API level
    if appointment.auto_assign:
        match_service = MatchService()
        assignment_result = await match_service.assign_selected_appointments([result['appointment_id']])
        
        if assignment_result.get('successful', False):
            params = AppointmentsFilterParams(appointment_id=result['appointment_id'])
            updated_appointments = await appointments_service.get_paginated_appointments(params)
            if updated_appointments:
                result = updated_appointments["results"][0]
    
    return result if result else None