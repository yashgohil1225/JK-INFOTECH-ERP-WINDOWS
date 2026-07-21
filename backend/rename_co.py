import asyncio
from app.database import AsyncSessionLocal
from app.models import Company
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Company))
        companies = res.scalars().all()
        for c in companies:
            print(f"Updating company ID {c.id} from '{c.name}' to 'GOHIL UPENDRABHAI KAINAIYALAL'...")
            c.name = "GOHIL UPENDRABHAI KAINAIYALAL"
            c.legal_name = "GOHIL UPENDRABHAI KAINAIYALAL"
            db.add(c)
        await db.commit()
        print("Company name updated successfully!")

if __name__ == "__main__":
    asyncio.run(main())
