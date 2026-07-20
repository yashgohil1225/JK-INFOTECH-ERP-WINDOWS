# =============================================================
# JK SOLUTION ERP — SQLAlchemy Models
# File    : app/models.py
# Version : 1.0.0
# Date    : 2026-03-21
# ORM     : SQLAlchemy 2.0  (mapped_column / DeclarativeBase)
# DB      : PostgreSQL 15+
# =============================================================
#
# Usage in FastAPI:
#   from app.models import Base, Company, User, Product ...
#   Base.metadata.create_all(bind=engine)        # or use Alembic
#
# Alembic autogenerate:
#   alembic revision --autogenerate -m "initial schema"
#   alembic upgrade head
# =============================================================

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

# pyrefly: ignore [missing-import]
from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, ForeignKey,
    Float, Integer, Numeric, String, Text, UniqueConstraint, func,
)
# pyrefly: ignore [missing-import]
from sqlalchemy.dialects.postgresql import JSONB, UUID
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, relationship,
)


# ── Base ──────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """All models inherit from this base."""
    pass


# ── Reusable mixin: auto timestamps ──────────────────────────
class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# =============================================================
# MODULE 1 — COMPANY & AUTH
# =============================================================

class Company(TimestampMixin, Base):
    """
    Top-level tenant.  Every other model has a company_id FK.
    One Company = one branch / business entity.
    """
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str]              = mapped_column(String(255), nullable=False)
    gst_number: Mapped[Optional[str]]  = mapped_column(String(20))
    pan_number: Mapped[Optional[str]]  = mapped_column(String(20))
    tan_no: Mapped[Optional[str]]      = mapped_column(String(20))
    
    # Master Addresses
    office_address_1: Mapped[Optional[str]] = mapped_column(Text)
    office_address_2: Mapped[Optional[str]] = mapped_column(Text)
    office_address_3: Mapped[Optional[str]] = mapped_column(Text)
    office_address_4: Mapped[Optional[str]] = mapped_column(Text)
    
    
    station_name: Mapped[Optional[str]] = mapped_column(String(100))
    registered_state: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]]     = mapped_column(String(10))
    country: Mapped[str]               = mapped_column(String(100), default="India")
    
    # Contact Nodes
    phone: Mapped[Optional[str]]       = mapped_column(String(20))
    mobile_no: Mapped[Optional[str]]   = mapped_column(String(20))
    email: Mapped[Optional[str]]       = mapped_column(String(255))
    logo_url: Mapped[Optional[str]]    = mapped_column(Text)
    
    # Taxation Specials
    hsn_sac_type: Mapped[Optional[str]]      = mapped_column(String(50))
    is_gst_applicable: Mapped[bool]          = mapped_column(Boolean, default=True)
    
    # Finance
    bank_name: Mapped[Optional[str]]   = mapped_column(String(255))
    bank_branch: Mapped[Optional[str]] = mapped_column(String(255))
    account_no: Mapped[Optional[str]]  = mapped_column(String(100))
    ifsc_code: Mapped[Optional[str]]   = mapped_column(String(20))
    currency: Mapped[str]              = mapped_column(String(10), default="INR")
    timezone: Mapped[str]              = mapped_column(String(50), default="Asia/Kolkata")
    current_fy_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("fiscal_years.id", ondelete="SET NULL"), index=True)
    default_terms: Mapped[Optional[str]]      = mapped_column(Text)
    default_tax_rate: Mapped[Optional[float]]    = mapped_column(Float)
    default_gst_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    default_hsn_sac_code: Mapped[Optional[str]] = mapped_column(String(50))
    
    settings: Mapped[Optional[dict]]           = mapped_column(JSONB, default=dict)
    
    is_active: Mapped[bool]            = mapped_column(Boolean, default=True, nullable=False)

    # ── relationships ──
    users: Mapped[List["User"]]                       = relationship(back_populates="company")
    roles: Mapped[List["Role"]]                       = relationship(back_populates="company")
    product_categories: Mapped[List["ProductCategory"]] = relationship(back_populates="company")
    products: Mapped[List["Product"]]                 = relationship(back_populates="company")
    suppliers: Mapped[List["Supplier"]]               = relationship(back_populates="company")
    customers: Mapped[List["Customer"]]               = relationship(back_populates="company")
    purchase_orders: Mapped[List["PurchaseOrder"]]    = relationship(back_populates="company")
    sales_orders: Mapped[List["SalesOrder"]]          = relationship(back_populates="company")
    invoices: Mapped[List["Invoice"]]                 = relationship(back_populates="company")
    purchase_bills: Mapped[List["PurchaseBill"]]      = relationship(back_populates="company")
    accounts: Mapped[List["Account"]]                 = relationship(back_populates="company")
    journal_entries: Mapped[List["JournalEntry"]]     = relationship(back_populates="company")
    audit_logs: Mapped[List["AuditLog"]]              = relationship(back_populates="company")
    tax_rates: Mapped[List["TaxRate"]]                = relationship(back_populates="company")
    sequences: Mapped[List["DocumentSequence"]]        = relationship(back_populates="company", cascade="all, delete-orphan")
    fiscal_years: Mapped[List["FiscalYear"]]          = relationship(back_populates="company", cascade="all, delete-orphan", foreign_keys="[FiscalYear.company_id]")
    current_fy: Mapped[Optional["FiscalYear"]]        = relationship(foreign_keys=[current_fy_id])
    support_tickets: Mapped[List["SupportTicket"]]     = relationship(back_populates="company", cascade="all, delete-orphan")
    callback_requests: Mapped[List["CallbackRequest"]] = relationship(back_populates="company", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Company id={self.id} name={self.name!r}>"


# ─────────────────────────────────────────────────────────────

class User(TimestampMixin, Base):
    """
    ERP user.  Scoped to one company.
    Login = email + bcrypt password_hash.
    """
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("company_id", "email", name="uq_users_company_email"),
    )

    id: Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name: Mapped[str]        = mapped_column(String(255), nullable=False)
    email: Mapped[str]            = mapped_column(String(255), nullable=False, index=True)
    password_hash: Mapped[str]    = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]]  = mapped_column(String(20))
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool]       = mapped_column(Boolean, default=True, nullable=False)
    is_superadmin: Mapped[bool]   = mapped_column(Boolean, default=False, nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Quick Access PIN (hashed)
    pin_hash: Mapped[Optional[str]] = mapped_column(String(255))
    pin_login_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failed_pin_attempts: Mapped[int] = mapped_column(Integer, default=0)
    pin_locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # ── relationships ──
    company: Mapped["Company"]        = relationship(back_populates="users")
    user_roles: Mapped[List["UserRole"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    audit_logs: Mapped[List["AuditLog"]] = relationship(back_populates="user")

    @property
    def has_pin(self) -> bool:
        return self.pin_hash is not None

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"


# ─────────────────────────────────────────────────────────────

class Role(Base):
    """RBAC role definition, scoped to a company."""
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_roles_company_name"),
    )

    id: Mapped[uuid.UUID]         = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str]             = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ── relationships ──
    company: Mapped["Company"]                  = relationship(back_populates="roles")
    user_roles: Mapped[List["UserRole"]]         = relationship(back_populates="role")
    role_permissions: Mapped[List["RolePermission"]] = relationship(back_populates="role", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name!r}>"


# ─────────────────────────────────────────────────────────────

class Permission(Base):
    """
    Granular permission: module + action pair.
    Seeded once at setup — not company-scoped.
    """
    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("module", "action", name="uq_permissions_module_action"),
    )

    id: Mapped[uuid.UUID]         = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module: Mapped[str]           = mapped_column(String(100), nullable=False)
    action: Mapped[str]           = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    role_permissions: Mapped[List["RolePermission"]] = relationship(back_populates="permission")

    def __repr__(self) -> str:
        return f"<Permission {self.module}.{self.action}>"


