from typing import Optional, List, Dict
from pydantic import BaseModel, Field, model_validator
from fastapi import HTTPException
from api.config import WAITLIST_VALIDATION_LIMITS
from datetime import datetime
import re


class WaitlistFilterParams(BaseModel):
    waitlist_id: Optional[str] = None
    medical_number: Optional[str] = None
    postcode: Optional[str] = None
    department_id: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    grading_status: Optional[int] = Field(default=None, ge=0, le=1)
    assignment_status: Optional[int] = Field(default=None, ge=0, le=1)
    order_by: Optional[str] = None
    order_dir: Optional[str] = None
    page: Optional[int] = None

    min_referral_date: Optional[datetime] = None
    max_referral_date: Optional[datetime] = None

    min_clinical_urgency: Optional[int] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["clinical_urgency"]["min"], le=WAITLIST_VALIDATION_LIMITS["clinical_urgency"]["max"])
    max_clinical_urgency: Optional[int] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["clinical_urgency"]["min"], le=WAITLIST_VALIDATION_LIMITS["clinical_urgency"]["max"])

    min_condition_severity: Optional[int] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["condition_severity"]["min"], le=WAITLIST_VALIDATION_LIMITS["condition_severity"]["max"])
    max_condition_severity: Optional[int] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["condition_severity"]["min"], le=WAITLIST_VALIDATION_LIMITS["condition_severity"]["max"])

    min_comorbidities: Optional[float] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["comorbidities"]["min"], le=WAITLIST_VALIDATION_LIMITS["comorbidities"]["max"])
    max_comorbidities: Optional[float] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["comorbidities"]["min"], le=WAITLIST_VALIDATION_LIMITS["comorbidities"]["max"])

    @model_validator(mode="after")
    def check_min_less_than_max(self) -> "WaitlistFilterParams":
        min_max_pairs = [
            ("min_referral_date", "max_referral_date"),
            ("min_clinical_urgency", "max_clinical_urgency"),
            ("min_condition_severity", "max_condition_severity"),
            ("min_comorbidities", "max_comorbidities"),
        ]
        for min_field, max_field in min_max_pairs:
            min_val = getattr(self, min_field)
            max_val = getattr(self, max_field)
            if min_val is not None and max_val is not None and min_val > max_val:
                raise HTTPException(
                    status_code=400,
                    detail=f"{min_field.replace('_', ' ').capitalize()} cannot be greater than {max_field.replace('_', ' ')}."
                )

        return self

    @model_validator(mode="after")
    def validate_ordering_params(self) -> "WaitlistFilterParams":
        if self.order_by is not None:
            allowed_columns = {
                "date_of_birth",
                "referral_date",
                "clinical_urgency",
                "condition_severity",
                "comorbidities"
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


class MedicalHistoryEntry(BaseModel):
    date: str
    notes: str


class Patient(BaseModel):
    medical_number: str
    referral_department: str
    referral_date: datetime
    referral_notes: str
    auto_grade: bool
    date_of_birth: Optional[str] = None
    postcode: Optional[str] = None
    medical_history: Optional[List[MedicalHistoryEntry]] = None
    preferences: Optional[Dict[str, str]] = None
    prefers_evening: Optional[bool] = False


#? What is this for
class GradeOverride(BaseModel):
    clinical_urgency: int = Field(ge=WAITLIST_VALIDATION_LIMITS["clinical_urgency"]["min"], le=WAITLIST_VALIDATION_LIMITS["clinical_urgency"]["max"])
    condition_severity: int = Field(ge=WAITLIST_VALIDATION_LIMITS["condition_severity"]["min"], le=WAITLIST_VALIDATION_LIMITS["condition_severity"]["max"])
    comorbidities: float = Field(ge=WAITLIST_VALIDATION_LIMITS["comorbidities"]["min"], le=WAITLIST_VALIDATION_LIMITS["comorbidities"]["max"])

#? What is this for
class GradingScore(BaseModel):
    score: Optional[int | float] = None
    justification: Optional[str] = None
    
    @model_validator(mode="after")
    def validate_score(self) -> "GradingScore":
        if self.score is not None:
            if isinstance(self.score, str):
                try:
                    self.score = float(self.score)
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid score format: {self.score}"
                    )
        return self

#? What is this for
class GradingResult(BaseModel):
    clinical_urgency: Optional[int] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["clinical_urgency"]["min"], le=WAITLIST_VALIDATION_LIMITS["clinical_urgency"]["max"])
    condition_severity: Optional[int] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["condition_severity"]["min"], le=WAITLIST_VALIDATION_LIMITS["condition_severity"]["max"])
    comorbidities: Optional[float] = Field(default=None, ge=WAITLIST_VALIDATION_LIMITS["comorbidities"]["min"], le=WAITLIST_VALIDATION_LIMITS["comorbidities"]["max"])
    agent_justification: Optional[str] = None
    
    @classmethod
    def extract_score_from_text(cls, text: str, score_type: str) -> GradingScore:
        pattern = r'SCORE:\s*([0-9]*\.?[0-9]+)\s*.*?JUSTIFICATION:\s*(.*)'
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        
        if match:
            try:
                score_val = float(match.group(1))
                justification_val = match.group(2).strip("'\"`")
                
                if score_type == "comorbidities":
                    if not (WAITLIST_VALIDATION_LIMITS["comorbidities"]["min"] <= score_val <= WAITLIST_VALIDATION_LIMITS["comorbidities"]["max"]):
                        raise HTTPException(status_code=400, detail=f"Comorbidities score {score_val} out of valid range")
                else:
                    score_val = int(score_val)
                    limits = WAITLIST_VALIDATION_LIMITS.get(score_type, {})
                    if limits and not (limits.get("min", 0) <= score_val <= limits.get("max", 10)):
                        raise HTTPException(status_code=400, detail=f"{score_type} score {score_val} out of valid range")
                
                return GradingScore(score=score_val, justification=justification_val)
            except (ValueError, TypeError) as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse {score_type} score: {str(e)}")
        
        return GradingScore(score=None, justification=None)