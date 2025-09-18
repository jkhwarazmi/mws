from api.repositories import MatchRepository
from api.models import Assignment, AppointmentsFilterParams
from api.services.appointments_service import AppointmentsService
from api.services.waitlist_service import WaitlistService
from api.utils.time_utils import is_evening_hours
from datetime import datetime


class MatchService:
    def __init__(self):
        self.match_repo = MatchRepository()
        self.appointment_service = AppointmentsService()
        self.waitlist_service = WaitlistService()

    async def automatic_assignment(self):
        try:
            params = AppointmentsFilterParams(
                start_time=datetime.now(),
                status=1,  # waitlist_id is NULL
                auto_assignable=True
            )
            appointments = await self.appointment_service.get_appointments(params) #? await used on non async function (might be okay but check)
            return await self._assign_appointments(appointments)

        except Exception as e:
            return {
                "successful": 0,
                "failed": 0,
                "message": f"Critical error: {str(e)}"
            }

    async def assign_selected_appointments(self, appointment_ids: list[str]):
        try:
            appointments = []
            failed = 0
            
            for appointment_id in appointment_ids:
                # Check if appointment can be assigned before proceeding
                if not await self._is_appointment_assignable(appointment_id):
                    failed += 1
                    continue
                    
                params = AppointmentsFilterParams(appointment_id=appointment_id, status=1)
                appointment_list = await self.appointment_service.get_appointments(params)
                if appointment_list:
                    appointments.extend(appointment_list) #? Why would more than 1 element be added
                else:
                    failed += 1
            
            result = await self._assign_appointments(appointments)
            result["failed"] += failed
            
            return result

        except Exception as e:
            return {
                "successful": 0,
                "failed": len(appointment_ids),
                "message": f"Critical error: {str(e)}"
            }

    async def _assign_appointments(self, appointments):
        successful = 0
        failed = 0

        last_error = None #? Why only the last error is logged
        info = ""

        for appointment in appointments:
            try:
                # Assign evening patients preferentially if between 8 PM and 6 AM
                is_evening = is_evening_hours()
                waitlist_id = await self.waitlist_service.find_best_patient(appointment, prefers_evening=is_evening)

                if waitlist_id is None:
                    # No patient found, clear the assign_at to prevent future attempts
                    await self.match_repo.clear_appointment_assignment(appointment['appointment_id'])
                    failed += 1
                    info = " No patient found for one or more appointments."
                else:
                    assignment = Assignment(
                        appointment_id=appointment['appointment_id'],
                        waitlist_id=waitlist_id
                    )
                    await self.match_repo.assign_patient(assignment)
                    successful += 1
            except Exception as e:
                failed += 1
                last_error = str(e)
                continue

        return {
            "successful": successful,
            "failed": failed,
            "message": last_error if last_error else f"Assignment completed successfully.{info}"
        }

    async def assign_patient(
        self,
        assignment: Assignment
    ):
        return await self.match_repo.assign_patient(assignment)

    async def _is_appointment_assignable(self, appointment_id: str) -> bool:
        """
        Check if appointment can be assigned via UI, i.e. assign_at is in the future
        """
        return await self.match_repo.can_manually_assign_appointment(appointment_id)

    async def manual_assign_patient(
        self,
        assignment: Assignment
    ):
        # Check if appointment can be assigned
        if not await self._is_appointment_assignable(assignment.appointment_id):
            return None
        
        return await self.match_repo.assign_patient(assignment)