# ─────────────────────────────────────────────────────────────

class UserRole(Base):
    """Junction table: many-to-many User ↔ Role."""
    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_roles"),
    )

    id: Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="user_roles")
    role: Mapped["Role"] = relationship(back_populates="user_roles")


# ─────────────────────────────────────────────────────────────

class RolePermission(Base):
    """Junction table: many-to-many Role ↔ Permission."""
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permissions"),
    )

    id: Mapped[uuid.UUID]            = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

    role: Mapped["Role"]             = relationship(back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship(back_populates="role_permissions")


# ─────────────────────────────────────────────────────────────

class AuditLog(Base):
    """
    Append-only audit trail. NEVER update or delete rows here.
    Stores old_values / new_values as JSONB for full history.
    """
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str]            = mapped_column(String(50), nullable=False)   # CREATE/UPDATE/DELETE/LOGIN
    module: Mapped[str]            = mapped_column(String(100), nullable=False, index=True)
    record_id: Mapped[Optional[str]] = mapped_column(String(255))
    old_values: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_values: Mapped[Optional[dict]] = mapped_column(JSONB)
    ip_address: Mapped[Optional[str]]  = mapped_column(String(45))
    user_agent: Mapped[Optional[str]]  = mapped_column(Text)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    company: Mapped["Company"]     = relationship(back_populates="audit_logs")
    user: Mapped[Optional["User"]] = relationship(back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.module} by user={self.user_id}>"


# ─────────────────────────────────────────────────────────────

class UserSession(Base):
    """
    Persistent sessions for token rotation (RTR) and device tracking.
    """
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token: Mapped[str]     = mapped_column(String(512), nullable=False, index=True)
    expires_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    is_revoked: Mapped[bool]       = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<UserSession id={self.id} user={self.user_id} revoked={self.is_revoked}>"


# =============================================================
# MODULE 2 — INVENTORY
# =============================================================

class ProductCategory(Base):
    """
    Hierarchical product categories (supports parent_id for subcategories).
    Example: Electronics → Mobile Phones → Smartphones
    """
    __tablename__ = "product_categories"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_product_categories_company_name"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str]              = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("product_categories.id", ondelete="SET NULL"))
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"]                  = relationship(back_populates="product_categories")
    parent: Mapped[Optional["ProductCategory"]] = relationship(remote_side="ProductCategory.id")
    products: Mapped[List["Product"]]           = relationship(back_populates="category")

    def __repr__(self) -> str:
        return f"<ProductCategory id={self.id} name={self.name!r}>"


# ─────────────────────────────────────────────────────────────

class Product(TimestampMixin, Base):
    """
    Master product / item list.
    All prices in NUMERIC(15,2) — no float precision issues.
    """
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("company_id", "sku", name="uq_products_company_sku"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("product_categories.id", ondelete="SET NULL"), index=True)
    created_by: Mapped[Optional[uuid.UUID]]  = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    name: Mapped[str]              = mapped_column(String(255), nullable=False, index=True)
    sku: Mapped[Optional[str]]     = mapped_column(String(100), index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    unit: Mapped[str]              = mapped_column(String(50), default="PCS")   # PCS, KG, LTR, MTR, BOX
    base_unit: Mapped[str]         = mapped_column(String(50), default="PCS")
    item_type: Mapped[str]         = mapped_column(String(20), default="goods") # goods, service
    secondary_unit: Mapped[Optional[str]] = mapped_column(String(50))
    conversion_factor: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=1)
    
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    sale_price: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    mrp: Mapped[Decimal]           = mapped_column(Numeric(15, 2), default=0)
    
    tax_preference: Mapped[str]    = mapped_column(String(20), default="taxable")
    tax_rate: Mapped[Decimal]      = mapped_column(Numeric(5, 2), default=0)    # GST %
    intra_state_tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    inter_state_tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))                # for GST compliance
    sac_code: Mapped[Optional[str]] = mapped_column(String(20))
    reorder_level: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    has_batch_tracking: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool]        = mapped_column(Boolean, default=True, nullable=False)

    # ── relationships ──
    company: Mapped["Company"]                            = relationship(back_populates="products")
    category: Mapped[Optional["ProductCategory"]]         = relationship(back_populates="products")
    stock_entries: Mapped[List["StockEntry"]]             = relationship(back_populates="product")
    purchase_order_items: Mapped[List["PurchaseOrderItem"]] = relationship(back_populates="product")
    sales_order_items: Mapped[List["SalesOrderItem"]]     = relationship(back_populates="product")

    @property
    def current_stock(self) -> Decimal:
        """
        Calculates current stock from ledger entries.
        Industrial Optimization: Supports '_current_stock_override' injected by routers 
        to avoid expensive relationship loading on large datasets.
        """
        if hasattr(self, "_current_stock_override"):
            return self._current_stock_override
        
        try:
            return sum((item.quantity for item in self.stock_entries), Decimal("0.0"))
        except (AttributeError, Exception):
            # Fallback if stock_entries aren't loaded and no override is provided
            return Decimal("0.0")

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name!r} sku={self.sku!r}>"


