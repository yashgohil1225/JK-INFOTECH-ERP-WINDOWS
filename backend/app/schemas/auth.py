# =============================================================
# JK INFOTECH ERP — Auth Schemas
# File : app/schemas/auth.py
# =============================================================
# Pydantic models define the shape of:
#   - What data comes IN  (request body)
#   - What data goes OUT  (response body)
# FastAPI uses these for automatic validation + Swagger docs
# =============================================================

from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from uuid import UUID

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, EmailStr, field_validator, Field


# =============================================================
# REQUEST SCHEMAS  (data coming IN from the client)
# =============================================================

class RegisterRequest(BaseModel):
    """Body for POST /api/auth/register"""

    full_name: str = Field(..., min_length=2, max_length=150)
    email:     EmailStr
    password:  str = Field(..., min_length=8, max_length=128)
    phone:     Optional[str] = Field(None, max_length=20)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        import re
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z)")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter (a-z)")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number (0-9)")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain at least one symbol (e.g. @, #, !, $)")
        return v

    @field_validator("full_name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("This field cannot be empty")
        return v.strip()

    model_config = {
        "json_schema_extra": {
            "example": {
                "full_name": "Jayesh Kumar",
                "email":    "admin@jksolution.com",
                "password": "Admin@1234",
                "phone":    "9876543210",
            }
        }
    }


class LoginRequest(BaseModel):
    """Body for POST /api/auth/login"""
    login_id: str = Field(..., max_length=255)
    password: Optional[str] = Field(None, max_length=128)
    pin: Optional[str] = Field(None, max_length=10)
    otp: Optional[str] = Field(None, max_length=10)
    remember_me: bool = False

    model_config = {
        "json_schema_extra": {
            "example": {
                "login_id": "admin@jksolution.com",
                "password": "Admin@1234",
                "remember_me": True
            }
        }
    }


class SendOtpRequest(BaseModel):
    """Body for POST /api/auth/send-otp"""
    login_id: str


class SendOtpResponse(BaseModel):
    """Response for POST /api/auth/send-otp"""
    message: str


class RefreshRequest(BaseModel):
    """Body for POST /api/auth/refresh"""
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    """Body for POST /api/auth/change-password"""
    current_password: str
    new_password:     str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        import re
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain at least one symbol (e.g. @, #, !, $)")
        return v


class ForgotPasswordRequest(BaseModel):
    """Body for POST /api/auth/forgot-password"""
    login_id: str


class ResetPasswordRequest(BaseModel):
    """Body for POST /api/auth/reset-password"""
    login_id: str
    otp: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        import re
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain at least one symbol (e.g. @, #, !, $)")
        return v




class SwitchCompanyRequest(BaseModel):
    """Body for POST /api/auth/switch-company"""
    company_id: UUID


class SetPinRequest(BaseModel):
    """Body for POST /api/auth/set-pin"""
    pin: str
    current_password: Optional[str] = None

    @field_validator("pin")
    @classmethod
    def pin_format(cls, v: str) -> str:
        if not v.isdigit() or len(v) not in [4, 6]:
            raise ValueError("PIN must be 4 or 6 digits")
        return v


class VerifyPinRequest(BaseModel):
    """Body for POST /api/auth/verify-pin"""
    login_id: Optional[str] = None
    refresh_token: Optional[str] = None
    pin: str


class UpdateSecurityRequest(BaseModel):
    """Body for PATCH /api/auth/security-settings"""
    pin_login_enabled: Optional[bool] = None


class UnlockPinRequest(BaseModel):
    """Body for POST /api/auth/unlock-pin"""
    login_id: str
    otp: str


class FiscalYearCreate(BaseModel):
    """Body for POST /api/companies/fiscal-years"""
    label: str
    start_date: date
    end_date: date
    is_active: bool = True


class FiscalYearResponse(BaseModel):
    """Returned by GET/POST /api/companies/fiscal-years"""
    id: UUID
    company_id: UUID
    label: str
    start_date: date
    end_date: date
    is_active: bool
    closed_at: Optional[datetime] = None
    closing_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class FiscalYearCloseRequest(BaseModel):
    """Body for POST /api/companies/fiscal-years/{fy_id}/close"""
    closing_notes: Optional[str] = None


# =============================================================
# RESPONSE SCHEMAS  (data going OUT to the client)
# =============================================================



# pyrefly: ignore [missing-import]
from pydantic import BaseModel, UUID4, Field


class CompanyResponse(BaseModel):
    """Company info returned in auth responses"""
    id: UUID
    name: str
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    tan_no: Optional[str] = None
    office_address_1: Optional[str] = None
    office_address_2: Optional[str] = None
    office_address_3: Optional[str] = None
    office_address_4: Optional[str] = None
    station_name: Optional[str] = None
    registered_state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"
    phone: Optional[str] = None
    mobile_no: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    hsn_sac_type: Optional[str] = None
    is_gst_applicable: bool = True
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    account_no: Optional[str] = None
    ifsc_code: Optional[str] = None
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    default_terms: Optional[str] = None
    default_tax_rate: Optional[float] = None
    default_gst_rate: Optional[Decimal] = None
    settings: Optional[dict] = None
    default_hsn_sac_code: Optional[str] = None
    current_fy_id: Optional[UUID] = None

    is_active: bool = True

    model_config = {"from_attributes": True}


class CompanyUpdate(BaseModel):
    """Body for PUT /api/companies/me"""
    name:        Optional[str] = None
    gst_number:  Optional[str] = None
    pan_number:  Optional[str] = None
    tan_no:      Optional[str] = None
    
    office_address_1: Optional[str] = None
    office_address_2: Optional[str] = None
    office_address_3: Optional[str] = None
    office_address_4: Optional[str] = None
    
    station_name: Optional[str] = None
    registered_state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    
    phone: Optional[str] = None
    mobile_no: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    
    hsn_sac_type: Optional[str] = None
    is_gst_applicable: Optional[bool] = None
    
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    account_no: Optional[str] = None
    ifsc_code: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    default_terms: Optional[str] = None
    default_tax_rate: Optional[float] = None
    default_gst_rate: Optional[Decimal] = None
    default_hsn_sac_code: Optional[str] = None
    settings: Optional[dict] = None

class CompanyCreate(CompanyUpdate):
    """Body for POST /api/companies"""
    name: str


class UserResponse(BaseModel):
    """
    User info returned in /me and register responses.
    NEVER include password_hash here.
    """
    id:           UUID
    company_id:   UUID
    full_name:    str
    email:        str
    phone:        Optional[str]
    avatar_url:   Optional[str]
    is_active:    bool
    is_superadmin: bool
    has_pin:      bool = False
    pin_login_enabled: bool = False
    last_login:   Optional[datetime]
    created_at:   datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """
    Returned after successful login or refresh.
    access_token  — short-lived  (15 min)  — sent in Authorization header
    refresh_token — long-lived   (30 days) — used to get new access_token
    """
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    expires_in:    int  # seconds until access_token expires


class LoginResponse(BaseModel):
    """Full response for POST /api/auth/login"""
    user:    UserResponse
    company: CompanyResponse
    tokens:  TokenResponse


class RegisterResponse(BaseModel):
    """Full response for POST /api/auth/register"""
    message: str
    user:    UserResponse
    company: CompanyResponse
    tokens:  TokenResponse


class MeResponse(BaseModel):
    """Full response for GET /api/auth/me"""
    user:    UserResponse
    company: CompanyResponse


class MessageResponse(BaseModel):
    """Generic success message response"""
    message: str


class GSTVerificationResponse(BaseModel):
    """Response for GST verification lookup"""
    gstin:        str
    legal_name:   str
    trade_name:   Optional[str] = None
    status:       str  # Active, Inactive, etc.
    state_code:   str
    address:      Optional[str] = None
    is_valid:     bool = True