from google.cloud import bigquery
import os
import asyncio

class BigQueryClient:

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(BigQueryClient, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        project_id = os.environ.get("BQ_PROJECT_ID")
        if not project_id:
            raise EnvironmentError("BQ_PROJECT_ID not set in environment")

        self.client = bigquery.Client(project=project_id)
        self._initialized = True

        if os.environ.get("ENV") == "development":
            print(f"[BigQueryClient] Initialized with project_id: {project_id}")

    async def run_query(self, query: str, named_params: dict[str, tuple[str, object]] = None, positional_params: list[tuple[str, object]] = None):
        """
            Runs a query against the instance of bigquery

            :param str query: SQL query (containing named `@name` params, or positional `?` params)
            :param dict[str, tuple[str, object]] named_params: Dictionary of named params with type and value e.g. `{'name' : ('type', value)}`
            :param list[tuple[str, object]] positional_params: List of positional parameters `[('type', value)]`
        """
        named_params = named_params or {}
        positional_params = positional_params or []

        if named_params and positional_params:
            raise ValueError("Cannot use both named and positional parameters in the same query")

        query_params = []

        if named_params:
            for name, (bq_data_type, value) in named_params.items():
                query_params.append(bigquery.ScalarQueryParameter(name, bq_data_type, value))

        elif positional_params:
            for bq_data_type, value in positional_params:
                query_params.append(bigquery.ScalarQueryParameter(None, bq_data_type, value))

        # Only pass query_parameters if we actually have parameters
        if query_params:
            job_config = bigquery.QueryJobConfig(query_parameters=query_params)
        else:
            job_config = bigquery.QueryJobConfig()
        
        def _execute_query():
            query_job = self.client.query(query, job_config=job_config)
            result = query_job.result()
            return [dict(row) for row in result]
        
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _execute_query)