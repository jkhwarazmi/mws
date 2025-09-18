from api.utils import BigQueryClient
from fastapi import HTTPException
from api.models import Assignment
import os
import api.config.project
from datetime import datetime
from zoneinfo import ZoneInfo
from api.utils.time_utils import LOCAL_TIMEZONE

class MatchRepository:
    def __init__(self):
        self.bq_client = BigQueryClient()

    async def can_manually_assign_appointment(self, appointment_id: str):
        """Check if appointment can be manually assigned (assign_at >= CURRENT_DATETIME)"""

        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)
        
        query = f"""
            SELECT appointment_id 
            FROM {api.config.project.APPOINTMENTS_FQTN}
            WHERE appointment_id = @appointment_id 
            AND (assign_at IS NULL OR assign_at >= @current_time)
        """ #FIXME Sign is wrong way round???
        params = {"appointment_id": ("STRING", appointment_id), "current_time": ("DATETIME", current_datetime)}
        
        try:
            result = await self.bq_client.run_query(query=query, named_params=params)
            return len(list(result)) > 0
        except Exception:
            return False #HACK returns false but since this function is bool check we might want to throw an error

    #REFACTOR This should be handled by the service layer making calls to database layer, not here
    #REFACTOR this whole function to separate logic and database calls
    async def assign_patient( 
            self,
            assignment: Assignment
    ):
        # Check for existing assignment
        check_existing_query = f"""
            SELECT waitlist_id 
            FROM {api.config.project.APPOINTMENTS_FQTN}
            WHERE appointment_id = @appointment_id AND waitlist_id IS NOT NULL
        """
        check_params = {"appointment_id": ("STRING", assignment.appointment_id)}
        
        try:
            existing_result = await self.bq_client.run_query(query=check_existing_query, named_params=check_params)
            existing_assignments = list(existing_result)
            
            # If there's an existing assignment, unassign the previous patient
            if existing_assignments:
                previous_waitlist_id = existing_assignments[0]["waitlist_id"]
                unassign_previous_query = f"""
                    UPDATE {api.config.project.WAITLIST_FQTN} 
                    SET is_assigned = FALSE 
                    WHERE waitlist_id = @previous_waitlist_id
                """
                unassign_params = {"previous_waitlist_id": ("STRING", previous_waitlist_id)}
                await self.bq_client.run_query(query=unassign_previous_query, named_params=unassign_params)
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to check existing assignment: {str(e)}")

        # Update the new patient as assigned
        patient_parameter = {"waitlist_id": ("STRING", assignment.waitlist_id)}
        update_patient_query = f"UPDATE {api.config.project.WAITLIST_FQTN} SET is_assigned = TRUE WHERE waitlist_id = @waitlist_id"

        # Update the appointment with new waitlist_id
        appointment_parameters = {"waitlist_id": ("STRING", assignment.waitlist_id),
                                  "appointment_id": ("STRING", assignment.appointment_id)}
        update_appointment_query = f"""
            UPDATE {api.config.project.APPOINTMENTS_FQTN}
            SET waitlist_id = @waitlist_id, assign_at = NULL
        """

        if assignment.email is not None:
            appointment_parameters["email"] = ("STRING", assignment.email)
            update_appointment_query += ", assigner_email = @email"
        else:
            update_appointment_query += ", assigner_email = 'admin@medical.uk'"

        update_appointment_query += " WHERE appointment_id = @appointment_id"

        try:
            await self.bq_client.run_query(query=update_appointment_query, named_params=appointment_parameters)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update appointment: {str(e)}")
        
        try:
            await self.bq_client.run_query(query=update_patient_query, named_params=patient_parameter)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update waitlist entry: {str(e)}")

        return {"success": True, "waitlist_id": assignment.waitlist_id}

    async def clear_appointment_assignment(self, appointment_id: str):
        """Clear assign_at when no patient can be found for assignment"""
        query = f"""
            UPDATE {api.config.project.APPOINTMENTS_FQTN}
            SET assign_at = NULL
            WHERE appointment_id = @appointment_id
        """
        params = {"appointment_id": ("STRING", appointment_id)}
        
        try:
            await self.bq_client.run_query(query=query, named_params=params)
            return {"success": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to clear appointment assignment: {str(e)}")
