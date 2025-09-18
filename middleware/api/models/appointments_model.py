from typing import Optional, List
from pydantic import BaseModel, Field, model_validator
from fastapi import HTTPException
from datetime import datetime


class AppointmentsFilterParams(BaseModel):
    appointment_id: Optional[str] = None
    waitlist_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    hospital_id: Optional[str] = None
    department_id: Optional[str] = None
    status: Optional[int] = None
    auto_assignable: Optional[bool] = None
    order_by: Optional[str] = None
    order_dir: Optional[str] = None
    page: Optional[int] = None

    @model_validator(mode="after")
    def check_start_time_before_end_time(self) -> "AppointmentsFilterParams":
        if (self.start_time and self.end_time) and (self.end_time < self.start_time):
            raise HTTPException(
                status_code=400,
                detail="start_time must be earlier than or equal to end_time"
            )
        
        return self

    @model_validator(mode="after")
    def validate_ordering_params(self) -> "AppointmentsFilterParams":
        if self.order_by is not None:
            allowed_columns = {
                "appointment_time"
            }
            if self.order_by not in allowed_columns:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid order_by column: {self.order_by}. Allowed columns: {sorted(allowed_columns)}" #? Should we be exposing the field name here to the API (prettify it maybe)
                )

        if self.order_dir is not None and self.order_dir.lower() not in {"asc", "desc"}:
            raise HTTPException(
                status_code=400,
                detail="order_dir must be 'asc' or 'desc'"
            )

        return self


class AppointmentCreate(BaseModel):
    appointment_time: datetime
    department_id: str
    hospital_id: str
    auto_assign: bool = False
    properties: Optional[List[str]] = None