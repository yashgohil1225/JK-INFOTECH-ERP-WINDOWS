import asyncio
from app.database import AsyncSessionLocal
from app.models import Customer, Company, Invoice, PurchaseBill
from sqlalchemy import select, func

async def inspect():
    async with AsyncSessionLocal() as db:
        cos = (await db.execute(select(Company))).scalars().all()
        for co in cos:
            inv_sum = await db.scalar(select(func.sum(Invoice.total)).where(Invoice.company_id == co.id))
            rec_sum = await db.scalar(select(func.sum(Invoice.balance_due)).where(Invoice.company_id == co.id))
            pay_sum = await db.scalar(select(func.sum(PurchaseBill.balance_due)).where(PurchaseBill.company_id == co.id))
            print(f"Company: '{co.name}' | ID: {co.id} | Active: {co.is_active} | Sales: ₹{inv_sum} | Rec: ₹{rec_sum} | Pay: ₹{pay_sum}")

if __name__ == "__main__":
    asyncio.run(inspect())
