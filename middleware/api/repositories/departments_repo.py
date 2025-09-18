from api.utils import BigQueryClient
import api.config.project

class DepartmentsRepository:
    def __init__(self):
        self.bq_client = BigQueryClient()

    async def query_departments(self):
        query = f"SELECT * FROM {api.config.project.DEPARTMENTS_FQTN}"
        result = await self.bq_client.run_query(query=query)

        return result
