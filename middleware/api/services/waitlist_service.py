from api.repositories import WaitlistRepository, MatchRepository
from api.models import WaitlistFilterParams, Patient, GradeOverride, AppointmentsFilterParams
from api.services.hospitals_service import HospitalsService
from api.services.appointments_service import AppointmentsService
from api.services.secrets import Secrets
from api.utils.time_utils import is_evening_hours
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import googlemaps
import asyncio
import os


class WaitlistService:
    def __init__(self):
        self.waitlist_repo = WaitlistRepository()
        self.match_repo = MatchRepository()
        self.hospitals_service = HospitalsService()
        self.appointments_service = AppointmentsService()
        self.secrets = Secrets()

    async def get_patients(self, params: WaitlistFilterParams):
        return await self.waitlist_repo.query_patients(params)

    async def mark_seen(self):
        return await self.waitlist_repo.mark_seen()

    async def grade_patient(self, waitlist_id: str):
        await self.waitlist_repo.grade_patient(waitlist_id)

        updated_result = await self.waitlist_repo.query_patients(WaitlistFilterParams(waitlist_id=waitlist_id))
        return updated_result['results'][0] if updated_result['results'] else None

    async def grade_all_patients(self, max_concurrent: int = 5):
        waitlist_ids = await self.waitlist_repo.get_ungraded_waitlist_ids()

        results = {
            "total_processed": len(waitlist_ids),
            "successful": 0,
            "failed": 0,
            "errors": []
        }

        semaphore = asyncio.Semaphore(max_concurrent)

        async def grade_single_patient(waitlist_id: str):
            async with semaphore:
                try:
                    await self.waitlist_repo.grade_patient(waitlist_id)
                    results["successful"] += 1
                except Exception as e:
                    results["failed"] += 1
                    error_msg = f"Failed to grade patient {waitlist_id}: {str(e)}"
                    results["errors"].append(error_msg)

        await asyncio.gather(*[grade_single_patient(wid) for wid in waitlist_ids], return_exceptions=True)

        return results

    async def add_patient(self, patient: Patient):
        return await self.waitlist_repo.add_patient(patient)

    def _is_within_24_hours(self, appointment_time: datetime):
        """Check if appointment is within 24 hours from now"""
        time_difference = appointment_time - datetime.now()
        return timedelta(0) <= time_difference <= timedelta(hours=24)

    async def _get_candidates_with_tiered_filtering(self, appointment_id, department_id, limit, prefers_evening=False):
        """Get candidates using 3-tier filtering: 10 weeks, then 4 weeks, then no date filter"""
        current_time = datetime.now(tz=ZoneInfo("Etc/Greenwich")).replace(tzinfo=None)
        
        # Try 10 weeks back first
        # There are more efficient ways to do this in query, but this logic is easier to understand/modify/remove
        ten_weeks_ago = current_time - timedelta(weeks=10)
        candidates = await self.waitlist_repo.query_candidates(appointment_id, department_id, limit, prefers_evening, ten_weeks_ago)
        
        if candidates and len(candidates) > 0:
            return candidates
        
        # Try 4 weeks back if no candidates found
        four_weeks_ago = current_time - timedelta(weeks=4)
        candidates = await self.waitlist_repo.query_candidates(appointment_id, department_id, limit, prefers_evening, four_weeks_ago)
        
        if candidates and len(candidates) > 0:
            return candidates
        
        # Fall back to no date filter
        return await self.waitlist_repo.query_candidates(appointment_id, department_id, limit, prefers_evening)

    async def _get_candidates_with_proximity(self, appointment, limit=5, prefers_evening=False):
        """Get candidates with proximity information for appointments within 24 hours"""
        hospital_postcode = await self.hospitals_service.get_hospital_postcode(appointment['hospital_id'])
        candidates = await self._get_candidates_with_tiered_filtering(appointment['appointment_id'],
                                                               appointment['department_id'], limit, prefers_evening)

        # Add proximity information to each candidate
        for candidate in candidates:
            try:
                distance = await self.calculate_proximity(hospital_postcode[0]['postcode'],
                                                          candidate['postcode'],
                                                          appointment['appointment_time'])
                candidate['proximity'] = distance
            except Exception as e:
                print(f"Error calculating proximity for candidate {candidate.get('waitlist_id', 'unknown')}: {str(e)}")
                candidate['proximity'] = float('inf') #HACK might want a more reliable way of handling this

        # Sort by proximity distance
        candidates.sort(key=lambda x: x.get('proximity', float('inf')))
        return candidates

    async def find_best_patient(self, appointment: AppointmentsFilterParams, prefers_evening: bool = False):
        if self._is_within_24_hours(appointment['appointment_time']):
            candidates = await self._get_candidates_with_proximity(appointment, 5, prefers_evening)
            
            if not candidates:
                return None
            elif len(candidates) == 1:
                return candidates[0]['waitlist_id']
            
            candidates_by_preference = await self.waitlist_repo.analyse_preferences(appointment['appointment_id'],
                                                                                    appointment['appointment_time'],
                                                                                    appointment['properties'],
                                                                                    candidates)
            if candidates_by_preference:
                return candidates_by_preference[0]['waitlist_id']
        else:
            candidates = await self._get_candidates_with_tiered_filtering(appointment['appointment_id'],
                                                                    appointment['department_id'], 5, prefers_evening)
            
            if not candidates:
                return None
            elif len(candidates) == 1:
                return candidates[0]['waitlist_id']

            candidates_by_preference = await self.waitlist_repo.analyse_preferences(appointment['appointment_id'],
                                                                                    appointment['appointment_time'],
                                                                                    appointment['properties'],
                                                                                    candidates)
            if candidates_by_preference:
                return candidates_by_preference[0]['waitlist_id']

    async def get_candidates(self, appointment_id: str, limit=5):
        # Check if appointment can be assigned before getting candidates
        if not await self.match_repo.can_manually_assign_appointment(appointment_id):
            return []

        appointment = await self.appointments_service.get_appointments(
            AppointmentsFilterParams(appointment_id=appointment_id))

        if not appointment:
            return []

        appointment_data = appointment[0]
        department_id = appointment_data.get("department_id")
        if not department_id:
            return []

        # Assign evening patients preferentially if between 8 PM and 6 AM
        is_evening = is_evening_hours()

        # If within 24 hours, return candidates with proximity information, sorted by distance
        if self._is_within_24_hours(appointment_data['appointment_time']):
            candidates = await self._get_candidates_with_proximity(appointment_data, limit, prefers_evening=is_evening)
            
            if not candidates:
                return None
            elif len(candidates) == 1:
                return candidates

            candidates_by_preference = await self.waitlist_repo.analyse_preferences(appointment_data['appointment_id'],
                                                                                    appointment_data['appointment_time'],
                                                                                    appointment_data['properties'],
                                                                                    candidates)

            return candidates_by_preference
        else:
            candidates = await self._get_candidates_with_tiered_filtering(appointment_id, department_id, limit, prefers_evening=is_evening)
            
            if not candidates:
                return None
            elif len(candidates) == 1:
                return candidates

            candidates_by_preference = await self.waitlist_repo.analyse_preferences(appointment_data['appointment_id'],
                                                                                    appointment_data[
                                                                                        'appointment_time'],
                                                                                    appointment_data['properties'],
                                                                                    candidates)
            return candidates_by_preference

    async def calculate_proximity(self, hospital_postcode: str, patient_postcode: str, appointment_time: datetime):
        api_key = self.secrets.get_secret('ROUTES_API')
        gmaps = googlemaps.Client(key=api_key)

        def _execute_distance_matrix():
            return gmaps.distance_matrix(patient_postcode,
                                       hospital_postcode,
                                       mode="driving",
                                       arrival_time=appointment_time,
                                       region="gb")

        try:
            loop = asyncio.get_running_loop()
            directions_result = await loop.run_in_executor(None, _execute_distance_matrix)

            if directions_result['status'] == 'OK' and directions_result['rows'][0]['elements'][0]['status'] == 'OK':
                output = directions_result['rows'][0]['elements'][0]
                distance = output['distance']['value']
                return distance
            else:
                error_status = directions_result['rows'][0]['elements'][0].get('status', 'UNKNOWN_ERROR')
                print(f"Could not find a route. Status: {error_status}")
                print(f"API Response Status: {directions_result['status']}")
                return float('inf') #HACK might want a more reliable way of handling this
        except googlemaps.exceptions.ApiError as e:
            print(f"An API error occurred: {e}") #FIXME want to raise errors not silence them

    async def override_grade(self, waitlist_id: str, grade_override: GradeOverride):
        # First get the current patient to check if they exist and values are different
        result = self.waitlist_repo.query_patients(WaitlistFilterParams(waitlist_id=waitlist_id))

        if not result['results']:
            return None

        current_patient = result['results'][0]

        # Don't update if the values are the same
        if (current_patient.get('clinical_urgency') == grade_override.clinical_urgency and
                current_patient.get('condition_severity') == grade_override.condition_severity and
                abs(current_patient.get('comorbidities', 0) - grade_override.comorbidities) < 0.001):
            return current_patient

        self.waitlist_repo.override_grade(waitlist_id, grade_override)
        updated_result = self.waitlist_repo.query_patients(WaitlistFilterParams(waitlist_id=waitlist_id))
        return updated_result['results'][0] if updated_result['results'] else None