# ─────────────────────────────────────────────────────────────

class Batch(TimestampMixin, Base):
    __tablename__ = "batches"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)

    batch_number: Mapped[str]      = mapped_column(String(100), nullable=False, index=True)
    manufacturing_date: Mapped[Optional[date]] = mapped_column(Date)
    expiry_date: Mapped[Optional[date]]        = mapped_column(Date, index=True)

    cost_price: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    sale_price: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)

    is_active: Mapped[bool]        = mapped_column(Boolean, default=True, nullable=False)

    company: Mapped["Company"]     = relationship()
    product: Mapped["Product"]     = relationship()
    stock_entries: Mapped[List["StockEntry"]] = relationship(back_populates="batch", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('company_id', 'product_id', 'batch_number', name='uq_batches_product_batch'),
    )


# ─────────────────────────────────────────────────────────────

class StockEntry(Base):
    """
    Event-sourced stock log. NEVER update — only INSERT.
    current_stock = SELECT SUM(quantity) WHERE product_id=?
    Positive quantity = stock IN, Negative = stock OUT.
    """
    __tablename__ = "stock_entries"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)

    entry_type: Mapped[str]        = mapped_column(String(30), nullable=False, index=True)
    # OPENING | PURCHASE_IN | SALE_OUT | RETURN_IN | RETURN_OUT | ADJUSTMENT

    quantity: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False)
    # Positive = IN, Negative = OUT

    reference_type: Mapped[Optional[str]] = mapped_column(String(50))
    # 'purchase_order' | 'sales_order' | 'manual'

    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    notes: Mapped[Optional[str]]   = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True, index=True)

    company: Mapped["Company"]     = relationship()
    product: Mapped["Product"]     = relationship(back_populates="stock_entries")
    batch: Mapped[Optional["Batch"]] = relationship(back_populates="stock_entries")

    def __repr__(self) -> str:
        return f"<StockEntry product={self.product_id} type={self.entry_type} qty={self.quantity}>"


# =============================================================
# MODULE 3 — SUPPLIERS & PURCHASE
# =============================================================

class Supplier(TimestampMixin, Base):
    """Supplier / vendor master."""
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    name: Mapped[str]              = mapped_column(String(255), nullable=False, index=True)
    gst_number: Mapped[Optional[str]]  = mapped_column(String(20))
    pan_number: Mapped[Optional[str]]  = mapped_column(String(20))
    phone: Mapped[Optional[str]]   = mapped_column(String(20))
    email: Mapped[Optional[str]]   = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]]    = mapped_column(String(100))
    state: Mapped[Optional[str]]   = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    credit_days: Mapped[int]       = mapped_column(Integer, default=0)
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    is_active: Mapped[bool]        = mapped_column(Boolean, default=True, nullable=False)
    default_tax_rate: Mapped[Optional[float]] = mapped_column(Float)

    # Missing Industrial Metadata
    gst_treatment: Mapped[str]     = mapped_column(String(100), default="Registered Business", nullable=False)
    country: Mapped[str]           = mapped_column(String(100), default="India", nullable=False)
    payment_terms: Mapped[str]     = mapped_column(String(100), default="Immediate", nullable=False)

    # Additional Industrial Fields
    msme_no: Mapped[Optional[str]] = mapped_column(String(100))
    type_of_trader: Mapped[Optional[str]] = mapped_column(String(50), default="Regular")
    station: Mapped[Optional[str]] = mapped_column(String(100))
    state_code: Mapped[Optional[str]] = mapped_column(String(10))
    street2: Mapped[Optional[str]] = mapped_column(Text)

    # Missing Mandatory Financials
    discount_pct: Mapped[Decimal]  = mapped_column(Numeric(15, 2), default=0, nullable=False)
    tds_rate: Mapped[Decimal]      = mapped_column(Numeric(15, 2), default=0, nullable=False)

    # New Industrial Fields
    mobile_no: Mapped[Optional[str]]   = mapped_column(String(20))
    secondary_phone: Mapped[Optional[str]] = mapped_column(String(20))
    address_3: Mapped[Optional[str]]   = mapped_column(Text)
    opening_balance_type: Mapped[str]  = mapped_column(String(10), default="cr") # Default CR for suppliers (Payable)
    bill_by_bill: Mapped[bool]         = mapped_column(Boolean, default=True)
    gst_filling_method: Mapped[Optional[str]] = mapped_column(String(50))
    check_credit_days: Mapped[bool]    = mapped_column(Boolean, default=False)
    type_of_supply: Mapped[str]        = mapped_column(String(20), default="Goods")
    
    # Banking Details
    bank_name: Mapped[Optional[str]]   = mapped_column(String(255))
    bank_branch: Mapped[Optional[str]] = mapped_column(String(255))
    ifsc_code: Mapped[Optional[str]]   = mapped_column(String(20))
    bank_account_no: Mapped[Optional[str]] = mapped_column(String(100))

    company: Mapped["Company"]                       = relationship(back_populates="suppliers")
    purchase_orders: Mapped[List["PurchaseOrder"]]   = relationship(back_populates="supplier")
    purchase_bills: Mapped[List["PurchaseBill"]]     = relationship(back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier id={self.id} name={self.name!r}>"


# ─────────────────────────────────────────────────────────────

class PurchaseOrder(TimestampMixin, Base):
    """
    Purchase Order header raised to a supplier.
    Status: DRAFT → SENT → PARTIAL → RECEIVED → CANCELLED
    """
    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("company_id", "po_number", name="uq_purchase_orders_company_po"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    po_number: Mapped[str]         = mapped_column(String(50), nullable=False)
    order_date: Mapped[date]       = mapped_column(Date, nullable=False, server_default=func.current_date())
    expected_date: Mapped[Optional[date]] = mapped_column(Date)
    received_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[str]            = mapped_column(String(30), default="DRAFT", index=True)

    subtotal: Mapped[Decimal]       = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal]     = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal]          = mapped_column(Numeric(15, 2), default=0)
    notes: Mapped[Optional[str]]    = mapped_column(Text)

    company: Mapped["Company"]                       = relationship(back_populates="purchase_orders")
    supplier: Mapped["Supplier"]                     = relationship(back_populates="purchase_orders")
    items: Mapped[List["PurchaseOrderItem"]]          = relationship(back_populates="purchase_order", cascade="all, delete-orphan")
    purchase_bills: Mapped[List["PurchaseBill"]]     = relationship(back_populates="purchase_order")

    def __repr__(self) -> str:
        return f"<PurchaseOrder {self.po_number} status={self.status}>"


