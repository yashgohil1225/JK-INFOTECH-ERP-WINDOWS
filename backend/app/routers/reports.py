# =============================================================
# JK INFOTECH ERP — Reports & Analytics Router
# File : app/routers/reports.py — Updated for completely rewritten gstr1.html template
# =============================================================

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Response, status
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
import uuid

from app.database import get_db
from app.middleware.auth import get_current_company
from app.models import Company, Account, JournalEntryLine, JournalEntry, Invoice, PurchaseBill
from app.services.reports import ReportService
from app.core.redis import cache_manager

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])

def make_pdf_response(pdf_bytes: bytes, filename: str, service: Optional[ReportService] = None, cache_hit: bool = False) -> Response:
    import json
    match_counts = getattr(service, "match_counts", []) if service else []
    headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "Access-Control-Expose-Headers": "Content-Disposition, X-PDF-Search-Matches, X-Cache",
        "X-PDF-Search-Matches": json.dumps(match_counts),
        "X-Cache": "HIT" if cache_hit else "MISS",
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)

def parse_date(d_str: Optional[str]) -> Optional[date]:
    if not d_str:
        return None
    try:
        return datetime.strptime(d_str, "%Y-%m-%d").date()
    except ValueError:
        return None

def is_landscape_orientation(orientation: Optional[str], default_landscape: bool = True) -> bool:
    if not orientation or str(orientation).strip() == "":
        return default_landscape
    return str(orientation).strip().lower() == "landscape"

