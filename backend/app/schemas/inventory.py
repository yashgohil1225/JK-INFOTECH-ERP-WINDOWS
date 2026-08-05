from typing import Optional, List
from decimal import Decimal
from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict

# --- Category ---
class ProductCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[UUID] = None

class ProductCategoryCreate(ProductCategoryBase):
    pass

class ProductCategory(ProductCategoryBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Product ---
class ProductBase(BaseModel):
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    unit: str = "PCS"
    base_unit: str = "PCS"
    item_type: str = "goods"
    secondary_unit: Optional[str] = None
    conversion_factor: Decimal = Decimal("1.0")
    purchase_price: Decimal = Decimal("0.0")
    sale_price: Decimal = Decimal("0.0")
    mrp: Decimal = Decimal("0.0")
    tax_preference: str = "taxable"
    tax_rate: Decimal = Decimal("0.0")
    intra_state_tax_rate: Decimal = Decimal("0.0")
    inter_state_tax_rate: Decimal = Decimal("0.0")
    hsn_code: Optional[str] = None
    sac_code: Optional[str] = None
    reorder_level: Decimal = Decimal("0.0")
    has_batch_tracking: bool = False
    is_active: bool = True
    category_id: Optional[UUID] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    hsn_code: Optional[str] = None
    reorder_level: Optional[Decimal] = None
    is_active: Optional[bool] = None
    category_id: Optional[UUID] = None

class Product(ProductBase):
    id: UUID
    company_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    current_stock: Decimal = Decimal("0.0")
    category: Optional[ProductCategory] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Batch ---
class BatchBase(BaseModel):
    batch_number: str
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    cost_price: Decimal = Decimal("0.0")
    sale_price: Decimal = Decimal("0.0")
    is_active: bool = True

class BatchCreate(BatchBase):
    pass

class BatchUpdate(BaseModel):
    batch_number: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    cost_price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None
    is_active: Optional[bool] = None

class Batch(BatchBase):
    id: UUID
    company_id: UUID
    product_id: UUID
    created_at: datetime
    updated_at: datetime
    current_stock: Decimal = Decimal("0.0")
    expiry_status: Optional[str] = "active"

    model_config = ConfigDict(from_attributes=True)

# --- Stock ---
class StockEntryBase(BaseModel):
    product_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    entry_type: str  # OPENING | PURCHASE_IN | SALE_OUT | ADJUSTMENT
    quantity: Decimal
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    notes: Optional[str] = None

class StockEntryCreate(StockEntryBase):
    pass

class StockEntry(StockEntryBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    batch: Optional[Batch] = None
    
    model_config = ConfigDict(from_attributes=True)

