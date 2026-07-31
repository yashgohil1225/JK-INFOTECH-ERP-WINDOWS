import asyncio
from app.database import AsyncSessionLocal
from app.models import Company
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Company))
        cos = res.scalars().all()
        print(f"Total Companies Found: {len(cos)}\n")
        for idx, c in enumerate(cos, 1):
            gst = getattr(c, 'gstin', None) or getattr(c, 'gst_number', '-')
            print(f"{idx}. Name: {c.name} | ID: {c.id} | Active: {c.is_active}")

if __name__ == "__main__":
    asyncio.run(main())
