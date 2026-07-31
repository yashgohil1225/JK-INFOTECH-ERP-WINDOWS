import asyncio
from app.database import AsyncSessionLocal
from app.models import Company
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Company))
        cos = res.scalars().all()
        for c in cos:
            c.is_active = True
            if c.name == "yash gohil":
                c.name = "GOHIL UPENDRABHAI KAINAIYALAL"
            db.add(c)
        await db.commit()
        print("Updated all companies to active = True and renamed 'yash gohil' -> 'GOHIL UPENDRABHAI KAINAIYALAL'")

if __name__ == "__main__":
    asyncio.run(main())
