from api.utils import BigQueryClient
import uuid
from api.models import AppointmentsFilterParams, AppointmentCreate
import api.config.project
from datetime import datetime
from zoneinfo import ZoneInfo
from api.utils.time_utils import LOCAL_TIMEZONE, datetime_add

class AppointmentsRepository:
    def __init__(self):
        self.bq_client = BigQueryClient()

    async def query_appointments(self, params: AppointmentsFilterParams):
        filters = []
        parameters = {}
        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)
        parameters["current_time"] = ("DATETIME", current_datetime)

        if params.appointment_id:
            filters.append(f"appointment_id = @appointment_id")
            parameters["appointment_id"] = ("STRING", params.appointment_id)
        if params.start_time:
            filters.append(f"appointment_time >= @start_time")
            parameters["start_time"] = ("DATETIME", params.start_time.isoformat())
        if params.end_time:
            filters.append(f"appointment_time <= @end_time")
            parameters["end_time"] = ("DATETIME", params.end_time.isoformat())
        if params.hospital_id:
            filters.append(f"hospital_id = @hospital_id")
            parameters["hospital_id"] = ("STRING", params.hospital_id)
        if params.department_id:
            filters.append(f"department_id = @department_id")
            parameters["department_id"] = ("STRING", params.department_id)
        if params.status:
            filters.append(f"waitlist_id IS NULL")
        if params.auto_assignable:
            filters.append(f"assign_at <= @current_time OR (waitlist_id IS NULL AND assign_at IS NULL)")

        where_clause = " AND ".join(filters)
        query = f"SELECT * FROM {api.config.project.APPOINTMENTS_FQTN}"

        if where_clause:
            query += f" WHERE {where_clause}"
            query += " AND appointment_time >= @current_time"
        else:
            query += " WHERE appointment_time >= @current_time"
 
        query += " ORDER BY appointment_time ASC, appointment_id ASC"
        result = await self.bq_client.run_query(query=query, named_params=parameters)
        return result

    async def query_paginated_appointments(self, params: AppointmentsFilterParams): #TODO Combine this into the above function using optional params (DRY principle)
        filters = []
        parameters = {}
        current_datetime = datetime.now(tz=ZoneInfo(LOCAL_TIMEZONE)).replace(tzinfo=None).isoformat() # Make sure time is London, but strip timezone info after (e.g. # 2025-08-15 14:30:00+01:00 -> # 2025-08-15 14:30:00)
        parameters["current_time"] = ("DATETIME", current_datetime)

        if params.appointment_id:
            filters.append(f"appointment_id LIKE @appointment_id")
            parameters["appointment_id"] = ("STRING", f"%{params.appointment_id}%")
        if params.waitlist_id:
            filters.append(f"waitlist_id LIKE @waitlist_id")
            parameters["waitlist_id"] = ("STRING", f"%{params.waitlist_id}%")
        if params.start_time:
            filters.append(f"appointment_time >= @start_time")
            parameters["start_time"] = ("DATETIME", params.start_time.isoformat())
        if params.end_time:
            filters.append(f"appointment_time <= @end_time")
            parameters["end_time"] = ("DATETIME", params.end_time.isoformat())
        if params.hospital_id:
            filters.append(f"hospital_id = @hospital_id")
            parameters["hospital_id"] = ("STRING", params.hospital_id)
        if params.department_id:
            filters.append(f"department_id = @department_id")
            parameters["department_id"] = ("STRING", params.department_id)
        if params.status: #? Status is optional int, don't understand the logic here
            filters.append(f"waitlist_id IS NULL")

        where_clause = " AND ".join(filters)
        
        full_where_clause = "appointment_time >= @current_time"
        if where_clause:
            full_where_clause = f"{where_clause} AND {full_where_clause}"
        
        # Get total count
        count_query = f"SELECT COUNT(*) as total FROM {api.config.project.APPOINTMENTS_FQTN} WHERE {full_where_clause}"
        total_result = await self.bq_client.run_query(query=count_query, named_params=parameters)
        total_count = total_result[0]['total'] if total_result else 0
        
        # Get paginated results
        query = f"""
        SELECT 
            *
        FROM 
            {api.config.project.APPOINTMENTS_FQTN} 
        WHERE {full_where_clause}
        """

        if params.order_by:
            query += f" ORDER BY {params.order_by}" #BUG SQL injection possible if validation for this fails, need to parametise
            if params.order_dir and params.order_dir == "desc":
                query += " DESC"
            else:
                query += " ASC"
        else:
            query += " ORDER BY appointment_time ASC, appointment_id ASC"
        
        # Default pagination: page 1, 20 results per page
        page = getattr(params, 'page', 1) or 1
        limit = 20
        offset = (page - 1) * limit
        
        query += f" LIMIT {limit} OFFSET {offset}"

        result = await self.bq_client.run_query(query=query, named_params=parameters)

        return {
            'results': result or [],
            'total': total_count,
            'page': page,
            'total_pages': (total_count + limit - 1) // limit,
            'has_next': page * limit < total_count,
            'has_prev': page > 1
        }

    async def add_appointment(self, appointment: AppointmentCreate):
        appointment_id = str(uuid.uuid4()) #REFACTOR to service, pass in as param

        parameters = {
            "appointment_id": ("STRING", appointment_id),
            "appointment_time": ("DATETIME", appointment.appointment_time.isoformat()),
            "department_id": ("STRING", appointment.department_id),
            "hospital_id": ("STRING", appointment.hospital_id),
            "properties": ("JSON", appointment.properties),
            "assign_at": ("DATETIME", None)
        }
        

        # Give the user at least 1 hour to manually assign the appointment
        if not appointment.auto_assign:
            parameters["assign_at"] = ("DATETIME", datetime_add(hours=2, truncate_to_hour=True))
        
        query = f"""
        INSERT INTO {api.config.project.APPOINTMENTS_FQTN} (appointment_id, appointment_time, department_id, hospital_id, properties, assign_at)
        VALUES (@appointment_id, @appointment_time, @department_id, @hospital_id, @properties, @assign_at)
        """        
        
        await self.bq_client.run_query(query=query, named_params=parameters)

        filter_params = AppointmentsFilterParams(appointment_id=appointment_id)
        result = await self.query_paginated_appointments(filter_params)
        
        if result['results']:
            return result['results'][0]
        return None
