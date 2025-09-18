from api.utils import BigQueryClient
from fastapi import HTTPException
from api.models import Assignment
import os
import api.config.project


class RejectedAppointmentsRepository:
    def __init__(self):
        self.bq_client = BigQueryClient()

    async def update_waitlist(
            self,
            assignment: Assignment
    ):
        # updating the waitlist (patient) table
        params = {"waitlist_id": ("STRING", assignment.waitlist_id)}
        
        query = f"UPDATE {api.config.project.WAITLIST_FQTN} SET is_assigned = FALSE WHERE waitlist_id = @waitlist_id"

        try:
            await self.bq_client.run_query(query=query, named_params=params)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update waitlist entry: {str(e)}") #FIXME The repo should raise ageneral exception not http error

    async def update_appointments( #REFACTOR rename this function for clarity, it updates to rejected
            self,
            assignment: Assignment
    ):

        # updating the appointment table
        params = {"appointment_id": ("STRING", assignment.appointment_id)}
        query = f"""
            UPDATE {api.config.project.APPOINTMENTS_FQTN}
            SET waitlist_id = NULL, assigner_email = NULL
            WHERE appointment_id = @appointment_id
        """

        try:
            await self.bq_client.run_query(query=query, named_params=params)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update appointment: {str(e)}") #FIXME The repo should raise a general exception not http error

    async def update_rejected_appointments(
            self,
            assignment: Assignment
    ):
        # updating the rejected appointments table
        params = {"appointment_id": ("STRING", assignment.appointment_id),
                  "waitlist_id": ("STRING", assignment.waitlist_id)}
        query = f"""
            INSERT INTO {api.config.project.REJECTED_APPOINTMENTS_FQTN}
            VALUES (@appointment_id, @waitlist_id)
        """

        try:
            await self.bq_client.run_query(query=query, named_params=params)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to add row to rejected_appointments table: {str(e)}") #FIXME The repo should raise a general exception not http error