# ─────────────────────────────────────────────────────────────

class PurchaseOrderItem(Base):
    """Line item on a Purchase Order."""
    __tablename__ = "purchase_order_items"

    id: Mapped[uuid.UUID]               = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)

    quantity: Mapped[Decimal]           = mapped_column(Numeric(15, 2), nullable=False)
    received_quantity: Mapped[Decimal]  = mapped_column(Numeric(15, 2), default=0)
    
    # Snapshots for historical integrity
    product_name: Mapped[str]           = mapped_column(String(255), nullable=True) 
    product_sku: Mapped[Optional[str]]  = mapped_column(String(100))
    
    unit_price: Mapped[Decimal]         = mapped_column(Numeric(15, 2), nullable=False)
    discount_pct: Mapped[Decimal]       = mapped_column(Numeric(5, 2), default=0)
    tax_rate: Mapped[Decimal]           = mapped_column(Numeric(5, 2), default=0)
    tax_amount: Mapped[Decimal]         = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal]              = mapped_column(Numeric(15, 2), nullable=False)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="items")
    product: Mapped["Product"]              = relationship(back_populates="purchase_order_items")


# =============================================================
# MODULE 4 — CUSTOMERS & SALES
# =============================================================

class Customer(TimestampMixin, Base):
    """Customer master. Holds credit limit and credit days."""
    __tablename__ = "customers"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    name: Mapped[str]              = mapped_column(String(255), nullable=False, index=True)
    gst_number: Mapped[Optional[str]]  = mapped_column(String(20))
    pan_number: Mapped[Optional[str]]  = mapped_column(String(20))
    phone: Mapped[Optional[str]]   = mapped_column(String(20))
    email: Mapped[Optional[str]]   = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]]    = mapped_column(String(100))
    state: Mapped[Optional[str]]   = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    credit_limit: Mapped[Decimal]  = mapped_column(Numeric(15, 2), default=0)
    credit_days: Mapped[int]       = mapped_column(Integer, default=0)
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    is_active: Mapped[bool]        = mapped_column(Boolean, default=True, nullable=False)
    default_tax_rate: Mapped[Optional[float]] = mapped_column(Float)
    
    # Missing Industrial Metadata
    gst_treatment: Mapped[str]     = mapped_column(String(100), default="Registered Business", nullable=False)
    country: Mapped[str]           = mapped_column(String(100), default="India", nullable=False)
    payment_terms: Mapped[str]     = mapped_column(String(100), default="Immediate", nullable=False)

    # Additional Industrial Fields
    msme_no: Mapped[Optional[str]] = mapped_column(String(100))
    type_of_trader: Mapped[Optional[str]] = mapped_column(String(50), default="Regular")
    station: Mapped[Optional[str]] = mapped_column(String(100))
    state_code: Mapped[Optional[str]] = mapped_column(String(10))
    street2: Mapped[Optional[str]] = mapped_column(Text)

    # Missing Mandatory Financials
    discount_pct: Mapped[Decimal]  = mapped_column(Numeric(15, 2), default=0, nullable=False)
    tds_rate: Mapped[Decimal]      = mapped_column(Numeric(15, 2), default=0, nullable=False)

    # New Industrial Fields
    mobile_no: Mapped[Optional[str]]   = mapped_column(String(20))
    secondary_phone: Mapped[Optional[str]] = mapped_column(String(20))
    address_3: Mapped[Optional[str]]   = mapped_column(Text)
    opening_balance_type: Mapped[str]  = mapped_column(String(10), default="dr") # Default DR for customers (Receivable)
    bill_by_bill: Mapped[bool]         = mapped_column(Boolean, default=True)
    gst_filling_method: Mapped[Optional[str]] = mapped_column(String(50))
    check_credit_days: Mapped[bool]    = mapped_column(Boolean, default=False)
    type_of_supply: Mapped[str]        = mapped_column(String(20), default="Goods")

    # Banking Details
    bank_name: Mapped[Optional[str]]   = mapped_column(String(255))
    bank_branch: Mapped[Optional[str]] = mapped_column(String(255))
    ifsc_code: Mapped[Optional[str]]   = mapped_column(String(20))
    bank_account_no: Mapped[Optional[str]] = mapped_column(String(100))

    company: Mapped["Company"]                   = relationship(back_populates="customers")
    sales_orders: Mapped[List["SalesOrder"]]     = relationship(back_populates="customer")
    invoices: Mapped[List["Invoice"]]            = relationship(back_populates="customer")

    def __repr__(self) -> str:
        return f"<Customer id={self.id} name={self.name!r}>"


# ─────────────────────────────────────────────────────────────

