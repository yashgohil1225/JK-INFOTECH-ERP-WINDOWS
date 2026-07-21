import asyncio
from app.database import AsyncSessionLocal
from app.models import Company, Product, Invoice, Customer, Payment
from sqlalchemy import select, text

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Company))
        companies = res.scalars().all()
        
        print("COMPANIES RECONCILIATION:")
        for c in companies:
            p_cnt = (await db.execute(text(f"SELECT COUNT(*) FROM products WHERE company_id = '{c.id}'"))).scalar()
            i_cnt = (await db.execute(text(f"SELECT COUNT(*) FROM invoices WHERE company_id = '{c.id}'"))).scalar()
            c_cnt = (await db.execute(text(f"SELECT COUNT(*) FROM customers WHERE company_id = '{c.id}'"))).scalar()
            print(f"- ID: {c.id} | Name: '{c.name}' => Products: {p_cnt}, Invoices: {i_cnt}, Customers: {c_cnt}")

if __name__ == "__main__":
    asyncio.run(main())
