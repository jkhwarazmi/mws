import os

from google.cloud import secretmanager
from google.api_core.exceptions import GoogleAPIError


class Secrets:
    def __init__(self):
        self.client = secretmanager.SecretManagerServiceClient()

    def get_secret(self, secret_name: str):
        try:
            name = f"projects/{os.getenv('BQ_PROJECT_ID')}/secrets/{secret_name}/versions/latest"
            response = self.client.access_secret_version(request={"name": name})

            return response.payload.data.decode("UTF-8")

        except GoogleAPIError as e:
            print(f"An error occurred while accessing secret '{secret_name}': {e}")
