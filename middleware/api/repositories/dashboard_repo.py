from api.utils import BigQueryClient
import os
import api.config.project
from datetime import datetime
from zoneinfo import ZoneInfo
from api.utils.time_utils import LOCAL_TIMEZONE

class DashboardRepository:
    def __init__(self):
        self.bq_client = BigQueryClient()

    async def query_dashboard_stats(self):
        # Get total appointments count
        appt_parameters = {}

        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)
        appt_parameters["current_time"] = ("DATETIME", current_datetime)

        appointments_query = f"SELECT COUNT(*) as total_appointments FROM {api.config.project.APPOINTMENTS_FQTN} WHERE appointment_time > @current_time"
        appointments_result = await self.bq_client.run_query(query=appointments_query, named_params=appt_parameters)
        
        # Get unassigned patients count
        patients_query = f"SELECT COUNT(*) as unassigned_patients FROM {api.config.project.WAITLIST_FQTN} WHERE NOT is_seen"
        patients_result = await self.bq_client.run_query(query=patients_query)
        
        # Combine results
        dashboard_stats = {
            "total_appointments": appointments_result[0]["total_appointments"] if appointments_result else 0,
            "unassigned_patients": patients_result[0]["unassigned_patients"] if patients_result else 0
        }
        
        return dashboard_stats