from api.repositories import DepartmentsRepository

class DepartmentsService:
    def __init__(self):
        self.repo = DepartmentsRepository()

    async def get_departments(self):
        return await self.repo.query_departments()