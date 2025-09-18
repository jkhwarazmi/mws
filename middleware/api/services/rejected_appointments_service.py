from api.repositories import RejectedAppointmentsRepository
from api.models import Assignment


class RejectedAppointmentsService:
    def __init__(self):
        self.repo = RejectedAppointmentsRepository()

    async def reject_appointment(
        self,
        assignment: Assignment
    ):
        try:
            # Update each table through the repository functions
            await self.repo.update_waitlist(assignment)
            await self.repo.update_appointments(assignment)
            await self.repo.update_rejected_appointments(assignment)

            return {"success": True, "message": "Tables updated successfully."}

        except Exception as e: #FIXME raise the exception upwards
            return {"success": False, "message": f"Failed to update tables: {str(e)}"}

