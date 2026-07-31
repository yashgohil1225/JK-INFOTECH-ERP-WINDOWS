import asyncio
from app.database import AsyncSessionLocal
from app.models import Customer, Company, Invoice, PurchaseBill, User
from sqlalchemy import select, func

async def debug_all():
    async with AsyncSessionLocal() as db:
        print("\n================ ALL INVOICES IN DATABASE ================")
        invs = (await db.execute(select(Invoice))).scalars().all()
        for i in invs:
            co = await db.get(Company, i.company_id)
            co_name = co.name if co else "UNKNOWN"
            co_active = co.is_active if co else False
            print(f"Invoice ID: {i.id} | No: {i.invoice_number} | Company: '{co_name}' (ID: {i.company_id}, Active: {co_active}) | Total: ₹{i.total} | Balance: ₹{i.balance_due}")

        print("\n================ ALL PURCHASE BILLS IN DATABASE ================")
        bills = (await db.execute(select(PurchaseBill))).scalars().all()
        for b in bills:
            co = await db.get(Company, b.company_id)
            co_name = co.name if co else "UNKNOWN"
            co_active = co.is_active if co else False
            print(f"Bill ID: {b.id} | No: {b.bill_number} | Company: '{co_name}' (ID: {b.company_id}, Active: {co_active}) | Total: ₹{b.total} | Balance: ₹{b.balance_due}")

        print("\n================ ALL CUSTOMERS IN DATABASE ================")
        custs = (await db.execute(select(Customer))).scalars().all()
        for c in custs:
            co = await db.get(Company, c.company_id)
            co_name = co.name if co else "UNKNOWN"
            co_active = co.is_active if co else False
            print(f"Customer ID: {c.id} | Name: '{c.name}' | Company: '{co_name}' (ID: {c.company_id}, Active: {co_active})")

if __name__ == "__main__":
    asyncio.run(debug_all())
