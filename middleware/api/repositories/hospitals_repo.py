from api.utils import BigQueryClient
import api.config.project


class HospitalsRepository:
    def __init__(self):
        self.bq_client = BigQueryClient()

    async def query_hospitals(self):
        query = f"SELECT * FROM {api.config.project.HOSPITALS_FQTN}"
        result = await self.bq_client.run_query(query=query)

        return result

    async def query_hospital_postcode(self, hospital_id: str):
        query = f"""
            SELECT postcode
            FROM {api.config.project.HOSPITALS_FQTN}
            WHERE hospital_id = @hospital_id
        """
        params = {"hospital_id": ("STRING", hospital_id)}
        return await self.bq_client.run_query(query=query, named_params=params)
