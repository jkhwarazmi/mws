from api.repositories import AppointmentsRepository
from api.models import AppointmentsFilterParams, AppointmentCreate

class AppointmentsService:
    def __init__(self):
        self.repo = AppointmentsRepository()

    async def get_appointments(self, params: AppointmentsFilterParams):
        return await self.repo.query_appointments(params)

    async def get_paginated_appointments(self, params: AppointmentsFilterParams):
        return await self.repo.query_paginated_appointments(params)
    
    async def add_appointment(self, appointment: AppointmentCreate):
        return await self.repo.add_appointment(appointment)