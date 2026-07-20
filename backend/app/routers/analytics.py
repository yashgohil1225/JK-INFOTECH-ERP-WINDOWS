# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select
from sqlalchemy.sql import func
from app.database import get_db
from app.models import Product, Invoice, Payment, Account, Company, PurchaseBill, Customer
from app.middleware.auth import get_current_company
from datetime import datetime, timedelta
from decimal import Decimal

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])

@router.get("/kpis")
async def get_kpis(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    # Real Total Sales (Invoices)
    total_sales = await db.scalar(
        select(func.sum(Invoice.total)).where(Invoice.company_id == company.id)
    ) or Decimal("0")
    
    # Real Total Receivable (Outstanding Invoices)
    total_receivable = await db.scalar(
        select(func.sum(Invoice.balance_due)).where(Invoice.company_id == company.id)
    ) or Decimal("0")
    
    # Real Total Payable (Outstanding Purchase Bills)
    total_payable = await db.scalar(
        select(func.sum(PurchaseBill.balance_due)).where(PurchaseBill.company_id == company.id)
    ) or Decimal("0")
    
    # Real Active customers count
    active_customers = await db.scalar(
        select(func.count(Customer.id)).where(Customer.company_id == company.id).where(Customer.is_active == True)
    ) or 0
    
    return {
        "total_sales": float(total_sales),
        "total_receivable": float(total_receivable),
        "total_payable": float(total_payable),
        "cash_on_hand": 0.0, # Will be handled by liquidity
        "monthly_growth": 0.0,
        "active_customers": int(active_customers)
    }

@router.get("/sales-trend")
async def get_sales_trend(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    # Real trend for last 12 months
    today = datetime.now()
    trend = []
    
    for i in range(11, -1, -1):
        # This is a simplified query. In production, we'd use a single group-by query.
        start_date = (today.replace(day=1) - timedelta(days=i*30)).replace(day=1)
        end_date = (start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        month_label = start_date.strftime("%b").upper()
        
        sales = await db.scalar(
            select(func.sum(Invoice.total))
            .where(Invoice.company_id == company.id)
            .where(Invoice.invoice_date >= start_date)
            .where(Invoice.invoice_date <= end_date)
        ) or Decimal("0")
        
        purchases = await db.scalar(
            select(func.sum(PurchaseBill.total))
            .where(PurchaseBill.company_id == company.id)
            .where(PurchaseBill.bill_date >= start_date)
            .where(PurchaseBill.bill_date <= end_date)
        ) or Decimal("0")
        
        trend.append({
            "date": month_label, 
            "sales": float(sales), 
            "purchase": float(purchases)
        })
        
    return trend

@router.get("/liquidity")
async def get_liquidity(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    # Fetch real balances from Bank/Cash accounts
    accounts = await db.execute(
        select(Account)
        .where(
            Account.company_id == company.id, 
            Account.account_subtype.in_(["Bank", "Cash", "BANK", "CASH", "Cash in Hand"])
        )
    )
    account_list = accounts.scalars().all()
    
    # Calculate net from payments
    payments_res = await db.execute(
        select(Payment)
        .where(Payment.company_id == company.id)
        .where(Payment.reference_type != "journal_entry")
    )
    payments = payments_res.scalars().all()
    
    cash_net = Decimal(0)
    bank_net = Decimal(0)
    
    for p in payments:
        amount = p.amount or Decimal(0)
        method = (p.payment_method or "").upper()
        if method == "CASH":
            if p.payment_type == "RECEIPT":
                cash_net += amount
            else:
                cash_net -= amount
        else:
            if p.payment_type == "RECEIPT":
                bank_net += amount
            else:
                bank_net -= amount

    bank_accounts = [a for a in account_list if a.account_subtype.upper() in ["BANK"]]
    cash_accounts = [a for a in account_list if a.account_subtype.upper() in ["CASH", "CASH IN HAND"]]

    results = []
    for acc in account_list:
        is_bank = acc.account_subtype.upper() in ["BANK"]
        bal = acc.opening_balance or Decimal(0)
        
        # Apply net to the first account of that type
        if is_bank and bank_accounts and acc.id == bank_accounts[0].id:
            bal += bank_net
        elif not is_bank and cash_accounts and acc.id == cash_accounts[0].id:
            bal += cash_net
            
        results.append({
            "account_name": acc.name,
            "balance": float(bal),
            "type": "bank" if is_bank else "cash"
        })
        
    return results
