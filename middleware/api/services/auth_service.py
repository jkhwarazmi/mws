from fastapi import Header, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from firebase_admin import auth
from api.services.secrets import Secrets

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

class AuthService:
    @staticmethod
    def _validate_api_key(api_key: str) -> bool:
        secret = Secrets()
        return api_key == secret.get_secret("SERVICE_API_KEY")
    
    @staticmethod
    async def get_current_user_or_service(
        token: str | None = Depends(oauth2_scheme),
        x_api_key: str | None = Header(None)
    ):
        # If an API key is provided, use it as the primary auth method
        if x_api_key:
            if AuthService._validate_api_key(x_api_key):
                return {"identity": "internal_service"}
            else:
                # An invalid API key was provided
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API Key" #FIXME should be a general exception not http
                )

        # If a token is provided, use it as the secondary auth method
        if token:
            try:
                decoded_token = auth.verify_id_token(token)
                email = decoded_token.get("email")

                # Can query to check if the user is in the table, for now just check if the email ends with @pwc.com
                # bq_client = BigQueryClient()
                # email_query = f"SELECT email FROM `{os.environ.get('BQ_PROJECT_ID')}.{os.environ.get('PROJECT_DATASET')}.{os.environ.get('USERS_TABLE')}` WHERE email = @email"
                # email_result = bq_client.run_query(query=email_query, named_params={"email": ("STRING", email)})

                if email:
                    return decoded_token

                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="User not authorised for this service." #FIXME should be a general exception not http
                )
            except auth.InvalidIdTokenError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials" #FIXME should be a general exception not http
                )

        # If neither a valid API key nor a token was provided, deny access
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated" #FIXME should be a general exception not http
        )

    @staticmethod
    async def get_programmatic_access(
        x_api_key: str | None = Header(None)
    ):
        if not x_api_key:
            raise HTTPException( #FIXME should be a general exception not http
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="API key required for programmatic access"
            )
        
        if AuthService._validate_api_key(x_api_key):
            return {"identity": "internal_service", "access_type": "programmatic"}
        else:
            raise HTTPException( #FIXME should be a general exception not http
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid API Key"
            )