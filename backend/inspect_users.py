import asyncio
from app.database import AsyncSessionLocal
from app.models import User, Company
from sqlalchemy import select

async def inspect():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        print("\n=== ALL USERS IN DATABASE ===")
        for u in users:
            co = await db.get(Company, u.company_id) if u.company_id else None
            co_name = co.name if co else "NO COMPANY"
            co_active = co.is_active if co else "N/A"
            print(f"User ID: {u.id} | Email: {u.email} | Phone: {u.phone} | Active: {u.is_active} | Company: '{co_name}' (ID: {u.company_id}, Active: {co_active}) | Last Login: {u.last_login}")

if __name__ == "__main__":
    asyncio.run(inspect())