class SalesOrder(TimestampMixin, Base):
    """
    Sales Order header raised for a customer.
    Status: DRAFT → CONFIRMED → DISPATCHED → DELIVERED → CANCELLED
    """
    __tablename__ = "sales_orders"
    __table_args__ = (
        UniqueConstraint("company_id", "so_number", name="uq_sales_orders_company_so"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    so_number: Mapped[str]         = mapped_column(String(50), nullable=False)
    order_date: Mapped[date]       = mapped_column(Date, nullable=False, server_default=func.current_date())
    delivery_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[str]            = mapped_column(String(30), default="DRAFT", index=True)

    subtotal: Mapped[Decimal]       = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal]     = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal]          = mapped_column(Numeric(15, 2), default=0)
    notes: Mapped[Optional[str]]    = mapped_column(Text)
    
    # ── Industrial Metadata Parity ──
    gst_type: Mapped[str]          = mapped_column(String(30), default="B2B")
    cgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    sgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    igst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    
    challan_no: Mapped[Optional[str]] = mapped_column(String(50))
    challan_date: Mapped[Optional[date]] = mapped_column(Date)
    gst_transaction_type: Mapped[Optional[str]] = mapped_column(String(50))
    supply_type: Mapped[Optional[str]] = mapped_column(String(50))
    gst_nature: Mapped[Optional[str]] = mapped_column(String(50))
    gst_inv_type: Mapped[Optional[str]] = mapped_column(String(50))
    gst_method: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Financial Adjustments
    post_plus_1_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    post_plus_1_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    post_plus_2_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    post_plus_2_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    
    post_less_1_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    post_less_1_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    post_less_2_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    post_less_2_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    
    other_plus_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    other_plus_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    other_less_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    other_less_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    
    rate_difference_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    freight_forwarding_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    brokerage_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    broker_name: Mapped[Optional[str]]    = mapped_column(String(100))
    due_days: Mapped[int]                 = mapped_column(Integer, default=0)
    discount_percentage: Mapped[Decimal]  = mapped_column(Numeric(5, 2), default=0)
    
    # Logistics
    shipping_name: Mapped[Optional[str]]  = mapped_column(String(100))
    narration_1: Mapped[Optional[str]]    = mapped_column(Text)
    narration_2: Mapped[Optional[str]]    = mapped_column(Text)

    company: Mapped["Company"]                 = relationship(back_populates="sales_orders")
    customer: Mapped["Customer"]               = relationship(back_populates="sales_orders")
    items: Mapped[List["SalesOrderItem"]]       = relationship(back_populates="sales_order", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]]           = relationship(back_populates="sales_order")

    def __repr__(self) -> str:
        return f"<SalesOrder {self.so_number} status={self.status}>"


# ─────────────────────────────────────────────────────────────

class SalesOrderItem(Base):
    """Line item on a Sales Order."""
    __tablename__ = "sales_order_items"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sales_order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)

    quantity: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False)
    quantity_2: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    quantity_3: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    
    # Snapshots for historical integrity
    product_name: Mapped[str]      = mapped_column(String(255), nullable=True) 
    product_sku: Mapped[Optional[str]] = mapped_column(String(100))
    p_challan_no: Mapped[Optional[str]] = mapped_column(String(50))
    
    unit_price: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False)
    discount_pct: Mapped[Decimal]  = mapped_column(Numeric(5, 2), default=0)
    tax_rate: Mapped[Decimal]      = mapped_column(Numeric(5, 2), default=0)
    tax_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal]         = mapped_column(Numeric(15, 2), nullable=False)

    sales_order: Mapped["SalesOrder"] = relationship(back_populates="items")
    product: Mapped["Product"]        = relationship(back_populates="sales_order_items")


# =============================================================
# MODULE 5 — FINANCE & ACCOUNTS
# =============================================================

class TaxRate(Base):
    """GST / tax rate definitions per company."""
    __tablename__ = "tax_rates"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_tax_rates_company_name"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str]              = mapped_column(String(100), nullable=False)   # e.g. "GST 18%"
    rate: Mapped[Decimal]          = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax_type: Mapped[str]          = mapped_column(String(30), default="GST")    # GST/IGST/CGST/SGST/EXEMPT
    is_active: Mapped[bool]        = mapped_column(Boolean, default=True, nullable=False)

    company: Mapped["Company"]     = relationship(back_populates="tax_rates")

    def __repr__(self) -> str:
        return f"<TaxRate {self.name} {self.rate}%>"


# ─────────────────────────────────────────────────────────────

