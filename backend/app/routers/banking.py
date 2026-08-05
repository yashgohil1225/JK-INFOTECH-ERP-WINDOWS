from typing import List, Optional
from uuid import UUID
from decimal import Decimal
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func, delete
from datetime import datetime

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import Account, Payment, PurchaseBill, Invoice, User, Company, JournalEntry, JournalEntryLine
from app.schemas.banking import (
    Account as AccountSchema, AccountCreate,
    Payment as PaymentSchema, PaymentCreate,
    CapitalTransferCreate
)

router = APIRouter(prefix="/api/v1/banking", tags=["Banking"])

# --- Helper to calculate dynamic running balances ---
async def compute_dynamic_balances(db: AsyncSession, company_id: UUID, accounts: List[Account]):
    payments_result = await db.execute(
        select(Payment)
        .where(Payment.company_id == company_id)
    )
    payments = payments_result.scalars().all()

    for acc in accounts:
        # Standardize account_type/subtype for frontend compatibility
        if acc.account_subtype and acc.account_subtype.upper() in ["BANK", "CASH"]:
            acc.account_type = acc.account_subtype.upper()
        elif acc.name == "Cash In Hand":
            acc.account_type = "CASH"
            acc.account_subtype = "Cash"
        elif acc.name == "Main Bank Account":
            acc.account_type = "BANK"
            acc.account_subtype = "Bank"

        # Start with the database opening balance
        current_balance = Decimal(str(acc.opening_balance))
        
        # Calculate balance adjustment from invoice/bill payments
        for p in payments:
            if p.reference_type == "journal_entry" or p.is_reconciled:
                continue
                
            is_match = False
            acc_name_lower = acc.name.lower().strip()
            
            if acc.account_type == "CASH" or acc.name == "Cash In Hand":
                if p.payment_method.upper() == "CASH":
                    is_match = True
            else:
                if p.bank_account and p.bank_account.lower().strip() == acc_name_lower:
                    is_match = True
                elif (not p.bank_account or p.bank_account == "None") and p.payment_method.upper() != "CASH" and acc.name == "AXIS BANK LTD":
                    is_match = True
            
            if is_match:
                if p.payment_type == "RECEIPT":
                    current_balance += p.amount
                elif p.payment_type == "PAYMENT":
                    current_balance -= p.amount
                    
        acc.opening_balance = current_balance
    return accounts

from app.core.redis import cache_manager

# --- Accounts ---
@router.get("/accounts", response_model=List[AccountSchema])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"banking_accounts:{company.id}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        select(Account)
        .where(
            Account.company_id == company.id,
            (
                Account.account_subtype.in_(["Bank", "Cash", "BANK", "CASH"]) |
                Account.account_type.in_(["BANK", "CASH"]) |
                Account.name.in_(["Cash In Hand", "Main Bank Account"])
            )
        )
    )
    accounts = result.scalars().all()
    await compute_dynamic_balances(db, company.id, accounts)
    out = [AccountSchema.model_validate(acc).model_dump() for acc in accounts]
    await cache_manager.set(cache_key, out, ttl_seconds=60)
    return out

