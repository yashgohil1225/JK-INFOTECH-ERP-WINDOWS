import uuid
from datetime import date
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import FiscalYear

async def validate_transaction_date(db: AsyncSession, company_id: uuid.UUID, txn_date: date):
    """
    Validates that a transaction date does not fall within any closed fiscal year for the company.
    Raises HTTPException (400) if it falls inside a closed year.
    """
    stmt = select(FiscalYear).where(
        FiscalYear.company_id == company_id,
        FiscalYear.closed_at.is_not(None),
        FiscalYear.start_date <= txn_date,
        FiscalYear.end_date >= txn_date
    )
    result = await db.execute(stmt)
    closed_fy = result.scalars().first()
    if closed_fy:
        raise HTTPException(
            status_code=400,
            detail=f"Compliance Alert: Date falls within closed fiscal year '{closed_fy.label}' (closed at {closed_fy.closed_at.strftime('%d-%m-%Y')}). Operations in locked periods are restricted to preserve audit integrity."
        )