# =============================================================
# 1. GET /api/reports/gst (GST Summary Overview)
# =============================================================
@router.get("/gst")
async def get_gst_summary(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"company:{company.id}:report:gst"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    service = ReportService(db, company.id)
    res = await service.get_gst_summary_data()
    data = {
        "total_sales_value": res["total_sales_value"],
        "output_tax": res["output_tax"],
        "total_purchases_value": res["total_purchases_value"],
        "itc_claimed": res["itc_claimed"],
        "net_tax_payable": res["net_tax_payable"]
    }
    await cache_manager.set(cache_key, data, ttl_seconds=900)
    return data

# =============================================================
# 1.5 GET /api/reports/gst/pdf (GST Summary PDF)
# =============================================================
@router.get("/gst/pdf")
async def get_gst_summary_pdf(
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"company:{company.id}:report:gst:pdf:{orientation}:{search or ''}"
    cached_pdf = await cache_manager.get_bytes(cache_key)
    if cached_pdf is not None:
        return make_pdf_response(cached_pdf, "GST_Summary.pdf", service=None, cache_hit=True)

    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_gst_summary_pdf()
    await cache_manager.set_bytes(cache_key, pdf_bytes, ttl_seconds=900)
    return make_pdf_response(pdf_bytes, "GST_Summary.pdf", service, cache_hit=False)

# =============================================================
# 2. GET /api/reports/trial-balance
# =============================================================
@router.get("/trial-balance")
async def get_trial_balance(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"company:{company.id}:report:trial_balance"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    service = ReportService(db, company.id)
    res = await service.get_trial_balance_data()
    data = res["accounts"]
    await cache_manager.set(cache_key, data, ttl_seconds=900)
    return data

# =============================================================
# 2.5 GET /api/reports/trial-balance/pdf
# =============================================================
@router.get("/trial-balance/pdf")
async def get_trial_balance_pdf(
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"company:{company.id}:report:trial_balance:pdf:{orientation}:{search or ''}"
    cached_pdf = await cache_manager.get_bytes(cache_key)
    if cached_pdf is not None:
        return make_pdf_response(cached_pdf, "Trial_Balance.pdf", service=None, cache_hit=True)

    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_trial_balance_pdf()
    await cache_manager.set_bytes(cache_key, pdf_bytes, ttl_seconds=900)
    return make_pdf_response(pdf_bytes, "Trial_Balance.pdf", service, cache_hit=False)

# =============================================================
# 3. GET /api/reports/daybook
# =============================================================
@router.get("/daybook")
async def get_daybook(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"company:{company.id}:report:daybook:{start_date or ''}:{end_date or ''}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    start = parse_date(start_date)
    end = parse_date(end_date)
    service = ReportService(db, company.id)
    res = await service.get_day_book(start, end)
    await cache_manager.set(cache_key, res, ttl_seconds=900)
    return res

# =============================================================
# 4. GET /api/reports/daybook/pdf
# =============================================================
@router.get("/daybook/pdf")
async def get_daybook_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"company:{company.id}:report:daybook:pdf:{start_date or ''}:{end_date or ''}:{orientation}:{search or ''}"
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    filename = f"Day_Book_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf"

    cached_pdf = await cache_manager.get_bytes(cache_key)
    if cached_pdf is not None:
        return make_pdf_response(cached_pdf, filename, service=None, cache_hit=True)

    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_day_book_pdf(start, end)
    await cache_manager.set_bytes(cache_key, pdf_bytes, ttl_seconds=900)
    return make_pdf_response(pdf_bytes, filename, service, cache_hit=False)

# =============================================================
# 4.5 GET /api/reports/daybook/excel
# =============================================================
@router.get("/daybook/excel")
async def get_daybook_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_day_book_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="Daybook_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 5. GET /api/reports/profit-loss
# =============================================================
@router.get("/profit-loss")
async def get_profit_loss(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"company:{company.id}:report:profit_loss:{start_date or ''}:{end_date or ''}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    res = await service.get_profit_loss(start, end)
    await cache_manager.set(cache_key, res, ttl_seconds=900)
    return res

# =============================================================
# 6. GET /api/reports/profit-loss/pdf
# =============================================================
@router.get("/profit-loss/pdf")
async def get_profit_loss_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "portrait",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    filename = f"Profit_Loss_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf"
    cache_key = f"company:{company.id}:report:profit_loss:pdf:{start_date or ''}:{end_date or ''}:{orientation}:{search or ''}"

    cached_pdf = await cache_manager.get_bytes(cache_key)
    if cached_pdf is not None:
        return make_pdf_response(cached_pdf, filename, service=None, cache_hit=True)

    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_profit_loss_pdf(start, end)
    await cache_manager.set_bytes(cache_key, pdf_bytes, ttl_seconds=900)
    return make_pdf_response(pdf_bytes, filename, service, cache_hit=False)

# =============================================================
# 6.5 GET /api/reports/profit-loss/excel
# =============================================================
@router.get("/profit-loss/excel")
async def get_profit_loss_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_profit_loss_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="ProfitLoss_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 7. GET /api/reports/balance-sheet
# =============================================================
@router.get("/balance-sheet")
async def get_balance_sheet(
    as_of: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"company:{company.id}:report:balance_sheet:{as_of or ''}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    as_of_date = parse_date(as_of) or date.today()
    service = ReportService(db, company.id)
    res = await service.get_balance_sheet(as_of_date)
    await cache_manager.set(cache_key, res, ttl_seconds=900)
    return res

# =============================================================
# 8. GET /api/reports/balance-sheet/pdf
# =============================================================
@router.get("/balance-sheet/pdf")
async def get_balance_sheet_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "portrait",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    filename = f"Balance_Sheet_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf"
    cache_key = f"company:{company.id}:report:balance_sheet:pdf:{start_date or ''}:{end_date or ''}:{orientation}:{search or ''}"

    cached_pdf = await cache_manager.get_bytes(cache_key)
    if cached_pdf is not None:
        return make_pdf_response(cached_pdf, filename, service=None, cache_hit=True)

    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_balance_sheet_pdf(start, end)
    await cache_manager.set_bytes(cache_key, pdf_bytes, ttl_seconds=900)
    return make_pdf_response(pdf_bytes, filename, service, cache_hit=False)

# =============================================================
# 8.5 GET /api/reports/balance-sheet/excel
# =============================================================
@router.get("/balance-sheet/excel")
async def get_balance_sheet_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_balance_sheet_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="Balance_Sheet_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 9. GET /api/reports/ledger/{accountId}
# =============================================================
@router.get("/ledger/{accountId}")
async def get_account_ledger(
    accountId: uuid.UUID,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    return await service.get_account_ledger(accountId, start, end)

# =============================================================
# 9.5 GET /api/reports/ledger/{accountId}/excel
# =============================================================
@router.get("/ledger/{accountId}/excel")
async def get_account_ledger_excel(
    accountId: uuid.UUID,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_account_ledger_excel(accountId, start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="Ledger_{accountId}_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 9.6 GET /api/reports/ledger/{accountId}/pdf
# =============================================================
@router.get("/ledger/{accountId}/pdf")
async def get_account_ledger_pdf(
    accountId: uuid.UUID,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "portrait",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    
    from app.models import Account
    acc_stmt = select(Account.name).where(Account.id == accountId, Account.company_id == company.id)
    acc_res = await db.execute(acc_stmt)
    acc_name = acc_res.scalar_one_or_none() or str(accountId)
    safe_acc_name = acc_name.replace('/', '_').replace(' ', '_')
    
    pdf_bytes = await service.generate_account_ledger_pdf(accountId, start, end)
    return make_pdf_response(pdf_bytes, f"Ledger_{safe_acc_name}_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 10. GET /api/reports/party-ledger/{partyType}/{partyId}
# =============================================================
@router.get("/party-ledger/{partyType}/{partyId}")
async def get_party_ledger(
    partyType: str,
    partyId: uuid.UUID,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    return await service.get_party_ledger(partyId, partyType, start, end)

# =============================================================
# 11. GET /api/reports/party-ledger/{partyType}/{partyId}/pdf
# =============================================================
@router.get("/party-ledger/{partyType}/{partyId}/pdf")
async def get_party_ledger_pdf(
    partyType: str,
    partyId: uuid.UUID,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "portrait",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    
    party_name = "Party"
    if partyType.lower() == "customer":
        from app.models import Customer
        p_stmt = select(Customer.name).where(Customer.id == partyId, Customer.company_id == company.id)
        p_res = await db.execute(p_stmt)
        party_name = p_res.scalar_one_or_none() or "Customer"
    elif partyType.lower() == "supplier":
        from app.models import Supplier
        p_stmt = select(Supplier.name).where(Supplier.id == partyId, Supplier.company_id == company.id)
        p_res = await db.execute(p_stmt)
        party_name = p_res.scalar_one_or_none() or "Supplier"
    safe_party_name = party_name.replace('/', '_').replace(' ', '_')
    
    pdf_bytes = await service.generate_balance_confirmation_pdf(partyId, partyType, start, end)
    return make_pdf_response(pdf_bytes, f"Balance_Confirmation_{safe_party_name}_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 12. GET /api/reports/gst/gstr1
# =============================================================
@router.get("/gst/gstr1")
async def get_gstr1(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    return await service.get_gstr1_data(start, end)

# =============================================================
# 13. GET /api/reports/gst/gstr2
# =============================================================
@router.get("/gst/gstr2")
async def get_gstr2(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    return await service.get_gstr2_data(start, end)

# =============================================================
# 14. GET /api/reports/gst/gstr3b
# =============================================================
@router.get("/gst/gstr3b")
async def get_gstr3b(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    
    # Outward supplies
    sales_stmt = select(
        func.sum(Invoice.subtotal).label("taxable_value"),
        func.sum(Invoice.igst_amount).label("igst"),
        func.sum(Invoice.cgst_amount).label("cgst"),
        func.sum(Invoice.sgst_amount).label("sgst"),
        func.sum(Invoice.tax_amount).label("total_tax")
    ).where(
        Invoice.company_id == company.id,
        Invoice.invoice_date.between(start, end),
        Invoice.status != "CANCELLED"
    )
    sales_res = await db.execute(sales_stmt)
    sales_row = sales_res.first()
    
    # Inward supplies (ITC)
    purch_stmt = select(
        func.sum(PurchaseBill.subtotal).label("taxable_value"),
        func.sum(PurchaseBill.igst_amount).label("igst"),
        func.sum(PurchaseBill.cgst_amount).label("cgst"),
        func.sum(PurchaseBill.sgst_amount).label("sgst"),
        func.sum(PurchaseBill.tax_amount).label("itc_available")
    ).where(
        PurchaseBill.company_id == company.id,
        PurchaseBill.bill_date.between(start, end),
        PurchaseBill.status != "CANCELLED"
    )
    purch_res = await db.execute(purch_stmt)
    purch_row = purch_res.first()
    
    s_val = float(sales_row.taxable_value or 0.0) if sales_row else 0.0
    s_igst = float(sales_row.igst or 0.0) if sales_row else 0.0
    s_cgst = float(sales_row.cgst or 0.0) if sales_row else 0.0
    s_sgst = float(sales_row.sgst or 0.0) if sales_row else 0.0
    s_tax = float(sales_row.total_tax or 0.0) if sales_row else 0.0
    
    p_val = float(purch_row.taxable_value or 0.0) if purch_row else 0.0
    p_igst = float(purch_row.igst or 0.0) if purch_row else 0.0
    p_cgst = float(purch_row.cgst or 0.0) if purch_row else 0.0
    p_sgst = float(purch_row.sgst or 0.0) if purch_row else 0.0
    p_itc = float(purch_row.itc_available or 0.0) if purch_row else 0.0
    
    net_payable = s_tax - p_itc
    
    return {
        "period": {"start": start.strftime("%Y-%m-%d"), "end": end.strftime("%Y-%m-%d")},
        "outward_supplies": {
            "taxable_value": s_val,
            "igst": s_igst,
            "cgst": s_cgst,
            "sgst": s_sgst,
            "total_tax": s_tax
        },
        "inward_supplies_itc": {
            "taxable_value": p_val,
            "itc_available": p_itc,
            "igst": p_igst,
            "cgst": p_cgst,
            "sgst": p_sgst
        },
        "net_tax_payable": net_payable
    }

# =============================================================
# 15. GET /api/reports/audit-trail
# =============================================================
@router.get("/audit-trail")
async def get_audit_trail(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    service = ReportService(db, company.id)
    return await service.get_audit_logs(limit)

# =============================================================
# 16. GET /api/reports/cashflow
# =============================================================
@router.get("/cashflow")
async def get_cashflow(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    return await service.get_cash_flow(start, end)

# =============================================================
# 17. GET /api/reports/cashflow/pdf
# =============================================================
@router.get("/cashflow/pdf")
async def get_cashflow_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "portrait",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_cash_flow_pdf(start, end)
    return make_pdf_response(pdf_bytes, f"Cash_Flow_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 17.5 GET /api/reports/cashflow/excel
# =============================================================
@router.get("/cashflow/excel")
async def get_cashflow_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_cash_flow_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="Cashflow_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 18. GET /api/reports/gst/gstr1/pdf
# =============================================================
@router.get("/gst/gstr1/pdf")
async def get_gstr1_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_gstr1_pdf(start, end)
    return make_pdf_response(pdf_bytes, f"GSTR1_Report_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 18.5 GET /api/reports/gst/gstr1/excel
# =============================================================
@router.get("/gst/gstr1/excel")
async def get_gstr1_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_gstr1_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="GSTR1_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 19. GET /api/reports/gst/gstr2/pdf
# =============================================================
@router.get("/gst/gstr2/pdf")
async def get_gstr2_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_gstr2_pdf(start, end)
    return make_pdf_response(pdf_bytes, f"GSTR2_Report_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 19.5 GET /api/reports/gst/gstr2/excel
# =============================================================
@router.get("/gst/gstr2/excel")
async def get_gstr2_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_gstr2_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="GSTR2_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 19b. GET /api/reports/gst/gstr3b/pdf
# =============================================================
@router.get("/gst/gstr3b/pdf")
async def get_gstr3b_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_gstr3b_pdf(start, end)
    return make_pdf_response(pdf_bytes, f"GSTR3B_Report_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 19c. GET /api/reports/gst/gstr3b/excel
# =============================================================
@router.get("/gst/gstr3b/excel")
async def get_gstr3b_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_gstr3b_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="GSTR3B_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 20. GET /api/reports/gst/gstr1/summary
# =============================================================
@router.get("/gst/gstr1/summary")
async def get_gstr1_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today()
    if start.month < 4:
        start = start.replace(year=start.year - 1, month=4, day=1)
    else:
        start = start.replace(month=4, day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    return await service.get_gstr1_summary_data(start, end)

# =============================================================
# 21. GET /api/reports/gst/gstr1/summary/pdf
# =============================================================
@router.get("/gst/gstr1/summary/pdf")
async def get_gstr1_summary_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today()
    if start.month < 4:
        start = start.replace(year=start.year - 1, month=4, day=1)
    else:
        start = start.replace(month=4, day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_gstr1_summary_pdf(start, end)
    return make_pdf_response(pdf_bytes, f"GSTR1_Summary_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 21.5 GET /api/reports/gst/gstr1/summary/excel
# =============================================================
@router.get("/gst/gstr1/summary/excel")
async def get_gstr1_summary_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today()
    if start.month < 4:
        start = start.replace(year=start.year - 1, month=4, day=1)
    else:
        start = start.replace(month=4, day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_gstr1_summary_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="GSTR1_Summary_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 22. GET /api/reports/gst/gstr2/summary
# =============================================================
@router.get("/gst/gstr2/summary")
async def get_gstr2_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today()
    if start.month < 4:
        start = start.replace(year=start.year - 1, month=4, day=1)
    else:
        start = start.replace(month=4, day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    return await service.get_gstr2_summary_data(start, end)

# =============================================================
# 23. GET /api/reports/gst/gstr2/summary/pdf
# =============================================================
@router.get("/gst/gstr2/summary/pdf")
async def get_gstr2_summary_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today()
    if start.month < 4:
        start = start.replace(year=start.year - 1, month=4, day=1)
    else:
        start = start.replace(month=4, day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_gstr2_summary_pdf(start, end)
    return make_pdf_response(pdf_bytes, f"GSTR2_Summary_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 23.5 GET /api/reports/gst/gstr2/summary/excel
# =============================================================
@router.get("/gst/gstr2/summary/excel")
async def get_gstr2_summary_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    start = parse_date(start_date) or date.today()
    if start.month < 4:
        start = start.replace(year=start.year - 1, month=4, day=1)
    else:
        start = start.replace(month=4, day=1)
    end = parse_date(end_date) or date.today()
    service = ReportService(db, company.id)
    excel_bytes = await service.generate_gstr2_summary_excel(start, end)
    
    headers = {
        'Content-Disposition': f'attachment; filename="GSTR2_Summary_{end.strftime("%Y%m%d")}.xlsx"',
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# =============================================================
# 24. GET /api/reports/outstanding
# =============================================================

@router.get("/outstanding/pdf")
async def get_outstanding_summary_pdf(
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_outstanding_pdf()
    return make_pdf_response(pdf_bytes, "Outstanding_Summary.pdf", service)

@router.get("/outstanding")
async def get_outstanding_summary(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    service = ReportService(db, company.id)
    return await service.get_outstanding_summary()

@router.get("/outstanding/pdf")
async def get_outstanding_pdf(
    orientation: Optional[str] = "portrait",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    pdf_bytes = await service.generate_outstanding_pdf()
    return make_pdf_response(pdf_bytes, f"Outstanding_Summary_{date.today().strftime('%Y%m%d')}.pdf", service)

# =============================================================
# 25. GET /api/reports/sales-by-customer
# =============================================================
@router.get("/sales-by-customer")
async def get_sales_by_customer(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from app.models import Invoice, Customer
    from sqlalchemy import select, func, Date
    
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    
    query = (
        select(
            Customer.id,
            Customer.name,
            Customer.gst_number,
            Customer.phone,
            Customer.email,
            func.count(Invoice.id).label("invoice_count"),
            func.sum(Invoice.subtotal).label("total_subtotal"),
            func.sum(Invoice.tax_amount).label("total_tax"),
            func.sum(Invoice.total).label("total_sales")
        )
        .join(Invoice, Invoice.customer_id == Customer.id)
        .where(
            Invoice.company_id == company.id,
            Invoice.invoice_date.between(start, end),
            Invoice.status != "CANCELLED"
        )
        .group_by(Customer.id, Customer.name, Customer.gst_number, Customer.phone, Customer.email)
        .order_by(func.sum(Invoice.total).desc())
    )
    
    res = await db.execute(query)
    rows = res.all()
    
    out = []
    for r in rows:
        out.append({
            "customer_id": str(r.id),
            "customer_name": r.name,
            "gstin": r.gst_number,
            "mobile": r.phone,
            "email": r.email,
            "invoice_count": r.invoice_count,
            "subtotal": float(r.total_subtotal or 0),
            "tax_amount": float(r.total_tax or 0),
            "total_sales": float(r.total_sales or 0)
        })
    return out

# =============================================================
# 26. GET /api/reports/sales-by-item
# =============================================================
@router.get("/sales-by-item")
async def get_sales_by_item(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from app.models import Invoice, InvoiceItem, Product
    from sqlalchemy import select, func
    
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    
    query = (
        select(
            Product.id,
            Product.name,
            Product.sku,
            Product.unit,
            func.sum(InvoiceItem.quantity).label("total_qty"),
            func.sum(InvoiceItem.total).label("total_sales_value"),
            func.avg(InvoiceItem.unit_price).label("avg_rate")
        )
        .join(InvoiceItem, InvoiceItem.product_id == Product.id)
        .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
        .where(
            Invoice.company_id == company.id,
            Invoice.invoice_date.between(start, end),
            Invoice.status != "CANCELLED"
        )
        .group_by(Product.id, Product.name, Product.sku, Product.unit)
        .order_by(func.sum(InvoiceItem.total).desc())
    )
    
    res = await db.execute(query)
    rows = res.all()
    
    out = []
    for r in rows:
        out.append({
            "product_id": str(r.id),
            "product_name": r.name,
            "sku": r.sku,
            "unit": r.unit,
            "total_quantity": float(r.total_qty or 0),
            "total_sales_value": float(r.total_sales_value or 0),
            "avg_rate": float(r.avg_rate or 0)
        })
    return out

# =============================================================
# 27. GET /api/reports/item-movement
# =============================================================
@router.get("/item-movement")
async def get_item_movement(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from app.models import Product, StockEntry
    from sqlalchemy import select, func, Date
    from sqlalchemy.orm import selectinload
    
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    
    prod_query = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.company_id == company.id)
        .order_by(Product.name)
    )
    prod_res = await db.execute(prod_query)
    products = prod_res.scalars().all()
    
    opening_query = (
        select(
            StockEntry.product_id,
            func.sum(StockEntry.quantity).label("qty")
        )
        .where(
            StockEntry.company_id == company.id,
            func.cast(StockEntry.created_at, Date) < start
        )
        .group_by(StockEntry.product_id)
    )
    op_res = await db.execute(opening_query)
    opening_map = {r.product_id: float(r.qty or 0) for r in op_res.all()}
    
    period_query = (
        select(StockEntry)
        .where(
            StockEntry.company_id == company.id,
            func.cast(StockEntry.created_at, Date).between(start, end)
        )
    )
    period_res = await db.execute(period_query)
    entries = period_res.scalars().all()
    
    inward_map = {}
    outward_map = {}
    for entry in entries:
        pid = entry.product_id
        qty = float(entry.quantity or 0)
        if qty > 0:
            inward_map[pid] = inward_map.get(pid, 0.0) + qty
        else:
            outward_map[pid] = outward_map.get(pid, 0.0) + abs(qty)
            
    out = []
    for p in products:
        op = opening_map.get(p.id, 0.0)
        inw = inward_map.get(p.id, 0.0)
        outw = outward_map.get(p.id, 0.0)
        closing = op + inw - outw
        
        out.append({
            "product_id": str(p.id),
            "product_name": p.name,
            "sku": p.sku,
            "unit": p.unit,
            "category_name": p.category.name if p.category else "Uncategorized",
            "purchase_price": float(p.purchase_price or 0),
            "sales_price": float(p.sale_price or 0),
            "opening_stock": op,
            "inward_qty": inw,
            "outward_qty": outw,
            "closing_stock": closing,
            "valuation": closing * float(p.purchase_price or 0)
        })
    return out


# =============================================================
# 28. GET /api/reports/stock-valuation/pdf
# =============================================================
@router.get("/stock-valuation/pdf")
async def get_stock_valuation_pdf(
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from app.models import Product
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from fastapi.encoders import jsonable_encoder
    import json
    
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    stmt = select(Product).where(Product.company_id == company.id).options(selectinload(Product.category)).order_by(Product.name)
    res = await db.execute(stmt)
    products = res.scalars().all()
    
    comp_info = {
        "name": company.name,
        "address": company.office_address_1 or "",
        "gst_number": company.gst_number or "",
        "contact": company.phone or "",
        "email": company.email or ""
    }
    
    prod_list = []
    for p in products:
        prod_list.append({
            "name": p.name,
            "sku": p.sku,
            "category_name": p.category.name if p.category else "Uncategorized",
            "reorder_level": p.reorder_level,
            "current_stock": p.current_stock,
            "unit": p.unit,
            "purchase_price": float(p.purchase_price or 0)
        })
        
    data = {
        "companyInfo": comp_info,
        "asOfDate": date.today().strftime("%d-%b-%Y"),
        "products": prod_list
    }
    
    template = service.jinja_env.get_template("stock_valuation.html")
    html_out = template.render(
        report_data_json=json.dumps(jsonable_encoder(data)),
        landscape=is_landscape_orientation(orientation, default_landscape=True)
    )
    pdf_bytes = await service._generate_pdf(html_out)
    return make_pdf_response(pdf_bytes, f"Stock_Valuation_{date.today().strftime('%Y%m%d')}.pdf", service)


# =============================================================
# 29. GET /api/reports/low-stock/pdf
# =============================================================
@router.get("/low-stock/pdf")
async def get_low_stock_pdf(
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from app.models import Product
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from fastapi.encoders import jsonable_encoder
    import json
    
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    stmt = select(Product).where(Product.company_id == company.id).options(selectinload(Product.category)).order_by(Product.name)
    res = await db.execute(stmt)
    products = res.scalars().all()
    
    comp_info = {
        "name": company.name,
        "address": company.office_address_1 or "",
        "gst_number": company.gst_number or "",
        "contact": company.phone or "",
        "email": company.email or ""
    }
    
    prod_list = []
    for p in products:
        if p.current_stock <= p.reorder_level:
            prod_list.append({
                "name": p.name,
                "sku": p.sku,
                "category_name": p.category.name if p.category else "Uncategorized",
                "reorder_level": p.reorder_level,
                "current_stock": p.current_stock,
                "unit": p.unit,
                "purchase_price": float(p.purchase_price or 0)
            })
        
    data = {
        "companyInfo": comp_info,
        "asOfDate": date.today().strftime("%d-%b-%Y"),
        "products": prod_list
    }
    
    template = service.jinja_env.get_template("low_stock.html")
    html_out = template.render(
        report_data_json=json.dumps(jsonable_encoder(data)),
        landscape=is_landscape_orientation(orientation, default_landscape=True)
    )
    pdf_bytes = await service._generate_pdf(html_out)
    return make_pdf_response(pdf_bytes, f"Low_Stock_Alerts_{date.today().strftime('%Y%m%d')}.pdf", service)


# =============================================================
# 30. GET /api/reports/sales-by-customer/pdf
# =============================================================
@router.get("/sales-by-customer/pdf")
async def get_sales_by_customer_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from app.models import Invoice, Customer
    from sqlalchemy import select, func
    from fastapi.encoders import jsonable_encoder
    import json
    
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    
    query = (
        select(
            Customer.name,
            Customer.gst_number,
            Customer.phone,
            Customer.email,
            func.count(Invoice.id).label("invoice_count"),
            func.sum(Invoice.subtotal).label("total_subtotal"),
            func.sum(Invoice.tax_amount).label("total_tax"),
            func.sum(Invoice.total).label("total_sales")
        )
        .join(Invoice, Invoice.customer_id == Customer.id)
        .where(
            Invoice.company_id == company.id,
            Invoice.invoice_date.between(start, end),
            Invoice.status != "CANCELLED"
        )
        .group_by(Customer.id, Customer.name, Customer.gst_number, Customer.phone, Customer.email)
        .order_by(func.sum(Invoice.total).desc())
    )
    
    res = await db.execute(query)
    rows = res.all()
    
    sales_list = []
    for r in rows:
        sales_list.append({
            "customer_name": r.name,
            "gstin": r.gst_number,
            "mobile": r.phone,
            "email": r.email,
            "invoice_count": r.invoice_count,
            "subtotal": float(r.total_subtotal or 0),
            "tax_amount": float(r.total_tax or 0),
            "total_sales": float(r.total_sales or 0)
        })
        
    comp_info = {
        "name": company.name,
        "address": company.office_address_1 or "",
        "gst_number": company.gst_number or "",
        "contact": company.phone or "",
        "email": company.email or ""
    }
    
    data = {
        "companyInfo": comp_info,
        "startDate": start.strftime("%d-%b-%Y"),
        "endDate": end.strftime("%d-%b-%Y"),
        "sales": sales_list
    }
    
    template = service.jinja_env.get_template("sales_by_customer.html")
    html_out = template.render(
        report_data_json=json.dumps(jsonable_encoder(data)),
        landscape=is_landscape_orientation(orientation, default_landscape=True)
    )
    pdf_bytes = await service._generate_pdf(html_out)
    return make_pdf_response(pdf_bytes, f"Sales_By_Customer_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)


# =============================================================
# 31. GET /api/reports/sales-by-item/pdf
# =============================================================
@router.get("/sales-by-item/pdf")
async def get_sales_by_item_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from app.models import Invoice, InvoiceItem, Product
    from sqlalchemy import select, func
    from fastapi.encoders import jsonable_encoder
    import json
    
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    
    query = (
        select(
            Product.name,
            Product.sku,
            Product.unit,
            func.sum(InvoiceItem.quantity).label("total_qty"),
            func.sum(InvoiceItem.total).label("total_sales_value"),
            func.avg(InvoiceItem.unit_price).label("avg_rate")
        )
        .join(InvoiceItem, InvoiceItem.product_id == Product.id)
        .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
        .where(
            Invoice.company_id == company.id,
            Invoice.invoice_date.between(start, end),
            Invoice.status != "CANCELLED"
        )
        .group_by(Product.id, Product.name, Product.sku, Product.unit)
        .order_by(func.sum(InvoiceItem.total).desc())
    )
    
    res = await db.execute(query)
    rows = res.all()
    
    sales_list = []
    for r in rows:
        sales_list.append({
            "product_name": r.name,
            "sku": r.sku,
            "unit": r.unit,
            "total_quantity": float(r.total_qty or 0),
            "total_sales_value": float(r.total_sales_value or 0),
            "avg_rate": float(r.avg_rate or 0)
        })
        
    comp_info = {
        "name": company.name,
        "address": company.office_address_1 or "",
        "gst_number": company.gst_number or "",
        "contact": company.phone or "",
        "email": company.email or ""
    }
    
    data = {
        "companyInfo": comp_info,
        "startDate": start.strftime("%d-%b-%Y"),
        "endDate": end.strftime("%d-%b-%Y"),
        "sales": sales_list
    }
    
    template = service.jinja_env.get_template("sales_by_item.html")
    html_out = template.render(
        report_data_json=json.dumps(jsonable_encoder(data)),
        landscape=is_landscape_orientation(orientation, default_landscape=True)
    )
    pdf_bytes = await service._generate_pdf(html_out)
    return make_pdf_response(pdf_bytes, f"Sales_By_Item_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)


# =============================================================
# 32. GET /api/reports/item-movement/pdf
# =============================================================
@router.get("/item-movement/pdf")
async def get_item_movement_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from app.models import Product, StockEntry
    from sqlalchemy import select, func, Date
    from sqlalchemy.orm import selectinload
    from fastapi.encoders import jsonable_encoder
    import json
    
    start = parse_date(start_date) or date.today().replace(day=1)
    end = parse_date(end_date) or date.today()
    
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    
    prod_query = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.company_id == company.id)
        .order_by(Product.name)
    )
    prod_res = await db.execute(prod_query)
    products = prod_res.scalars().all()
    
    opening_query = (
        select(
            StockEntry.product_id,
            func.sum(StockEntry.quantity).label("qty")
        )
        .where(
            StockEntry.company_id == company.id,
            func.cast(StockEntry.created_at, Date) < start
        )
        .group_by(StockEntry.product_id)
    )
    op_res = await db.execute(opening_query)
    opening_map = {r.product_id: float(r.qty or 0) for r in op_res.all()}
    
    period_query = (
        select(StockEntry)
        .where(
            StockEntry.company_id == company.id,
            func.cast(StockEntry.created_at, Date).between(start, end)
        )
    )
    period_res = await db.execute(period_query)
    entries = period_res.scalars().all()
    
    inward_map = {}
    outward_map = {}
    for entry in entries:
        pid = entry.product_id
        qty = float(entry.quantity or 0)
        if qty > 0:
            inward_map[pid] = inward_map.get(pid, 0.0) + qty
        else:
            outward_map[pid] = outward_map.get(pid, 0.0) + abs(qty)
            
    movements = []
    for p in products:
        op = opening_map.get(p.id, 0.0)
        inw = inward_map.get(p.id, 0.0)
        outw = outward_map.get(p.id, 0.0)
        closing = op + inw - outw
        
        movements.append({
            "product_name": p.name,
            "sku": p.sku,
            "unit": p.unit,
            "category_name": p.category.name if p.category else "Uncategorized",
            "opening_stock": op,
            "inward_qty": inw,
            "outward_qty": outw,
            "closing_stock": closing,
            "valuation": closing * float(p.purchase_price or 0)
        })
        
    comp_info = {
        "name": company.name,
        "address": company.office_address_1 or "",
        "gst_number": company.gst_number or "",
        "contact": company.phone or "",
        "email": company.email or ""
    }
    
    data = {
        "companyInfo": comp_info,
        "startDate": start.strftime("%d-%b-%Y"),
        "endDate": end.strftime("%d-%b-%Y"),
        "movements": movements
    }
    
    template = service.jinja_env.get_template("item_movement.html")
    html_out = template.render(
        report_data_json=json.dumps(jsonable_encoder(data)),
        landscape=is_landscape_orientation(orientation, default_landscape=True)
    )
    pdf_bytes = await service._generate_pdf(html_out)
    return make_pdf_response(pdf_bytes, f"Item_Movement_{start.strftime('%Y%m%d')}_to_{end.strftime('%Y%m%d')}.pdf", service)


# =============================================================
# 33. GET /api/reports/audit-trail/pdf
# =============================================================
@router.get("/audit-trail/pdf")
async def get_audit_trail_pdf(
    limit: int = 100,
    orientation: Optional[str] = "landscape",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    from fastapi.encoders import jsonable_encoder
    import json
    
    service = ReportService(db, company.id, landscape=is_landscape_orientation(orientation, default_landscape=True), search_query=search)
    logs = await service.get_audit_logs(limit)
    
    comp_info = {
        "name": company.name,
        "address": company.office_address_1 or "",
        "gst_number": company.gst_number or "",
        "contact": company.phone or "",
        "email": company.email or ""
    }
    
    data = {
        "companyInfo": comp_info,
        "generatedAt": datetime.now().strftime("%d-%b-%Y %H:%M:%S"),
        "logs": logs
    }
    
    template = service.jinja_env.get_template("audit_trail.html")
    html_out = template.render(
        report_data_json=json.dumps(jsonable_encoder(data)),
        landscape=is_landscape_orientation(orientation, default_landscape=True)
    )
    pdf_bytes = await service._generate_pdf(html_out)
    return make_pdf_response(pdf_bytes, f"System_Audit_Trail_{datetime.now().strftime('%Y%m%d')}.pdf", service)