class Account(Base):
    """
    Chart of Accounts.  Hierarchical via parent_id.
    account_type: ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
    """
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("company_id", "account_code", name="uq_accounts_company_code"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"))

    name: Mapped[str]              = mapped_column(String(255), nullable=False)
    account_code: Mapped[Optional[str]] = mapped_column(String(20))
    account_type: Mapped[str]      = mapped_column(String(50), nullable=False, index=True)
    account_subtype: Mapped[Optional[str]] = mapped_column(String(100))
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    is_system: Mapped[bool]        = mapped_column(Boolean, default=False)   # system accounts can't be deleted
    is_active: Mapped[bool]        = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"]     = relationship(back_populates="accounts")
    parent: Mapped[Optional["Account"]] = relationship(remote_side="Account.id")
    journal_lines: Mapped[List["JournalEntryLine"]] = relationship(back_populates="account")

    def __repr__(self) -> str:
        return f"<Account {self.account_code} {self.name!r} [{self.account_type}]>"


# ─────────────────────────────────────────────────────────────

class Invoice(TimestampMixin, Base):
    """
    Customer Invoice (Accounts Receivable).
    balance_due = total - amount_paid
    Status: DRAFT → SENT → PARTIAL → PAID / OVERDUE → CANCELLED
    """
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_invoices_company_number"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    sales_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sales_orders.id", ondelete="SET NULL"))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    invoice_number: Mapped[str]    = mapped_column(String(50), nullable=False)
    invoice_date: Mapped[date]     = mapped_column(Date, nullable=False, server_default=func.current_date(), index=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, index=True)
    status: Mapped[str]            = mapped_column(String(30), default="UNPAID", index=True)

    subtotal: Mapped[Decimal]       = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal]     = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal]          = mapped_column(Numeric(15, 2), default=0)
    amount_paid: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    balance_due: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    notes: Mapped[Optional[str]]    = mapped_column(Text)
    terms: Mapped[Optional[str]]    = mapped_column(Text)
    
    # ── Industrial Metadata & Financial Reconciliation ──
    bank_details: Mapped[Optional[str]] = mapped_column(Text)
    place_of_supply: Mapped[Optional[str]] = mapped_column(String(100))
    gst_type: Mapped[str]          = mapped_column(String(30), default="B2B")
    cgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    sgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    igst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    round_off_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    rounding_method: Mapped[str]   = mapped_column(String(50), default="normal")
    
    challan_no: Mapped[Optional[str]] = mapped_column(String(50))
    challan_date: Mapped[Optional[date]] = mapped_column(Date)
    gst_transaction_type: Mapped[Optional[str]] = mapped_column(String(50))
    supply_type: Mapped[Optional[str]] = mapped_column(String(50))
    gst_nature: Mapped[Optional[str]] = mapped_column(String(50))
    gst_inv_type: Mapped[Optional[str]] = mapped_column(String(50))
    gst_method: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Financial Adjustments
    post_plus_1_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    post_plus_1_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    post_plus_2_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    post_plus_2_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    
    post_less_1_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    post_less_1_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    post_less_2_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    post_less_2_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    
    other_plus_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    other_plus_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    other_less_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    other_less_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    
    rate_difference_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    freight_forwarding_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    brokerage_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    broker_name: Mapped[Optional[str]]    = mapped_column(String(100))
    due_days: Mapped[int]                 = mapped_column(Integer, default=0)
    discount_percentage: Mapped[Decimal]  = mapped_column(Numeric(5, 2), default=0)
    
    # Logistics & Compliance
    shipping_name: Mapped[Optional[str]]  = mapped_column(String(100))
    vehicle_no: Mapped[Optional[str]]     = mapped_column(String(50))
    transporter_name: Mapped[Optional[str]] = mapped_column(String(100))
    transporter_id: Mapped[Optional[str]] = mapped_column(String(50))
    distance_km_eway: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    eway_bill_no: Mapped[Optional[str]]   = mapped_column(String(50))
    eway_bill_date: Mapped[Optional[date]] = mapped_column(Date)
    eway_bill_status: Mapped[Optional[str]] = mapped_column(String(50))
    
    irn: Mapped[Optional[str]]            = mapped_column(String(100))
    ack_no: Mapped[Optional[str]]         = mapped_column(String(50))
    ack_date: Mapped[Optional[datetime]]  = mapped_column(DateTime)
    qr_code: Mapped[Optional[str]]        = mapped_column(Text)
    narration_1: Mapped[Optional[str]]    = mapped_column(Text)
    narration_2: Mapped[Optional[str]]    = mapped_column(Text)

    # Statutory Compliance Data (Industrial Grade Persistence)
    eway_data: Mapped[Optional[dict]] = mapped_column(JSONB, server_default='{}')
    irn_data: Mapped[Optional[dict]]  = mapped_column(JSONB, server_default='{}')

    company: Mapped["Company"]         = relationship(back_populates="invoices")
    customer: Mapped["Customer"]       = relationship(back_populates="invoices")
    sales_order: Mapped[Optional["SalesOrder"]] = relationship(back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Invoice {self.invoice_number} total={self.total} balance={self.balance_due}>"


class CreditNote(TimestampMixin, Base):
    """
    Sales Return (Credit Note). Issued to customer to reduce receivable.
    """
    __tablename__ = "credit_notes"
    __table_args__ = (
        UniqueConstraint("company_id", "note_number", name="uq_credit_notes_company_number"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    note_number: Mapped[str]       = mapped_column(String(50), nullable=False)
    note_date: Mapped[datetime]    = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reason: Mapped[Optional[str]]  = mapped_column(Text)
    status: Mapped[str]            = mapped_column(String(30), default="AUTHORIZED")

    subtotal: Mapped[Decimal]      = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal]         = mapped_column(Numeric(15, 2), default=0)
    gst_type: Mapped[str]          = mapped_column(String(30), default="B2B")
    cgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    sgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    igst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)

    company: Mapped["Company"]     = relationship()
    customer: Mapped["Customer"]   = relationship()
    invoice: Mapped[Optional["Invoice"]] = relationship()
    items: Mapped[List["CreditNoteItem"]] = relationship(back_populates="credit_note", cascade="all, delete-orphan")

class CreditNoteItem(Base):
    __tablename__ = "credit_note_items"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    credit_note_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("credit_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True, index=True)
    
    quantity: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False)
    unit_price: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False)
    tax_rate: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False, default=18.0)
    tax_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False, default=0)
    total: Mapped[Decimal]         = mapped_column(Numeric(15, 2), nullable=False)

    credit_note: Mapped["CreditNote"] = relationship(back_populates="items")
    product: Mapped["Product"]     = relationship()
    batch: Mapped[Optional["Batch"]] = relationship()



class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True, index=True)
    
    quantity: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False)
    quantity_2: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False, default=0)
    quantity_3: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False, default=0)
    unit_price: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False)
    tax_rate: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False, default=18.0)
    tax_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False, default=0)
    total: Mapped[Decimal]         = mapped_column(Numeric(15, 2), nullable=False)
    discount_pct: Mapped[Decimal]  = mapped_column(Numeric(15, 2), nullable=False, default=0)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    p_challan_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    note: Mapped[Optional[str]]         = mapped_column(Text)

    invoice: Mapped["Invoice"]     = relationship(back_populates="items")
    product: Mapped["Product"]     = relationship()
    batch: Mapped[Optional["Batch"]] = relationship()


# ─────────────────────────────────────────────────────────────

