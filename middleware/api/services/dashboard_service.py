from api.repositories import DashboardRepository

class DashboardService:
    def __init__(self):
        self.repo = DashboardRepository()

    async def get_dashboard_stats(self):
        return await self.repo.query_dashboard_stats()