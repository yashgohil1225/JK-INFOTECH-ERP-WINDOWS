# =============================================================
# JK INFOTECH ERP — Companies Router
# File : app/routers/companies.py
# =============================================================

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.middleware.auth import get_current_company, get_current_user
from app.models import Company, User, FiscalYear, JournalEntry, JournalEntryLine, Account
from app.schemas.auth import CompanyResponse, CompanyUpdate, FiscalYearCreate, FiscalYearResponse, FiscalYearCloseRequest
from datetime import date, datetime, time, timedelta
from decimal import Decimal
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func

router = APIRouter(
    prefix="/api/v1/companies",
    tags=["Companies"],
)

# Separate router for HSN/SAC search to avoid /{id} wildcard conflict
utils_router = APIRouter(
    prefix="/api/v1/hsn",
    tags=["HSN / SAC"],
)

# =============================================================
# GET /api/companies/me
# =============================================================
@router.get("/me", response_model=CompanyResponse)
async def get_my_company_profile(
    company: Company = Depends(get_current_company),
):
    """Returns the profile of the currently active company."""
    return company

# =============================================================
# PUT /api/companies/me
# =============================================================
@router.put("/me", response_model=CompanyResponse)
async def update_my_company_profile(
    data: CompanyUpdate,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Updates the profile of the currently active company."""
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)
    
    if "settings" in update_data:
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(company, "settings")

    await db.commit()
    await db.refresh(company)
    return company

# =============================================================
# POST /api/companies
# =============================================================
from app.schemas.auth import CompanyCreate
from app.services.seed_accounts import seed_default_accounts_for_company
from app.services.seed_sequences import seed_default_sequences_for_company

# =============================================================
# GET /api/v1/hsn/search  (on utils_router — avoids /{id} conflict)
# =============================================================
import json
from pathlib import Path

_hsn_codes = None
_sac_codes = None

def _load_hsn_sac_codes():
    global _hsn_codes, _sac_codes
    if _hsn_codes is None:
        data_dir = Path(__file__).parent.parent / "data"
        hsn_path = data_dir / "hsn_codes.json"
        sac_path = data_dir / "sac_codes.json"
        
        if hsn_path.exists():
            with open(hsn_path, "r", encoding="utf-8") as f:
                _hsn_codes = json.load(f)
        else:
            _hsn_codes = []
            
        if sac_path.exists():
            with open(sac_path, "r", encoding="utf-8") as f:
                _sac_codes = json.load(f)
        else:
            _sac_codes = []

@utils_router.get("/search")
async def search_hsn_sac(q: str = ""):
    """Search all official Indian HSN and SAC codes."""
    _load_hsn_sac_codes()
    query = q.strip().lower()
    results = []
    
    # 1. Search HSN codes
    for item in (_hsn_codes or []):
        code = str(item.get("code") or "")
        desc = str(item.get("description") or "")
        if not query or query in code or query in desc.lower():
            rate = 18.0
            if "5%" in desc or " 5 " in desc:
                rate = 5.0
            elif "12%" in desc or " 12 " in desc:
                rate = 12.0
            elif "18%" in desc or " 18 " in desc:
                rate = 18.0
            elif "28%" in desc or " 28 " in desc:
                rate = 28.0
            elif "0%" in desc or " 0 " in desc or "exempt" in desc.lower() or "nil" in desc.lower():
                rate = 0.0
            elif "3%" in desc or " 3 " in desc:
                rate = 3.0
                
            results.append({
                "code": code,
                "name": f"{code} - {desc[:80]} ({int(rate)}%)",
                "rate": rate,
                "type": "HSN"
            })
            if len(results) >= 50:
                break
                
    # 2. Search SAC codes if limit not reached
    if len(results) < 50:
        for item in (_sac_codes or []):
            code = str(item.get("code") or "")
            desc = str(item.get("description") or "")
            if not query or query in code or query in desc.lower():
                rate = 18.0
                if "5%" in desc or " 5 " in desc:
                    rate = 5.0
                elif "12%" in desc or " 12 " in desc:
                    rate = 12.0
                elif "18%" in desc or " 18 " in desc:
                    rate = 18.0
                elif "28%" in desc or " 28 " in desc:
                    rate = 28.0
                elif "0%" in desc or " 0 " in desc or "exempt" in desc.lower() or "nil" in desc.lower():
                    rate = 0.0
                elif "3%" in desc or " 3 " in desc:
                    rate = 3.0
                    
                results.append({
                    "code": code,
                    "name": f"{code} - {desc[:80]} ({int(rate)}%)",
                    "rate": rate,
                    "type": "SAC"
                })
                if len(results) >= 50:
                    break
                    
    return results


# =============================================================
# GET /api/companies/{id}/export  — full JSON backup of one company
# =============================================================
@router.get("/{id}/export")
async def export_company_data(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Exports all data belonging to a company as a downloadable JSON file.
    Includes: company profile, users, customers, suppliers, products,
    invoices, purchase bills, payments, banking accounts, journal entries,
    fiscal years, and sequences.
    """
    import uuid as _uuid
    import json
    from fastapi.responses import Response
    from datetime import datetime, date
    from decimal import Decimal

    try:
        company_uuid = _uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid company ID format")

    # Auth: must be admin of this company OR superadmin
    admin_check = await db.execute(
        select(User).where(
            (User.email == current_user.email) | (User.phone == current_user.phone),
            User.company_id == company_uuid
        )
    )
    if not current_user.is_superadmin and not admin_check.scalars().first():
        raise HTTPException(status_code=403, detail="Access denied.")

    # Load company
    co_res = await db.execute(select(Company).where(Company.id == company_uuid))
    company = co_res.scalars().first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    def serialize(obj):
        """Recursively serialize SQLAlchemy model instance to dict."""
        if obj is None:
            return None
        if isinstance(obj, list):
            return [serialize(o) for o in obj]
        if hasattr(obj, "__table__"):
            result = {}
            for col in obj.__table__.columns:
                val = getattr(obj, col.name, None)
                if isinstance(val, (_uuid.UUID,)):
                    val = str(val)
                elif isinstance(val, (datetime, date)):
                    val = val.isoformat()
                elif isinstance(val, Decimal):
                    val = float(val)
                result[col.name] = val
            return result
        return obj

    # Import all models needed
    from app.models import (
        Customer, Supplier, Product, ProductCategory,
        Invoice, InvoiceItem, PurchaseBill, PurchaseBillItem,
        Payment, Account, JournalEntry, JournalEntryLine,
        FiscalYear, DocumentSequence, SalesOrder, SalesOrderItem,
        PurchaseOrder, PurchaseOrderItem, CreditNote, CreditNoteItem,
        DebitNote, DebitNoteItem, TaxRate, Batch, StockEntry, AuditLog,
    )

    async def fetch_all(model, *filters):
        res = await db.execute(select(model).where(*filters))
        return res.scalars().all()

    cid = company_uuid

    # Fetch all related data
    users_data         = await fetch_all(User, User.company_id == cid)
    customers_data     = await fetch_all(Customer, Customer.company_id == cid)
    suppliers_data     = await fetch_all(Supplier, Supplier.company_id == cid)
    categories_data    = await fetch_all(ProductCategory, ProductCategory.company_id == cid)
    products_data      = await fetch_all(Product, Product.company_id == cid)
    tax_rates_data     = await fetch_all(TaxRate, TaxRate.company_id == cid)
    accounts_data      = await fetch_all(Account, Account.company_id == cid)
    fiscal_years_data  = await fetch_all(FiscalYear, FiscalYear.company_id == cid)
    sequences_data     = await fetch_all(DocumentSequence, DocumentSequence.company_id == cid)
    invoices_data      = await fetch_all(Invoice, Invoice.company_id == cid)
    invoice_ids        = [i.id for i in invoices_data]
    invoice_items_data = await fetch_all(InvoiceItem, InvoiceItem.invoice_id.in_(invoice_ids)) if invoice_ids else []
    purchase_bills_data     = await fetch_all(PurchaseBill, PurchaseBill.company_id == cid)
    pb_ids                  = [b.id for b in purchase_bills_data]
    purchase_bill_items_data = await fetch_all(PurchaseBillItem, PurchaseBillItem.bill_id.in_(pb_ids)) if pb_ids else []
    payments_data       = await fetch_all(Payment, Payment.company_id == cid)
    sales_orders_data   = await fetch_all(SalesOrder, SalesOrder.company_id == cid)
    so_ids              = [s.id for s in sales_orders_data]
    so_items_data       = await fetch_all(SalesOrderItem, SalesOrderItem.order_id.in_(so_ids)) if so_ids else []
    purchase_orders_data = await fetch_all(PurchaseOrder, PurchaseOrder.company_id == cid)
    po_ids               = [p.id for p in purchase_orders_data]
    po_items_data        = await fetch_all(PurchaseOrderItem, PurchaseOrderItem.order_id.in_(po_ids)) if po_ids else []
    credit_notes_data   = await fetch_all(CreditNote, CreditNote.company_id == cid)
    cn_ids              = [c.id for c in credit_notes_data]
    cn_items_data       = await fetch_all(CreditNoteItem, CreditNoteItem.credit_note_id.in_(cn_ids)) if cn_ids else []
    debit_notes_data    = await fetch_all(DebitNote, DebitNote.company_id == cid)
    dn_ids              = [d.id for d in debit_notes_data]
    dn_items_data       = await fetch_all(DebitNoteItem, DebitNoteItem.debit_note_id.in_(dn_ids)) if dn_ids else []
    journal_entries_data = await fetch_all(JournalEntry, JournalEntry.company_id == cid)
    je_ids               = [j.id for j in journal_entries_data]
    je_lines_data        = await fetch_all(JournalEntryLine, JournalEntryLine.entry_id.in_(je_ids)) if je_ids else []
    batches_data         = []
    stock_entries_data   = []
    for product in products_data:
        b = await fetch_all(Batch, Batch.product_id == product.id)
        batches_data.extend(b)
        for batch in b:
            s = await fetch_all(StockEntry, StockEntry.batch_id == batch.id)
            stock_entries_data.extend(s)
    audit_logs_data = await fetch_all(AuditLog, AuditLog.company_id == cid)

    backup_payload = {
        "backup_metadata": {
            "app": "JK Infotech ERP",
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "company_id": str(cid),
            "company_name": company.name,
        },
        "company": serialize(company),
        "users": serialize(users_data),
        "customers": serialize(customers_data),
        "suppliers": serialize(suppliers_data),
        "product_categories": serialize(categories_data),
        "products": serialize(products_data),
        "batches": serialize(batches_data),
        "stock_entries": serialize(stock_entries_data),
        "tax_rates": serialize(tax_rates_data),
        "accounts": serialize(accounts_data),
        "fiscal_years": serialize(fiscal_years_data),
        "document_sequences": serialize(sequences_data),
        "invoices": serialize(invoices_data),
        "invoice_items": serialize(invoice_items_data),
        "purchase_bills": serialize(purchase_bills_data),
        "purchase_bill_items": serialize(purchase_bill_items_data),
        "payments": serialize(payments_data),
        "sales_orders": serialize(sales_orders_data),
        "sales_order_items": serialize(so_items_data),
        "purchase_orders": serialize(purchase_orders_data),
        "purchase_order_items": serialize(po_items_data),
        "credit_notes": serialize(credit_notes_data),
        "credit_note_items": serialize(cn_items_data),
        "debit_notes": serialize(debit_notes_data),
        "debit_note_items": serialize(dn_items_data),
        "journal_entries": serialize(journal_entries_data),
        "journal_entry_lines": serialize(je_lines_data),
        "audit_logs": serialize(audit_logs_data),
    }

    json_bytes = json.dumps(backup_payload, ensure_ascii=False, indent=2).encode("utf-8")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in company.name)[:40]
    filename = f"JK_ERP_Backup_{safe_name}_{timestamp}.json"

    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =============================================================
