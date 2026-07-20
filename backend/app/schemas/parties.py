from typing import Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, field_validator

class PartyBase(BaseModel):
    name: str
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    opening_balance: Decimal = Decimal("0")
    is_active: bool = True
    default_tax_rate: Optional[float] = None
    
    # Industrial Metadata (Mandatory in DB)
    gst_treatment: str = "Registered Business"
    country: str = "India"
    payment_terms: str = "Immediate"
    
    # Additional Industrial Fields
    msme_no: Optional[str] = None
    type_of_trader: Optional[str] = "Regular"
    station: Optional[str] = None
    state_code: Optional[str] = None
    street2: Optional[str] = None
    
    # Financial Metadata
    discount_pct: Decimal = Decimal("0")
    tds_rate: Decimal = Decimal("0")

    # New Industrial Fields
    mobile_no: Optional[str] = None
    secondary_phone: Optional[str] = None
    address_3: Optional[str] = None
    opening_balance_type: str = "dr"
    bill_by_bill: bool = True
    gst_filling_method: Optional[str] = None
    check_credit_days: bool = False
    type_of_supply: str = "Goods"
    
    # Banking Details
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_account_no: Optional[str] = None

    @field_validator("opening_balance", "discount_pct", "tds_rate", mode="before")
    @classmethod
    def empty_string_to_zero(cls, v):
        if v == "" or v is None:
            return Decimal("0")
        return v

    @field_validator("payment_terms", "gst_treatment", "country", mode="before")
    @classmethod
    def handle_string_defaults(cls, v, info):
        defaults = {
            "payment_terms": "Immediate",
            "gst_treatment": "Registered Business",
            "country": "India",
        }
        if v == "" or v is None:
            return defaults.get(info.field_name, "")
        return str(v)

    model_config = ConfigDict(from_attributes=True, extra="ignore")

class CustomerBase(PartyBase):
    credit_limit: Decimal = Decimal("0")
    credit_days: int = 0

    @field_validator("credit_limit", mode="before")
    @classmethod
    def handle_empty_limit(cls, v):
        if v == "" or v is None:
            return Decimal("0")
        return v
    
    @field_validator("credit_days", mode="before")
    @classmethod
    def handle_empty_days(cls, v):
        if v == "" or v is None:
            return 0
        return v

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    opening_balance: Optional[Decimal] = None
    opening_balance_type: Optional[str] = None
    is_active: Optional[bool] = None
    default_tax_rate: Optional[float] = None
    credit_limit: Optional[Decimal] = None
    credit_days: Optional[int] = None
    gst_treatment: Optional[str] = None
    country: Optional[str] = None
    payment_terms: Optional[str] = None
    msme_no: Optional[str] = None
    type_of_trader: Optional[str] = None
    station: Optional[str] = None
    state_code: Optional[str] = None
    street2: Optional[str] = None
    address_3: Optional[str] = None
    discount_pct: Optional[Decimal] = None
    tds_rate: Optional[Decimal] = None
    mobile_no: Optional[str] = None
    secondary_phone: Optional[str] = None
    bill_by_bill: Optional[bool] = None
    gst_filling_method: Optional[str] = None
    check_credit_days: Optional[bool] = None
    type_of_supply: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_account_no: Optional[str] = None

class Customer(CustomerBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class CustomerLight(BaseModel):
    id: UUID
    name: str
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)

class SupplierBase(PartyBase):
    credit_days: int = 0

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    opening_balance: Optional[Decimal] = None
    is_active: Optional[bool] = None
    default_tax_rate: Optional[float] = None
    credit_days: Optional[int] = None
    gst_treatment: Optional[str] = None
    country: Optional[str] = None
    payment_terms: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_account_no: Optional[str] = None

class Supplier(SupplierBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class SupplierLight(BaseModel):
    id: UUID
    name: str
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)
