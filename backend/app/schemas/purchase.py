from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict


class PurchaseOrderItemBase(BaseModel):
    product_id: UUID
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal = Decimal(0)
    tax_rate: Decimal = Decimal(0)
    product_name: Optional[str] = None
    product_sku: Optional[str] = None

class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass

class PurchaseOrderItem(PurchaseOrderItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    received_quantity: Decimal
    tax_amount: Decimal
    total: Decimal

class PurchaseOrderBase(BaseModel):
    supplier_id: Optional[UUID] = None
    po_number: str
    order_date: datetime
    expected_date: Optional[datetime] = None
    notes: Optional[str] = None

class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseOrderItemCreate]

class PurchaseOrder(PurchaseOrderBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    status: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    created_at: datetime
    items: List[PurchaseOrderItem]

class PurchaseBillItemBase(BaseModel):
    product_id: UUID
    quantity: Decimal
    quantity_2: Optional[Decimal] = Decimal(0)
    quantity_3: Optional[Decimal] = Decimal(0)
    unit_price: Decimal
    tax_rate: Decimal = Decimal(18.0)
    p_challan_no: Optional[str] = None
    batch_id: Optional[UUID] = None
    batch_number: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None


class PurchaseBillItemCreate(PurchaseBillItemBase):
    pass

class PurchaseBillItem(PurchaseBillItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    tax_amount: Decimal
    total: Decimal


class PurchaseBillBase(BaseModel):
    supplier_id: Optional[UUID] = None
    purchase_order_id: Optional[UUID] = None
    bill_number: str
    bill_date: datetime
    due_date: Optional[datetime] = None
    total: Decimal
    # Added industrial metadata/ GST splits
    supplier_bill_no: Optional[str] = None
    place_of_supply: Optional[str] = None
    gst_type: Optional[str] = "B2B"
    cgst_amount: Optional[Decimal] = Decimal(0)
    sgst_amount: Optional[Decimal] = Decimal(0)
    igst_amount: Optional[Decimal] = Decimal(0)
    round_off_amount: Optional[Decimal] = Decimal(0)
    due_days: Optional[int] = 0
    narration_1: Optional[str] = None
    narration_2: Optional[str] = None

class PurchaseBillCreate(PurchaseBillBase):
    items: List[PurchaseBillItemCreate]

class PurchaseBill(PurchaseBillBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    status: str
    amount_paid: Decimal
    balance_due: Decimal
    created_at: datetime
    items: List[PurchaseBillItem]

# --- Debit Note (Purchase Return) ---
class DebitNoteItemBase(BaseModel):
    product_id: UUID
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal = Decimal(18)
    batch_id: Optional[UUID] = None


class DebitNoteItem(DebitNoteItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    tax_amount: Decimal
    total: Decimal

class DebitNoteCreate(BaseModel):
    supplier_id: Optional[UUID] = None
    bill_id: Optional[UUID] = None
    note_date: datetime
    reason: Optional[str] = None
    return_mode: Optional[str] = "GOODS_RETURN"
    items: List[DebitNoteItemBase]

class DebitNote(BaseModel):
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
    items: List[DebitNoteItem]
