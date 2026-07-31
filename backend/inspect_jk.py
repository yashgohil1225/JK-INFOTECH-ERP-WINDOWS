import asyncio
from app.database import AsyncSessionLocal
from app.models import Customer, Company, Invoice, PurchaseBill
from sqlalchemy import select, func

async def inspect():
    async with AsyncSessionLocal() as db:
        co = (await db.execute(select(Company).where(Company.name == "JK INFOTECH PVT LTD."))).scalars().first()
        if not co:
            print("Company JK INFOTECH PVT LTD. not found!")
            return
        inv_sum = await db.scalar(select(func.sum(Invoice.total)).where(Invoice.company_id == co.id))
        rec_sum = await db.scalar(select(func.sum(Invoice.balance_due)).where(Invoice.company_id == co.id))
        pay_sum = await db.scalar(select(func.sum(PurchaseBill.balance_due)).where(PurchaseBill.company_id == co.id))
        cust_cnt = await db.scalar(select(func.count(Customer.id)).where(Customer.company_id == co.id))
        
        print(f"\n=== REAL DATA IN DB FOR {co.name} ({co.id}) ===")
        print(f"Total Sales: ₹{inv_sum}")
        print(f"Total Receivables: ₹{rec_sum}")
        print(f"Total Payables: ₹{pay_sum}")
        print(f"Customer Count: {cust_cnt}")

        print("\n--- INVOICES FOR JK INFOTECH PVT LTD. ---")
        invs = (await db.execute(select(Invoice).where(Invoice.company_id == co.id))).scalars().all()
        for i in invs:
            print(f"Invoice #{i.invoice_number} | Date: {i.invoice_date} | Total: ₹{i.total} | Balance: ₹{i.balance_due}")

        print("\n--- CUSTOMERS FOR JK INFOTECH PVT LTD. ---")
        custs = (await db.execute(select(Customer).where(Customer.company_id == co.id))).scalars().all()
        for c in custs:
            print(f"Customer: {c.name} | ID: {c.id}")

if __name__ == "__main__":
    asyncio.run(inspect())