class PurchaseBill(TimestampMixin, Base):
    """
    Supplier Bill (Accounts Payable). Mirror of Invoice.
    balance_due = total - amount_paid
    Status: DRAFT → RECEIVED → PARTIAL → PAID → CANCELLED
    """
    __tablename__ = "purchase_bills"
    __table_args__ = (
        UniqueConstraint("company_id", "bill_number", name="uq_purchase_bills_company_number"),
    )

    id: Mapped[uuid.UUID]               = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id: Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    purchase_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="SET NULL"))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    bill_number: Mapped[str]            = mapped_column(String(50), nullable=False)
    supplier_bill_no: Mapped[Optional[str]] = mapped_column(String(100))  # supplier's own reference
    bill_date: Mapped[date]             = mapped_column(Date, nullable=False, server_default=func.current_date(), index=True)
    due_date: Mapped[Optional[date]]    = mapped_column(Date, index=True)
    status: Mapped[str]                 = mapped_column(String(30), default="DRAFT", index=True)

    subtotal: Mapped[Decimal]           = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal]         = mapped_column(Numeric(15, 2), default=0)
    cgst_amount: Mapped[Decimal]        = mapped_column(Numeric(15, 2), default=0)
    sgst_amount: Mapped[Decimal]        = mapped_column(Numeric(15, 2), default=0)
    igst_amount: Mapped[Decimal]        = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal]              = mapped_column(Numeric(15, 2), default=0)
    amount_paid: Mapped[Decimal]        = mapped_column(Numeric(15, 2), default=0)
    balance_due: Mapped[Decimal]        = mapped_column(Numeric(15, 2), default=0)
    notes: Mapped[Optional[str]]        = mapped_column(Text)

    # ── Industrial GST Columns (Reconciled with DB Schema) ──
    gst_type: Mapped[str]          = mapped_column(String(20), default="B2B")
    cgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    sgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    igst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    round_off_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    place_of_supply: Mapped[Optional[str]] = mapped_column(String(100))

    company: Mapped["Company"]          = relationship(back_populates="purchase_bills")
    supplier: Mapped["Supplier"]        = relationship(back_populates="purchase_bills")
    purchase_order: Mapped[Optional["PurchaseOrder"]] = relationship(back_populates="purchase_bills")
    items: Mapped[List["PurchaseBillItem"]] = relationship(back_populates="purchase_bill", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<PurchaseBill {self.bill_number} total={self.total} balance={self.balance_due}>"


class PurchaseBillItem(Base):
    __tablename__ = "purchase_bill_items"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_bill_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_bills.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True, index=True)
    
    quantity: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False)
    quantity_2: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False, default=0)
    quantity_3: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False, default=0)
    unit_price: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False)
    tax_rate: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False, default=18.0)
    tax_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False, default=0)
    total: Mapped[Decimal]         = mapped_column(Numeric(15, 2), nullable=False)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    p_challan_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    purchase_bill: Mapped["PurchaseBill"] = relationship(back_populates="items")
    product: Mapped["Product"]     = relationship()
    batch: Mapped[Optional["Batch"]] = relationship()


class DebitNote(TimestampMixin, Base):
    """
    Purchase Return (Debit Note). Issued to supplier to reduce liability.
    """
    __tablename__ = "debit_notes"
    __table_args__ = (
        UniqueConstraint("company_id", "note_number", name="uq_debit_notes_company_number"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    bill_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_bills.id", ondelete="SET NULL"))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    note_number: Mapped[str]       = mapped_column(String(50), nullable=False)
    note_date: Mapped[datetime]    = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reason: Mapped[Optional[str]]  = mapped_column(Text)
    status: Mapped[str]            = mapped_column(String(30), default="AUTHORIZED")

    subtotal: Mapped[Decimal]      = mapped_column(Numeric(15, 2), default=0)
    tax_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0)
    total: Mapped[Decimal]         = mapped_column(Numeric(15, 2), default=0)
    gst_type: Mapped[str]          = mapped_column(String(30), default="B2B")
    cgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    sgst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    igst_amount: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)

    company: Mapped["Company"]     = relationship()
    supplier: Mapped["Supplier"]   = relationship()
    bill: Mapped[Optional["PurchaseBill"]] = relationship()
    items: Mapped[List["DebitNoteItem"]] = relationship(back_populates="debit_note", cascade="all, delete-orphan")

class DebitNoteItem(Base):
    __tablename__ = "debit_note_items"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debit_note_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debit_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True, index=True)
    
    quantity: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False)
    unit_price: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False)
    tax_rate: Mapped[Decimal]      = mapped_column(Numeric(15, 2), nullable=False, default=18.0)
    tax_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), nullable=False, default=0)
    total: Mapped[Decimal]         = mapped_column(Numeric(15, 2), nullable=False)

    debit_note: Mapped["DebitNote"] = relationship(back_populates="items")
    product: Mapped["Product"]     = relationship()
    batch: Mapped[Optional["Batch"]] = relationship()



# ─────────────────────────────────────────────────────────────

class Payment(Base):
    """
    Cash / bank receipts (from customers) and payments (to suppliers).
    payment_type: RECEIPT | PAYMENT
    party_type:   customer | supplier
    """
    __tablename__ = "payments"

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    payment_type: Mapped[str]      = mapped_column(String(20), nullable=False, index=True)
    # RECEIPT = money received from customer
    # PAYMENT = money paid to supplier

    reference_type: Mapped[str]    = mapped_column(String(30), nullable=False)
    # 'invoice' | 'purchase_bill' | 'advance'

    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    party_type: Mapped[str]        = mapped_column(String(20), nullable=False)   # 'customer' | 'supplier'
    party_id: Mapped[uuid.UUID]    = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    payment_method: Mapped[str]    = mapped_column(String(30), default="CASH")
    # CASH | BANK_TRANSFER | CHEQUE | UPI | CARD

    amount: Mapped[Decimal]        = mapped_column(Numeric(15, 2), nullable=False)
    tds_amount: Mapped[Decimal]    = mapped_column(Numeric(15, 2), default=0, server_default="0.00", nullable=False)
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100))  # cheque no / UTR / txn ID
    bank_account: Mapped[Optional[str]]     = mapped_column(String(255))
    notes: Mapped[Optional[str]]   = mapped_column(Text)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_reconciled: Mapped[bool]    = mapped_column(Boolean, default=False, nullable=False)
    company: Mapped["Company"]     = relationship()

    def __repr__(self) -> str:
        return f"<Payment {self.payment_type} amount={self.amount} method={self.payment_method}>"