# DELETE /api/companies/{id}/purge  — permanent hard-delete
# =============================================================
@router.delete("/{id}/purge", status_code=status.HTTP_204_NO_CONTENT)
async def purge_company(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    PERMANENTLY deletes a company and ALL its data from the database.
    This action is IRREVERSIBLE. Always export a backup first.
    Only the company admin or superadmin can perform this action.
    """
    import uuid as _uuid
    from sqlalchemy import delete as sql_delete
    from app.models import (
        Customer, Supplier, Product, ProductCategory,
        Invoice, InvoiceItem, PurchaseBill, PurchaseBillItem,
        Payment, Account, JournalEntry, JournalEntryLine,
        FiscalYear, DocumentSequence, SalesOrder, SalesOrderItem,
        PurchaseOrder, PurchaseOrderItem, CreditNote, CreditNoteItem,
        DebitNote, DebitNoteItem, TaxRate, Batch, StockEntry, AuditLog,
        Role, UserRole, RolePermission,
    )

    try:
        company_uuid = _uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid company ID format")

    # Authorization check
    admin_check = await db.execute(
        select(User).where(
            (User.email == current_user.email) | (User.phone == current_user.phone),
            User.company_id == company_uuid
        )
    )
    if not current_user.is_superadmin and not admin_check.scalars().first():
        raise HTTPException(status_code=403, detail="You must be an authorized admin of this company to permanently delete it.")

    co_res = await db.execute(select(Company).where(Company.id == company_uuid))
    company = co_res.scalars().first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # ── Delete in dependency order (children first) ──────────────

    # Journal entry lines → Journal entries
    je_res = await db.execute(select(JournalEntry.id).where(JournalEntry.company_id == company_uuid))
    je_ids = [r[0] for r in je_res.fetchall()]
    if je_ids:
        await db.execute(sql_delete(JournalEntryLine).where(JournalEntryLine.entry_id.in_(je_ids)))
    await db.execute(sql_delete(JournalEntry).where(JournalEntry.company_id == company_uuid))

    # Invoice items → Invoices
    inv_res = await db.execute(select(Invoice.id).where(Invoice.company_id == company_uuid))
    inv_ids = [r[0] for r in inv_res.fetchall()]
    if inv_ids:
        await db.execute(sql_delete(InvoiceItem).where(InvoiceItem.invoice_id.in_(inv_ids)))
    await db.execute(sql_delete(Invoice).where(Invoice.company_id == company_uuid))

    # Purchase bill items → Bills
    pb_res = await db.execute(select(PurchaseBill.id).where(PurchaseBill.company_id == company_uuid))
    pb_ids = [r[0] for r in pb_res.fetchall()]
    if pb_ids:
        await db.execute(sql_delete(PurchaseBillItem).where(PurchaseBillItem.bill_id.in_(pb_ids)))
    await db.execute(sql_delete(PurchaseBill).where(PurchaseBill.company_id == company_uuid))

    # Credit note items → Credit notes
    cn_res = await db.execute(select(CreditNote.id).where(CreditNote.company_id == company_uuid))
    cn_ids = [r[0] for r in cn_res.fetchall()]
    if cn_ids:
        await db.execute(sql_delete(CreditNoteItem).where(CreditNoteItem.credit_note_id.in_(cn_ids)))
    await db.execute(sql_delete(CreditNote).where(CreditNote.company_id == company_uuid))

    # Debit note items → Debit notes
    dn_res = await db.execute(select(DebitNote.id).where(DebitNote.company_id == company_uuid))
    dn_ids = [r[0] for r in dn_res.fetchall()]
    if dn_ids:
        await db.execute(sql_delete(DebitNoteItem).where(DebitNoteItem.debit_note_id.in_(dn_ids)))
    await db.execute(sql_delete(DebitNote).where(DebitNote.company_id == company_uuid))

    # Payments
    await db.execute(sql_delete(Payment).where(Payment.company_id == company_uuid))

    # Sales order items → Sales orders
    so_res = await db.execute(select(SalesOrder.id).where(SalesOrder.company_id == company_uuid))
    so_ids = [r[0] for r in so_res.fetchall()]
    if so_ids:
        await db.execute(sql_delete(SalesOrderItem).where(SalesOrderItem.order_id.in_(so_ids)))
    await db.execute(sql_delete(SalesOrder).where(SalesOrder.company_id == company_uuid))

    # Purchase order items → Purchase orders
    po_res = await db.execute(select(PurchaseOrder.id).where(PurchaseOrder.company_id == company_uuid))
    po_ids = [r[0] for r in po_res.fetchall()]
    if po_ids:
        await db.execute(sql_delete(PurchaseOrderItem).where(PurchaseOrderItem.order_id.in_(po_ids)))
    await db.execute(sql_delete(PurchaseOrder).where(PurchaseOrder.company_id == company_uuid))

    # Accounts
    await db.execute(sql_delete(Account).where(Account.company_id == company_uuid))

    # Stock entries → Batches → Products → Categories
    prod_res = await db.execute(select(Product.id).where(Product.company_id == company_uuid))
    prod_ids = [r[0] for r in prod_res.fetchall()]
    if prod_ids:
        batch_res = await db.execute(select(Batch.id).where(Batch.product_id.in_(prod_ids)))
        batch_ids = [r[0] for r in batch_res.fetchall()]
        if batch_ids:
            await db.execute(sql_delete(StockEntry).where(StockEntry.batch_id.in_(batch_ids)))
        await db.execute(sql_delete(Batch).where(Batch.product_id.in_(prod_ids)))
    await db.execute(sql_delete(Product).where(Product.company_id == company_uuid))
    await db.execute(sql_delete(ProductCategory).where(ProductCategory.company_id == company_uuid))

    # Customers, Suppliers, TaxRates
    await db.execute(sql_delete(Customer).where(Customer.company_id == company_uuid))
    await db.execute(sql_delete(Supplier).where(Supplier.company_id == company_uuid))
    await db.execute(sql_delete(TaxRate).where(TaxRate.company_id == company_uuid))

    # Audit logs
    await db.execute(sql_delete(AuditLog).where(AuditLog.company_id == company_uuid))

    # Document sequences (cascade handled by relationship)
    await db.execute(sql_delete(DocumentSequence).where(DocumentSequence.company_id == company_uuid))

    # Fiscal years — unset company.current_fy_id first to avoid FK conflict
    company.current_fy_id = None
    await db.flush()
    await db.execute(sql_delete(FiscalYear).where(FiscalYear.company_id == company_uuid))

    # Support tickets & callback requests
    from app.models import SupportTicket, CallbackRequest, UserSession
    await db.execute(sql_delete(SupportTicket).where(SupportTicket.company_id == company_uuid))
    await db.execute(sql_delete(CallbackRequest).where(CallbackRequest.company_id == company_uuid))

    # User roles & User sessions → Users
    user_res = await db.execute(select(User.id).where(User.company_id == company_uuid))
    user_ids = [r[0] for r in user_res.fetchall()]
    if user_ids:
        await db.execute(sql_delete(UserSession).where(UserSession.user_id.in_(user_ids)))
        await db.execute(sql_delete(UserRole).where(UserRole.user_id.in_(user_ids)))

    # Roles → Role Permissions
    role_res = await db.execute(select(Role.id).where(Role.company_id == company_uuid))
    role_ids = [r[0] for r in role_res.fetchall()]
    if role_ids:
        await db.execute(sql_delete(RolePermission).where(RolePermission.role_id.in_(role_ids)))
    await db.execute(sql_delete(Role).where(Role.company_id == company_uuid))

    # Users
    await db.execute(sql_delete(User).where(User.company_id == company_uuid))

    # Finally: delete the company record itself
    await db.delete(company)
    await db.commit()

    # Clear all caches
    from app.core.redis import cache_manager
    for prefix in ["analytics", "customers", "suppliers", "invoices", "products", "banking", "company", "purchases"]:
        await cache_manager.invalidate_prefix(prefix)

    return None


# =============================================================
# DELETE /api/companies/{id}  — soft deactivate (legacy)
# =============================================================
@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_company(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivates a company (soft delete — marks is_active=False)."""
    import uuid as _uuid
    try:
        company_uuid = _uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid company ID format")

    admin_check = await db.execute(
        select(User).where(
            (User.email == current_user.email) | (User.phone == current_user.phone),
            User.company_id == company_uuid
        )
    )
    if not current_user.is_superadmin and not admin_check.scalars().first():
        raise HTTPException(status_code=403, detail="You must be an authorized admin of this company to deactivate it.")

    result = await db.execute(select(Company).where(Company.id == company_uuid))
    company = result.scalars().first()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company.is_active = False

    # If current user was attached to this deactivated company, update user pointer to an active company
    fallback_stmt = (
        select(Company)
        .where(
            Company.id != company_uuid,
            Company.is_active == True
        )
        .order_by(Company.created_at.desc())
    )
    active_co_res = await db.execute(fallback_stmt)
    active_co = active_co_res.scalars().first()
    if active_co:
        current_user.company_id = active_co.id

    await db.commit()
    from app.core.redis import cache_manager
    await cache_manager.invalidate_prefix("analytics")
    await cache_manager.invalidate_prefix("customers")
    await cache_manager.invalidate_prefix("suppliers")
    await cache_manager.invalidate_prefix("invoices")
    await cache_manager.invalidate_prefix("products")
    await cache_manager.invalidate_prefix("banking")
    await cache_manager.invalidate_prefix("company")
    return None




@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    data: CompanyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new company and links the current user to it."""
    # 1. Create the new Company
    company_data = data.model_dump(exclude_unset=True)
    company = Company(
        is_active=True,
        **company_data
    )
    db.add(company)
    await db.flush() # Get company.id

    # 2. Create the Admin User link (clone the current user's credentials)
    new_user_link = User(
        company_id=company.id,
        full_name=current_user.full_name,
        email=current_user.email,
        password_hash=current_user.password_hash,
        pin_hash=current_user.pin_hash,
        phone=current_user.phone,
        is_active=True,
        is_superadmin=True,
    )
    db.add(new_user_link)
    await db.flush()

    # 3. Seed default accounts & sequences
    await seed_default_accounts_for_company(db, company.id, new_user_link.id)
    await seed_default_sequences_for_company(db, company.id)

    await db.commit()
    await db.refresh(company)
    return company

# GET /api/companies/fiscal-years
# =============================================================
@router.get("/fiscal-years", response_model=List[FiscalYearResponse])
async def get_fiscal_years(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Returns the list of fiscal years for the company."""
    result = await db.execute(
        select(FiscalYear).where(FiscalYear.company_id == company.id).order_by(FiscalYear.start_date.desc())
    )
    return result.scalars().all()


# =============================================================
# GET /api/companies/verify-gst
# =============================================================
import asyncio

@router.get("/verify-gst")
async def verify_gst_mock(gstin: str, current_user: User = Depends(get_current_user)):
    if not gstin:
        raise HTTPException(status_code=400, detail="GSTIN is required.")
    import re
    # Validate 15-digit GSTIN pattern
    if not re.fullmatch(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", gstin.upper()):
        raise HTTPException(status_code=400, detail="Invalid GST format")
    return {"is_valid": True, "gstin": gstin.upper()}


# =============================================================
# POST /api/companies/fiscal-years
# =============================================================
@router.post("/fiscal-years", response_model=FiscalYearResponse)
async def create_fiscal_year(
    data: FiscalYearCreate,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new fiscal year for the company after verifying active FY lifecycle rules."""
    # 1. Check if there is an active running (unclosed) FY
    active_fy_res = await db.execute(
        select(FiscalYear).where(
            FiscalYear.company_id == company.id,
            FiscalYear.closed_at.is_(None)
        )
    )
    active_fy = active_fy_res.scalars().first()
    if active_fy:
        raise HTTPException(
            status_code=400,
            detail=f"Financial Year '{active_fy.label}' ({active_fy.start_date.strftime('%d/%m/%Y')} to {active_fy.end_date.strftime('%d/%m/%Y')}) is currently active. You can only create a new Financial Year after the current active year ends and is closed."
        )

    # 2. Verify start date strictly follows previous closed FY end date
    last_closed_res = await db.execute(
        select(FiscalYear).where(
            FiscalYear.company_id == company.id,
            FiscalYear.closed_at.isnot(None)
        ).order_by(FiscalYear.end_date.desc())
    )
    last_closed = last_closed_res.scalars().first()
    if last_closed:
        expected_start = last_closed.end_date + timedelta(days=1)
        if data.start_date != expected_start:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid Start Date. The next Financial Year must start on {expected_start.strftime('%d/%m/%Y')} (immediately following closed FY '{last_closed.label}')."
            )

    fy = FiscalYear(
        company_id=company.id,
        label=data.label,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=data.is_active
    )
    db.add(fy)
    await db.flush()  # Generate the ID for fy
    if data.is_active:
        company.current_fy_id = fy.id
    await db.commit()
    await db.refresh(fy)
    return fy

# =============================================================
# POST /api/companies/fiscal-years/{fy_id}/set-current
# =============================================================
@router.post("/fiscal-years/{fy_id}/set-current")
async def set_current_fiscal_year(
    fy_id: str,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Sets the specified fiscal year as the active one for the company."""
    import uuid
    try:
        fy_uuid = uuid.UUID(fy_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Fiscal Year ID format")

    # Verify the fiscal year belongs to the company
    result = await db.execute(
        select(FiscalYear).where(FiscalYear.id == fy_uuid, FiscalYear.company_id == company.id)
    )
    fy = result.scalars().first()
    if not fy:
        raise HTTPException(status_code=404, detail="Fiscal Year not found or access denied")

    # Update company
    company.current_fy_id = fy.id

    await db.commit()
    return {"message": f"Fiscal Year '{fy.label}' set as current", "success": True}


# =============================================================
# POST /api/companies/fiscal-years/{fy_id}/close
# =============================================================
@router.post("/fiscal-years/{fy_id}/close")
async def close_fiscal_year(
    fy_id: str,
    body: FiscalYearCloseRequest,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Closes the specified fiscal year, posts a Closing Journal Entry to retained earnings, and locks the period."""
    import uuid
    try:
        fy_uuid = uuid.UUID(fy_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Fiscal Year ID format")

    # 1. Fetch fiscal year
    result = await db.execute(
        select(FiscalYear).where(FiscalYear.id == fy_uuid, FiscalYear.company_id == company.id)
    )
    fy = result.scalars().first()
    if not fy:
        raise HTTPException(status_code=404, detail="Fiscal Year not found or access denied")

    if not fy.is_active:
        raise HTTPException(status_code=400, detail="This fiscal year is already closed")

    # Check if FY end_date has been reached
    today_date = date.today()
    if today_date <= fy.end_date:
        formatted_end = fy.end_date.strftime('%d/%m/%Y')
        raise HTTPException(
            status_code=400,
            detail=f"Financial Year '{fy.label}' (ending on {formatted_end}) cannot be closed prior to period end. Year closing is allowed only after {formatted_end}."
        )

    # 2. Query all Income and Expense accounts and calculate their net balance inside this FY period
    start_dt = datetime.combine(fy.start_date, time.min)
    end_dt = datetime.combine(fy.end_date, time.max)

    # Sum lines for income/expenses in this period
    lines_stmt = select(
        Account.id.label("account_id"),
        Account.name.label("name"),
        Account.account_type.label("account_type"),
        Account.account_code.label("account_code"),
        func.sum(JournalEntryLine.debit).label("total_debit"),
        func.sum(JournalEntryLine.credit).label("total_credit")
    ).select_from(JournalEntryLine).join(JournalEntry).join(Account).where(
        JournalEntry.company_id == company.id,
        JournalEntry.entry_date >= start_dt,
        JournalEntry.entry_date <= end_dt,
        Account.account_type.in_(["INCOME", "EXPENSE"])
    ).group_by(Account.id)

    res = await db.execute(lines_stmt)
    records = res.all()

    closing_lines = []
    total_revenue = Decimal("0.00")
    total_expense = Decimal("0.00")

    for row in records:
        debit = row.total_debit or Decimal("0.00")
        credit = row.total_credit or Decimal("0.00")

        # Expense net balance is debit - credit. Income is credit - debit.
        if row.account_type == "EXPENSE":
            net = debit - credit
            if net != 0:
                total_expense += net
                # To clear expense, credit it
                closing_lines.append(
                    JournalEntryLine(
                        account_id=row.account_id,
                        debit=Decimal("0.00"),
                        credit=net,
                        description=f"Zeroing out {row.name} for year-end close of {fy.label}"
                    )
                )
        elif row.account_type == "INCOME":
            net = credit - debit
            if net != 0:
                total_revenue += net
                # To clear income, debit it
                closing_lines.append(
                    JournalEntryLine(
                        account_id=row.account_id,
                        debit=net,
                        credit=Decimal("0.00"),
                        description=f"Zeroing out {row.name} for year-end close of {fy.label}"
                    )
                )

    net_profit = total_revenue - total_expense

    # Find Retained Earnings or Owner's Equity account
    re_stmt = select(Account).where(
        Account.company_id == company.id,
        Account.account_code == "3002"
    )
    re_res = await db.execute(re_stmt)
    re_account = re_res.scalars().first()

    if not re_account:
        re_stmt = select(Account).where(
            Account.company_id == company.id,
            Account.name.ilike("%Retained Earnings%")
        )
        re_res = await db.execute(re_stmt)
        re_account = re_res.scalars().first()

    if not re_account:
        re_stmt = select(Account).where(
            Account.company_id == company.id,
            Account.account_type == "EQUITY"
        )
        re_res = await db.execute(re_stmt)
        re_account = re_res.scalars().first()

    if not re_account:
        raise HTTPException(
            status_code=400,
            detail="Retained Earnings or Equity account not found. Please setup Chart of Accounts before closing."
        )

    # Add Retained Earnings closing entry line
    if net_profit > 0:
        closing_lines.append(
            JournalEntryLine(
                account_id=re_account.id,
                debit=Decimal("0.00"),
                credit=net_profit,
                description=f"Transfer net profit to Retained Earnings for {fy.label}"
            )
        )
    elif net_profit < 0:
        closing_lines.append(
            JournalEntryLine(
                account_id=re_account.id,
                debit=abs(net_profit),
                credit=Decimal("0.00"),
                description=f"Transfer net loss to Retained Earnings for {fy.label}"
            )
        )

    # Post the Closing Journal Entry
    if closing_lines:
        total_dr = sum(line.debit for line in closing_lines)
        total_cr = sum(line.credit for line in closing_lines)

        if total_dr != total_cr:
            raise HTTPException(status_code=500, detail=f"Closing entry is not balanced (Dr: {total_dr}, Cr: {total_cr})")

        je = JournalEntry(
            company_id=company.id,
            entry_number=f"CLOSE/{fy.label}",
            entry_date=end_dt,
            description=f"Year-end closing journal entry for {fy.label}",
            reference_type="manual",
            total_debit=total_dr,
            total_credit=total_cr,
            is_posted=True,
            lines=closing_lines
        )
        db.add(je)

    # 3. Mark fiscal year as closed
    fy.is_active = False
    fy.closed_at = func.now()
    fy.closing_notes = body.closing_notes

    # 4. Roll over and reset all Document Sequences to 0001 under the new prefix
    from app.models import DocumentSequence
    import re
    seq_stmt = select(DocumentSequence).where(DocumentSequence.company_id == company.id)
    seq_res = await db.execute(seq_stmt)
    sequences = seq_res.scalars().all()

    next_start_yr = (fy.end_date.year) % 100
    next_end_yr = (fy.end_date.year + 1) % 100
    new_yr_pattern = f"{next_start_yr:02d}-{next_end_yr:02d}"

    for seq in sequences:
        if seq.prefix:
            # Match YY-YY or YY/YY patterns (e.g. 23-24 or 23/24)
            match = re.search(r"(\d{2})([\-\/])(\d{2})", seq.prefix)
            if match:
                sep = match.group(2)
                seq.prefix = seq.prefix.replace(match.group(0), f"{next_start_yr:02d}{sep}{next_end_yr:02d}")
            else:
                # Append year range if prefix doesn't contain a year range
                if seq.prefix.endswith("/"):
                    seq.prefix = f"{seq.prefix}{new_yr_pattern}/"
                else:
                    seq.prefix = f"{seq.prefix}/{new_yr_pattern}/"
        else:
            # Fallback patterns
            if seq.document_type == "Sales Invoice":
                seq.prefix = f"INV/{new_yr_pattern}/"
            elif seq.document_type == "Purchase Bill":
                seq.prefix = f"PB/{new_yr_pattern}/"
            else:
                seq.prefix = f"{seq.document_type[:3].upper()}/{new_yr_pattern}/"

        seq.next_value = 1
        db.add(seq)

    await db.commit()
    return {"message": f"Fiscal Year '{fy.label}' closed successfully", "success": True}



