from api.repositories import HospitalsRepository

class HospitalsService:
    def __init__(self):
        self.repo = HospitalsRepository()

    async def get_hospitals(self):
        return await self.repo.query_hospitals()

    async def get_hospital_postcode(self, hospital_id: str):
        return await self.repo.query_hospital_postcode(hospital_id)
