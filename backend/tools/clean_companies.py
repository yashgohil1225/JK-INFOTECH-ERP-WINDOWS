import asyncio
from app.database import AsyncSessionLocal
from app.models import Company
from sqlalchemy import select, text

async def main():
    async with AsyncSessionLocal() as db:
        # 1. Target company containing all data (ID: 8780cc28-b303-4bff-8835-1161b348b482)
        target_id = '8780cc28-b303-4bff-8835-1161b348b482'
        
        # Rename the main company
        res = await db.execute(select(Company).where(Company.id == target_id))
        main_co = res.scalar_one()
        main_co.name = "GOHIL UPENDRABHAI KAINAIYALAL"
        main_co.is_active = True
        db.add(main_co)
        
        # Delete unused dummy companies
        other_ids = [
            '4fe73c3e-bebd-48b1-892d-d2eedb27ec44',
            'c2b88db7-6ba5-4f19-880d-29b19ede1564',
            'ec4a5a9d-7670-43b8-b086-4a68beecbaee'
        ]
        
        for cid in other_ids:
            # Delete any foreign key references first if any exist
            await db.execute(text(f"DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE company_id = '{cid}')"))
            await db.execute(text(f"DELETE FROM users WHERE company_id = '{cid}'"))
            await db.execute(text(f"DELETE FROM document_sequences WHERE company_id = '{cid}'"))
            await db.execute(text(f"DELETE FROM accounts WHERE company_id = '{cid}'"))
            await db.execute(text(f"DELETE FROM product_categories WHERE company_id = '{cid}'"))
            await db.execute(text(f"DELETE FROM companies WHERE id = '{cid}'"))
            print(f"Deleted dummy company ID: {cid}")

        await db.commit()
        print("\nCleanup finished! Only 'GOHIL UPENDRABHAI KAINAIYALAL' remains with all data.")

if __name__ == "__main__":
    asyncio.run(main())
