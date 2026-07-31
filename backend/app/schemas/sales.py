from typing import Optional, List, Any
from decimal import Decimal
from uuid import UUID
from datetime import date, datetime
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, model_validator

# --- Customer ---
class CustomerBase(BaseModel):
    name: str
    gst_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    credit_days: int = 0
    opening_balance: Decimal = Decimal("0.0")
    outstanding_balance: Optional[Decimal] = Decimal("0.0")
    is_active: bool = True

class CustomerCreate(CustomerBase):
    pass

class Customer(CustomerBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Sales Order ---
class SalesOrderItemBase(BaseModel):
    product_id: UUID
    quantity: Decimal
    quantity_2: Decimal = Decimal("0.0")
    quantity_3: Decimal = Decimal("0.0")
    unit_price: Decimal
    discount_pct: Decimal = Decimal("0.0")
    tax_rate: Decimal = Decimal("18.0")
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    p_challan_no: Optional[str] = None

class SalesOrderItemCreate(SalesOrderItemBase):
    pass

class SalesOrderItem(SalesOrderItemBase):
    id: UUID
    tax_amount: Decimal
    total: Decimal
    
    model_config = ConfigDict(from_attributes=True)

class SalesOrderBase(BaseModel):
    customer_id: UUID
    so_number: str
    order_date: date
    delivery_date: Optional[date] = None
    status: str = "DRAFT"
    notes: Optional[str] = None

class SalesOrderCreate(SalesOrderBase):
    items: List[SalesOrderItemCreate]

class SalesOrder(SalesOrderBase):
    id: UUID
    company_id: UUID
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    created_at: datetime
    items: List[SalesOrderItem]
    
    model_config = ConfigDict(from_attributes=True)

from app.schemas.inventory import Product

# --- Invoice ---
class InvoiceItemBase(BaseModel):
    product_id: UUID
    quantity: Decimal
    quantity_2: Decimal = Decimal("0.0")
    quantity_3: Decimal = Decimal("0.0")
    unit_price: Decimal
    tax_rate: Decimal = Decimal("18.0")
    discount_pct: Decimal = Decimal("0.0")
    hsn_code: Optional[str] = None
    p_challan_no: Optional[str] = None
    batch_id: Optional[UUID] = None
    note: Optional[str] = None


class InvoiceItemCreate(InvoiceItemBase):
    pass

class InvoiceItem(InvoiceItemBase):
    id: UUID
    tax_amount: Decimal
    total: Decimal
    product: Optional[Product] = None
    
    model_config = ConfigDict(from_attributes=True)
class InvoiceBase(BaseModel):
    customer_id: UUID
    invoice_number: str
    invoice_date: date
    due_date: Optional[date] = None
    status: str = "UNPAID"
    subtotal: Decimal = Decimal("0.0")
    discount_amount: Decimal = Decimal("0.0")
    tax_amount: Decimal = Decimal("0.0")
    total: Decimal = Decimal("0.0")
    notes: Optional[str] = None
    eway_data: Optional[dict] = {}
    irn_data: Optional[dict] = {}
    
    # ── Missing DB columns ──
    bank_details: Optional[str] = None
    place_of_supply: Optional[str] = None
    gst_type: str = "B2B"
    cgst_amount: Decimal = Decimal("0.0")
    sgst_amount: Decimal = Decimal("0.0")
    igst_amount: Decimal = Decimal("0.0")
    round_off_amount: Decimal = Decimal("0.0")
    rounding_method: str = "normal"
    challan_no: Optional[str] = None
    challan_date: Optional[date] = None
    gst_transaction_type: Optional[str] = None
    supply_type: Optional[str] = None
    gst_nature: Optional[str] = None
    gst_inv_type: Optional[str] = None
    gst_method: Optional[str] = None
    broker_name: Optional[str] = None
    shipping_name: Optional[str] = None
    due_days: int = 0
    brokerage_percentage: Decimal = Decimal("0.0")
    rate_difference_amount: Decimal = Decimal("0.0")
    discount_percentage: Decimal = Decimal("0.0")
    other_plus_amount: Decimal = Decimal("0.0")
    other_plus_percentage: Decimal = Decimal("0.0")
    other_less_amount: Decimal = Decimal("0.0")
    other_less_percentage: Decimal = Decimal("0.0")
    freight_forwarding_amount: Decimal = Decimal("0.0")
    post_plus_1_amount: Decimal = Decimal("0.0")
    post_plus_1_percentage: Decimal = Decimal("0.0")
    post_plus_2_amount: Decimal = Decimal("0.0")
    post_plus_2_percentage: Decimal = Decimal("0.0")
    post_less_1_amount: Decimal = Decimal("0.0")
    post_less_1_percentage: Decimal = Decimal("0.0")
    post_less_2_amount: Decimal = Decimal("0.0")
    post_less_2_percentage: Decimal = Decimal("0.0")
    narration_1: Optional[str] = None
    narration_2: Optional[str] = None
    eway_bill_no: Optional[str] = None
    eway_bill_date: Optional[date] = None
    vehicle_no: Optional[str] = None
    transporter_name: Optional[str] = None
    transporter_id: Optional[str] = None
    distance_km_eway: Optional[Decimal] = None
    eway_bill_status: Optional[str] = None
    irn: Optional[str] = None
    ack_no: Optional[str] = None
    ack_date: Optional[datetime] = None
    qr_code: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def clean_empty_strings(cls, data: Any) -> Any:
        if isinstance(data, dict):
            numeric_fields = {
                "due_days", "brokerage_percentage", "rate_difference_amount",
                "discount_percentage", "other_plus_amount", "other_plus_percentage",
                "other_less_amount", "other_less_percentage", "freight_forwarding_amount",
                "post_plus_1_amount", "post_plus_1_percentage", "post_plus_2_amount",
                "post_plus_2_percentage", "post_less_1_amount", "post_less_1_percentage",
                "post_less_2_amount", "post_less_2_percentage", "distance_km_eway"
            }
            cleaned = data.copy()
            for field in numeric_fields:
                if field in cleaned and cleaned[field] == "":
                    if field == "due_days":
                        cleaned[field] = 0
                    else:
                        cleaned[field] = Decimal("0.0")
            return cleaned
        return data

class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate]

class Invoice(InvoiceBase):
    id: UUID
    company_id: UUID
    amount_paid: Decimal
    balance_due: Decimal
    created_at: datetime
    customer: Optional[Customer] = None
    items: List[InvoiceItem] = []
    
    model_config = ConfigDict(from_attributes=True)

# --- Credit Note (Sales Return) ---
class CreditNoteItemBase(BaseModel):
    product_id: UUID
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal = Decimal(18)
    batch_id: Optional[UUID] = None


class CreditNoteItem(CreditNoteItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    tax_amount: Decimal
    total: Decimal

class CreditNoteCreate(BaseModel):
    customer_id: UUID
    invoice_id: Optional[UUID] = None
    note_date: datetime
    reason: Optional[str] = None
    items: List[CreditNoteItemBase]

class CreditNote(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    note_number: str
    note_date: datetime
    reason: Optional[str] = None
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    items: List[CreditNoteItem]

