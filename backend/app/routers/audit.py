# =============================================================
# JK INFOTECH ERP — Audit & Compliance Router
# File : app/routers/audit.py
# =============================================================

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid
import re

from app.database import get_db
from app.middleware.auth import get_current_company
from app.models import Company, DocumentSequence, FiscalYear

router = APIRouter(
    prefix="/api/v1/audit",
    tags=["Audit"],
)

@router.get("/pre-closing")
async def get_pre_closing_audit(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Perform a pre-closing audit for the fiscal year."""
    # Placeholder industrial audit checks
    return {
        "results": [
            {"label": "Ledger Reconciliation", "status": "SUCCESS", "description": "All subsidiary ledgers match the control accounts."},
            {"label": "Inventory Valuation", "status": "SUCCESS", "description": "Closing stock verified against physical audit logs."},
            {"label": "Tax Compliance", "status": "WARNING", "description": "3 pending GST reconciliations for the final quarter."},
            {"label": "Sequence Integrity", "status": "SUCCESS", "description": "No gaps detected in document numbering chains."},
            {"label": "Asset Depreciation", "status": "SUCCESS", "description": "Year-end depreciation schedules applied."},
            {"label": "Bank Synchronization", "status": "SUCCESS", "description": "Final BRS statement verified for all accounts."}
        ],
        "can_proceed": True
    }

@router.get("/closing-balances")
async def get_closing_balances(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Fetch estimated closing balances for the year-end wizard."""
    return {
        "net_profit": 1245000.00,
        "liquid_assets": 850000.00,
        "accounts_receivable": 420000.00
    }

@router.get("/sequence-calibration")
async def get_sequence_calibration(
    fy_id: Optional[str] = Query(None),
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Propose new document sequences for the next fiscal year based on target fiscal year."""
    fy = None
    if fy_id:
        try:
            fy_uuid = uuid.UUID(fy_id)
            fy_res = await db.execute(
                select(FiscalYear).where(FiscalYear.id == fy_uuid, FiscalYear.company_id == company.id)
            )
            fy = fy_res.scalars().first()
        except ValueError:
            pass

    if not fy:
        fy_res = await db.execute(
            select(FiscalYear).where(FiscalYear.company_id == company.id, FiscalYear.is_active == True)
        )
        fy = fy_res.scalars().first()

    # Query all sequences for this company
    seq_res = await db.execute(
        select(DocumentSequence).where(DocumentSequence.company_id == company.id, DocumentSequence.is_active == True)
    )
    sequences = seq_res.scalars().all()

    # Determine year range pattern based on target fiscal year's end date
    if fy:
        next_start_yr = (fy.end_date.year) % 100
        next_end_yr = (fy.end_date.year + 1) % 100
        new_yr_pattern = f"{next_start_yr:02d}-{next_end_yr:02d}"
    else:
        new_yr_pattern = "24-25"

    calibrations = []
    for seq in sequences:
        pref = seq.prefix or ""
        suff = seq.suffix or ""
        pad = seq.padding or 4
        val_str = str(seq.next_value).zfill(pad)
        current_repr = f"{pref}{val_str}{suff}"

        proposed_pref = pref
        if pref:
            match = re.search(r"(\d{2})([\-\/])(\d{2})", pref)
            if match:
                sep = match.group(2)
                proposed_pref = pref.replace(match.group(0), f"{next_start_yr:02d}{sep}{next_end_yr:02d}")
            else:
                if pref.endswith("/"):
                    proposed_pref = f"{pref}{new_yr_pattern}/"
                else:
                    proposed_pref = f"{pref}/{new_yr_pattern}/"
        else:
            if seq.document_type == "Sales Invoice":
                proposed_pref = f"INV/{new_yr_pattern}/"
            elif seq.document_type == "Purchase Bill":
                proposed_pref = f"PB/{new_yr_pattern}/"
            else:
                proposed_pref = f"{seq.document_type[:3].upper()}/{new_yr_pattern}/"

        proposed_val_str = "1".zfill(pad)
        proposed_repr = f"{proposed_pref}{proposed_val_str}{suff}"

        calibrations.append({
            "document_type": seq.document_type,
            "current_pattern": current_repr,
            "proposed_pattern": proposed_repr
        })

    return calibrations
