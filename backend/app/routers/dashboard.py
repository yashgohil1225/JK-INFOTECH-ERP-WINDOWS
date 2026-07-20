# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select
from sqlalchemy.sql import func
from app.database import get_db
from app.middleware.auth import get_current_company
from app.models import Product, Invoice, Payment, Account, Company

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    # Count products
    product_count = await db.scalar(
        select(func.count(Product.id)).where(Product.company_id == company.id)
    )
    
    # Sum total sales
    total_sales = await db.scalar(
        select(func.sum(Invoice.total)).where(Invoice.company_id == company.id)
    ) or 0
    
    # Sum total collections
    total_collections = await db.scalar(
        select(func.sum(Payment.amount))
        .where(Payment.company_id == company.id)
        .filter(Payment.payment_type == "RECEIPT")
    ) or 0
    
    # Sum bank balance (Looking for ASSET accounts with 'Bank' in name)
    bank_balance = await db.scalar(
        select(func.sum(Account.opening_balance))
        .where(Account.company_id == company.id)
        .filter(Account.account_type == "ASSET")
        .filter(Account.name.ilike("%bank%"))
    ) or 0
    
    return {
        "product_count": product_count or 0,
        "total_sales": float(total_sales or 0),
        "total_collections": float(total_collections or 0),
        "bank_balance": float(bank_balance or 0)
    }
