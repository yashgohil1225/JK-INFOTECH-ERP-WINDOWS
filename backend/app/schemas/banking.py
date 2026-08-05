from typing import Optional, List
from decimal import Decimal
from uuid import UUID
from datetime import date, datetime
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict

# --- Account ---
class AccountBase(BaseModel):
    name: str
    account_code: Optional[str] = None
    account_type: str  # BANK | CASH | EQUITY | etc
    account_subtype: Optional[str] = None
    opening_balance: Decimal = Decimal("0.0")

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: UUID
    company_id: UUID
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Payment ---
class PaymentBase(BaseModel):
    payment_type: Optional[str] = None  # RECEIPT | PAYMENT
    party_type: Optional[str] = None    # customer | supplier
    party_id: Optional[UUID] = None
    payment_method: str = "CASH"
    bank_account: Optional[str] = None
    amount: Decimal
    tds_amount: Decimal = Decimal("0.0")
    payment_date: datetime
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class PaymentCreate(PaymentBase):
    pass

class Payment(PaymentBase):
    id: UUID
    company_id: UUID
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Capital Transfer ---
class CapitalTransferCreate(BaseModel):
    source_account_id: UUID
    destination_account_id: UUID
    amount: Decimal
    transfer_date: datetime
    notes: Optional[str] = "Initial Capital Infusion"
