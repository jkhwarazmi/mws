from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
from api.services import WaitlistService, AuthService
from api.models import WaitlistFilterParams, Patient, GradeOverride
import json
import asyncio

router = APIRouter()

@router.get("/")
async def root(params: WaitlistFilterParams = Depends(), current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Return patients matching filter criteria
        
        :param str | None (optional) waitlist_id: The ID of the patient
        :param str | None (optional) medical_number: The medical number of the patient
        :param str | None (optional) referral_date: The referral date of the patient
        :param str | None (optional) grading_status: The grading status of the patient
        :param int | None (optional) page: The page number of the results
        :param str | None (optional) postcode: The postcode of the patient
        :param int | None (optional) min_clinical_urgency: Minimum clinical urgency of patients to return
        :param int | None (optional) max_clinical_urgency: Maximum clinical urgency of patients to return
        :param int | None (optional) min_condition_severity: Minimum severity score of patients to return
        :param int | None (optional) max_condition_severity: Maximum severity of patients to return
        :param int | None (optional) min_comorbidities: Minimum comorbidities value of patients to return
        :param int | None (optional) max_comorbidities: Maximum comorbidities value of patients to return
        :param str | None (optional) department: Department of slot the patient is waiting for
        :param int | None (optional) limit: Limit responses to top n results
        :param int | None (optional) offset: Offset responses by n from the top
    """

    service = WaitlistService()
    result = await service.get_patients(params)

    return result


@router.get("/grade/{waitlist_id}")
async def get_patient(waitlist_id: str, current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Pass patient to clinical grading agent and return their new data
        
        :param str waitlist_id: The ID of the patient to grade
    """
    
    service = WaitlistService()
    result = await service.grade_patient(waitlist_id)
    
    if result is None:
        return JSONResponse(status_code=404, content={"message": "Patient not found"}) #FIXME inconsistent error type compared to other HTTP errors
    
    return result


@router.get("/grade-all")
async def grade_all_patients(current_user: dict = Depends(AuthService.get_programmatic_access)):
    """
        Grade all patients where grading_status is not complete or grading has been stuck for over 1 hour
    """
    
    service = WaitlistService()
    result = await service.grade_all_patients()
    
    return result

@router.post("/add")
async def add_patient(patient: Patient, current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Add a patient to the waitlist. If auto_grade is true, streams responses from the grading agent.
    """
    
    service = WaitlistService()
    result = await service.add_patient(patient)
    
    #REFACTOR into the service, don't check this at API level
    if patient.auto_grade:
        async def generate():
            # Add patient response
            serializable_result = jsonable_encoder(result)
            yield f"data: {json.dumps({'status': 'added', 'patient': serializable_result})}\n\n"
            
            # Small delay to ensure first chunk is sent
            await asyncio.sleep(0.1)
            
            # Get waitlist_id from result
            waitlist_id = result.get('waitlist_id')
            if waitlist_id:
                # Grade patient response
                grade_result = await service.grade_patient(waitlist_id)
                if grade_result:
                    serializable_grade_result = jsonable_encoder(grade_result)
                    yield f"data: {json.dumps({'status': 'graded', 'patient': serializable_grade_result})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'grading_failed', 'message': 'Patient not found for grading'})}\n\n"
            else:
                yield f"data: {json.dumps({'status': 'grading_failed', 'message': 'No waitlist_id returned'})}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream", headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        })

    return result


@router.post("/override-grade/{waitlist_id}")
async def override_grade(waitlist_id: str, grade_override: GradeOverride, current_user: dict = Depends(AuthService.get_current_user_or_service)):
    """
        Override the grading values for a patient and set edited_at to current time.
        
        :param str waitlist_id: The ID of the patient to override grades for
        :param GradeOverride grade_override: The new grading values (clinical_urgency, condition_severity, comorbidities)
    """
    
    service = WaitlistService()
    result = await service.override_grade(waitlist_id, grade_override)
    
    if result is None:
        return JSONResponse(status_code=404, content={"message": "Patient not found"}) #FIXME inconsistent error type compared to other HTTP errors
    
    return result


@router.get("/mark-seen")
async def mark_seen(current_user: dict = Depends(AuthService.get_programmatic_access)):
    """
        Mark all patients seen if their appointment time has passed
    """
    
    service = WaitlistService()
    result = await service.mark_seen()
    
    return result