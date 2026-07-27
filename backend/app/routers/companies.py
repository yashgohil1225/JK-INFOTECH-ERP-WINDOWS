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
from datetime import date, datetime, time
from decimal import Decimal
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
# DELETE /api/companies/{id}
# =============================================================
@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_company(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivates a company (soft delete)."""
    import uuid
    try:
        company_uuid = uuid.UUID(id)
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
    await db.commit()
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
    """Creates a new fiscal year for the company."""
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



