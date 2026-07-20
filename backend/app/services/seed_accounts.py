from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Account

async def seed_default_accounts_for_company(db: AsyncSession, company_id: UUID, user_id: UUID):
    """
    Seeds a basic Chart of Accounts for a newly registered company.
    Idempotent: Checks if accounts already exist before adding.
    """
    # Check if any accounts already exist for this company
    stmt = select(Account).where(Account.company_id == company_id).limit(1)
    result = await db.execute(stmt)
    if result.scalars().first():
        return # Accounts already seeded

    default_accounts = [
        # ASSETS
        {"name": "Cash In Hand",      "type": "ASSET",     "code": "1001"},
        {"name": "Trade Receivables", "type": "ASSET",     "code": "1003"},
        {"name": "Inventory Assets",  "type": "ASSET",     "code": "1004"},
        
        # LIABILITIES
        {"name": "Trade Payables",    "type": "LIABILITY", "code": "2001"},
        {"name": "GST Payable",       "type": "LIABILITY", "code": "2002"},
        
        # EQUITY
        {"name": "Capital Account",   "type": "EQUITY",    "code": "3001"},
        {"name": "Retained Earnings", "type": "EQUITY",    "code": "3002"},
        
        # INCOME
        {"name": "Sales Revenue",     "type": "INCOME",    "code": "4001"},
        {"name": "Other Income",      "type": "INCOME",    "code": "4002"},
        
        # EXPENSES
        {"name": "Purchase Cost",     "type": "EXPENSE",   "code": "5001"},
        {"name": "Operating Expenses","type": "EXPENSE",   "code": "5002"},
        {"name": "Salaries",          "type": "EXPENSE",   "code": "5003"},
    ]

    for data in default_accounts:
        acc = Account(
            company_id=company_id,
            name=data["name"],
            account_type=data["type"],
            account_code=data["code"],
            is_system=True,
            is_active=True,
            opening_balance=0
        )
        db.add(acc)
    
    # We flush here so they are available in the current transaction
    await db.flush()