# ─────────────────────────────────────────────────────────────

class JournalEntry(Base):
    """
    Double-entry bookkeeping header.
    RULE: total_debit MUST always equal total_credit.
    Auto-created by the system when invoices/bills/payments are posted.
    """
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("company_id", "entry_number", name="uq_journal_entries_company_number"),
    )

    id: Mapped[uuid.UUID]          = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    entry_number: Mapped[str]      = mapped_column(String(50), nullable=False)
    entry_date: Mapped[datetime]   = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)

    reference_type: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    # 'invoice' | 'purchase_bill' | 'payment' | 'manual'

    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)

    total_debit: Mapped[Decimal]   = mapped_column(Numeric(15, 2), default=0)
    total_credit: Mapped[Decimal]  = mapped_column(Numeric(15, 2), default=0)
    is_posted: Mapped[bool]        = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"]                      = relationship(back_populates="journal_entries")
    lines: Mapped[List["JournalEntryLine"]]          = relationship(back_populates="journal_entry", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<JournalEntry {self.entry_number} dr={self.total_debit} cr={self.total_credit}>"


# ─────────────────────────────────────────────────────────────

class JournalEntryLine(Base):
    """
    Individual debit / credit line in a journal entry.
    Either debit OR credit is non-zero on each line (not both).
    """
    __tablename__ = "journal_entry_lines"

    id: Mapped[uuid.UUID]               = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journal_entry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)

    debit: Mapped[Decimal]              = mapped_column(Numeric(15, 2), default=0)
    credit: Mapped[Decimal]             = mapped_column(Numeric(15, 2), default=0)
    description: Mapped[Optional[str]]  = mapped_column(Text)

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines")
    account: Mapped["Account"]            = relationship(back_populates="journal_lines")

    def __repr__(self) -> str:
        return f"<JournalEntryLine account={self.account_id} dr={self.debit} cr={self.credit}>"


# =============================================================
# ALL MODELS — exported list for Alembic / FastAPI startup
# =============================================================
__all__ = [
    "Base",
    # Auth & Company
    "Company", "User", "Role", "Permission",
    "UserRole", "RolePermission", "AuditLog", "UserSession",
    # Inventory
    "ProductCategory", "Product", "StockEntry",
    # Purchase
    "Supplier", "PurchaseOrder", "PurchaseOrderItem",
    # Sales
    "Customer", "SalesOrder", "SalesOrderItem",
    # Finance
    "TaxRate", "Account", "Invoice", "PurchaseBill",
    "Payment", "JournalEntry", "JournalEntryLine",
]
# ─────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────

class FiscalYear(TimestampMixin, Base):
    """
    Institutional fiscal cycle definition.
    (e.g., FY 2024-25)
    """
    __tablename__ = "fiscal_years"
    __table_args__ = (
        UniqueConstraint("company_id", "label", name="uq_fiscal_years_label"),
    )

    id: Mapped[uuid.UUID]         = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    
    label: Mapped[str]            = mapped_column(String(50), nullable=False) # e.g. "FY 2024-25"
    start_date: Mapped[date]      = mapped_column(Date, nullable=False)
    end_date: Mapped[date]        = mapped_column(Date, nullable=False)
    is_active: Mapped[bool]       = mapped_column(Boolean, default=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    closing_notes: Mapped[Optional[str]] = mapped_column(Text)

    # ── relationships ──
    company: Mapped["Company"] = relationship(back_populates="fiscal_years", foreign_keys=[company_id])

    def __repr__(self) -> str:
        return f"<FiscalYear label={self.label!r} active={self.is_active}>"


class DocumentSequence(TimestampMixin, Base):
    """
    Custom document numbering sequences for a company.
    (e.g., INV-2024-001)
    """
    __tablename__ = "document_sequences"
    __table_args__ = (
        UniqueConstraint("company_id", "document_type", name="uq_document_sequences_type"),
    )

    id: Mapped[uuid.UUID]         = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    
    document_type: Mapped[str]    = mapped_column(String(50), nullable=False) # e.g. "invoice", "purchase_bill"
    prefix: Mapped[Optional[str]] = mapped_column(String(20))
    suffix: Mapped[Optional[str]] = mapped_column(String(20))
    next_value: Mapped[int]       = mapped_column(Integer, default=1)
    padding: Mapped[int]          = mapped_column(Integer, default=4)
    is_active: Mapped[bool]       = mapped_column(Boolean, default=True)

    # ── relationships ──
    company: Mapped["Company"] = relationship(back_populates="sequences")


# =============================================================
# MODULE 7 — SUPPORT & TICKETS
# =============================================================

class SupportTicket(TimestampMixin, Base):
    """
    Technical support tickets submitted by users.
    """
    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID]         = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    ticket_no: Mapped[str]        = mapped_column(String(50), unique=True, nullable=False) # e.g. #TKT-001
    node: Mapped[str]             = mapped_column(String(100), nullable=False) # e.g. "Billing", "Inventory"
    priority: Mapped[str]         = mapped_column(String(20), nullable=False) # P1, P2, P3
    description: Mapped[str]      = mapped_column(Text, nullable=False)
    status: Mapped[str]           = mapped_column(String(50), default="OPEN") # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    
    # ── relationships ──
    company: Mapped["Company"] = relationship(back_populates="support_tickets")
    user: Mapped["User"]       = relationship()


class CallbackRequest(TimestampMixin, Base):
    """
    Urgent voice protocol requests.
    """
    __tablename__ = "callback_requests"

    id: Mapped[uuid.UUID]         = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    phone: Mapped[str]            = mapped_column(String(20), nullable=False)
    status: Mapped[str]           = mapped_column(String(50), default="PENDING") # PENDING, CALLED, CANCELLED

    # ── relationships ──
    company: Mapped["Company"] = relationship(back_populates="callback_requests")
    user: Mapped["User"]       = relationship()

    def __repr__(self) -> str:
        return f"<DocumentSequence type={self.document_type!r} next={self.next_value}>"