@router.post("/accounts", response_model=AccountSchema)
async def create_account(
    account_in: AccountCreate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    account_data = account_in.model_dump()
    if not account_data.get("account_subtype") and account_data.get("account_type") in ["BANK", "CASH"]:
        account_data["account_subtype"] = account_in.account_type.title()
    new_account = Account(**account_data, company_id=company.id)
    db.add(new_account)
    await db.commit()
    await db.refresh(new_account)

    await cache_manager.invalidate_prefix(f"banking_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    await cache_manager.invalidate_prefix(f"company:{company.id}:report")
    return new_account

@router.get("/accounts/all", response_model=List[AccountSchema])
async def list_all_accounts(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    """Fetch all accounts in the chart of accounts for selection."""
    cache_key = f"all_accounts:{company.id}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        select(Account)
        .where(Account.company_id == company.id)
        .order_by(Account.account_type, Account.name)
    )
    accounts = result.scalars().all()
    await compute_dynamic_balances(db, company.id, accounts)
    out = [AccountSchema.model_validate(acc).model_dump() for acc in accounts]
    await cache_manager.set(cache_key, out, ttl_seconds=60)
    return out

# --- Payments ---
@router.get("/payments", response_model=List[PaymentSchema])
async def list_payments(
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    stmt = select(Payment).where(Payment.company_id == company.id)
    if reference_type:
        stmt = stmt.where(Payment.reference_type == reference_type)
    if reference_id:
        stmt = stmt.where(Payment.reference_id == reference_id)
    
    result = await db.execute(stmt.order_by(Payment.payment_date.desc()))
    return result.scalars().all()

@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    payment_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    payment = await db.get(Payment, payment_id)
    if not payment or payment.company_id != company.id:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    from app.core.fy_validator import validate_transaction_date
    await validate_transaction_date(db, company.id, payment.payment_date)

    # Revert invoice or bill amounts
    if payment.reference_type == "invoice" and payment.reference_id:
        invoice = await db.get(Invoice, payment.reference_id)
        if invoice:
            invoice.amount_paid = max(Decimal("0.0"), invoice.amount_paid - (payment.amount + payment.tds_amount))
            invoice.balance_due = invoice.total - invoice.amount_paid
            if invoice.balance_due <= 0:
                invoice.status = "PAID"
            elif invoice.amount_paid > 0:
                invoice.status = "PARTIAL"
            else:
                invoice.status = "UNPAID"

    elif payment.reference_type == "purchase_bill" and payment.reference_id:
        bill = await db.get(PurchaseBill, payment.reference_id)
        if bill:
            bill.amount_paid = max(Decimal("0.0"), bill.amount_paid - (payment.amount + payment.tds_amount))
            bill.balance_due = bill.total - bill.amount_paid
            if bill.balance_due <= 0:
                bill.status = "PAID"
            elif bill.amount_paid > 0:
                bill.status = "PARTIAL"
            else:
                bill.status = "UNPAID"

    await db.delete(payment)
    await db.commit()

    await cache_manager.invalidate_prefix(f"banking_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"all_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    await cache_manager.invalidate_prefix(f"company:{company.id}:report")
    await cache_manager.invalidate_prefix(f"customers:{company.id}")
    await cache_manager.invalidate_prefix(f"suppliers:{company.id}")


@router.post("/payments", response_model=PaymentSchema)
async def create_payment(
    payment_in: PaymentCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    from app.core.fy_validator import validate_transaction_date
    await validate_transaction_date(db, company.id, payment_in.payment_date)

    # Industrial Logic: Handle automatic linkage to Purchase Bills or Invoices
    payment_data = payment_in.model_dump()
    
    if payment_in.reference_type == "purchase_bill" and payment_in.reference_id:
        bill = await db.get(PurchaseBill, payment_in.reference_id)
        if not bill:
            raise HTTPException(status_code=404, detail="Target purchase bill not found.")
        
        payment_data["payment_type"] = "PAYMENT"
        payment_data["party_type"] = "supplier"
        payment_data["party_id"] = bill.supplier_id
        
        # Update bill balance
        bill.amount_paid += (payment_in.amount + payment_in.tds_amount)
        bill.balance_due = bill.total - bill.amount_paid
        if bill.balance_due <= 0:
            bill.status = "PAID"
        elif bill.amount_paid > 0:
            bill.status = "PARTIAL"

    elif payment_in.reference_type == "invoice" and payment_in.reference_id:
        invoice = await db.get(Invoice, payment_in.reference_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Target invoice not found.")
            
        payment_data["payment_type"] = "RECEIPT"
        payment_data["party_type"] = "customer"
        payment_data["party_id"] = invoice.customer_id
        
        # Update invoice balance
        invoice.amount_paid += (payment_in.amount + payment_in.tds_amount)
        invoice.balance_due = invoice.total - invoice.amount_paid
        if invoice.balance_due <= 0:
            invoice.status = "PAID"
        elif invoice.amount_paid > 0:
            invoice.status = "PARTIAL"

    new_payment = Payment(
        **payment_data,
        company_id=company.id,
        created_by=current_user.id
    )
    
    db.add(new_payment)
    await db.commit()
    await db.refresh(new_payment)
    if not new_payment.created_at:
        from datetime import timezone
        new_payment.created_at = datetime.now(timezone.utc)

    await cache_manager.invalidate_prefix(f"banking_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"all_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    await cache_manager.invalidate_prefix(f"company:{company.id}:report")
    await cache_manager.invalidate_prefix(f"customers:{company.id}")
    await cache_manager.invalidate_prefix(f"suppliers:{company.id}")
    return new_payment

# --- Capital Transfer ---
@router.post("/transfer-capital", response_model=PaymentSchema)
async def transfer_capital(
    transfer_in: CapitalTransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    """
    Handles internal capital infusion: Dr. Bank/Cash, Cr. Capital Account
    """
    source_acc = await db.get(Account, transfer_in.source_account_id)
    dest_acc = await db.get(Account, transfer_in.destination_account_id)
    
    if not source_acc or not dest_acc:
        raise HTTPException(status_code=404, detail="One or more target accounts not found.")
    
    # 1. Create Journal Entry (Industrial Double Entry)
    entry_count = await db.execute(select(func.count(JournalEntry.id)).where(JournalEntry.company_id == company.id))
    count = entry_count.scalar() or 0
    entry_no = f"JV-{datetime.now().year}-{(count+1):04d}"
    
    new_jv = JournalEntry(
        company_id=company.id,
        created_by=current_user.id,
        entry_number=entry_no,
        entry_date=transfer_in.transfer_date,
        description=transfer_in.notes or "Capital Transfer Injection",
        reference_type="manual",
        total_debit=transfer_in.amount,
        total_credit=transfer_in.amount,
        is_posted=True
    )
    
    # Debit: Bank/Cash
    dr_line = JournalEntryLine(account_id=dest_acc.id, debit=transfer_in.amount, credit=0, description="Capital Infusion")
    # Credit: Capital/Equity
    cr_line = JournalEntryLine(account_id=source_acc.id, debit=0, credit=transfer_in.amount, description="Capital Source")
    
    new_jv.lines.extend([dr_line, cr_line])
    db.add(new_jv)
    
    # 2. Update Account Balances (Real-time Symmetry)
    dest_acc.opening_balance += transfer_in.amount
    # Source account (Equity) also increases (Credit increases Equity)
    source_acc.opening_balance += transfer_in.amount
    
    # 3. Create Payment record for Ledger Visibility
    new_payment = Payment(
        company_id=company.id,
        created_by=current_user.id,
        payment_type="RECEIPT",
        party_type="internal",
        party_id=source_acc.id, # Using source account as party for internal ref
        payment_method="BANK_TRANSFER" if dest_acc.account_subtype.upper() == "BANK" else "CASH",
        amount=transfer_in.amount,
        payment_date=transfer_in.transfer_date,
        notes=transfer_in.notes or "CAPITAL TRANSFER",
        reference_type="journal_entry",
        reference_id=new_jv.id
    )
    
    db.add(new_payment)
    await db.commit()
    await db.refresh(new_payment)

    await cache_manager.invalidate_prefix(f"banking_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"all_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    await cache_manager.invalidate_prefix(f"company:{company.id}:report")
    return new_payment
