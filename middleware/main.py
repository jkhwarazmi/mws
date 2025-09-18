from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from api.routes import waitlist, match, appointments, departments, hospitals, rejected_appointments, dashboard, auth
import os

app = FastAPI()

firebase_admin.initialize_app()

# Allow the frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.environ.get('FRONTEND_URL')
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(appointments.router, prefix="/appointments")
app.include_router(waitlist.router, prefix="/waitlist")
app.include_router(match.router, prefix="/match")
app.include_router(departments.router, prefix="/departments")
app.include_router(hospitals.router, prefix="/hospitals")
app.include_router(rejected_appointments.router, prefix="/rejected-appointments")
app.include_router(dashboard.router, prefix="/dashboard")
app.include_router(auth.router, prefix="/auth")


@app.get("/")
async def root():
    return None
