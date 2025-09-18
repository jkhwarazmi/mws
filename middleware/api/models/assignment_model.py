from pydantic import BaseModel, EmailStr
from typing import Optional


class Assignment(BaseModel):
    """
        POST method body for assigning patients to appointment slots
    """
    appointment_id: str
    waitlist_id: str
    email: Optional[EmailStr] = None
