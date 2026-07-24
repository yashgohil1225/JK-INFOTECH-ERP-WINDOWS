import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models import Company, Account, Invoice, PurchaseBill

async def check():
    async with AsyncSessionLocal() as db:
        comps = (await db.execute(select(Company))).scalars().all()
        print("COMPANIES:", [(c.id, c.name) for c in comps])
        
        invs = (await db.execute(select(Invoice))).scalars().all()
        print("INVOICES COUNT:", len(invs))
        
        accs = (await db.execute(select(Account))).scalars().all()
        print("ACCOUNTS:", [(a.name, a.account_type, a.account_subtype, a.opening_balance) for a in accs])

if __name__ == "__main__":
    asyncio.run(check())
