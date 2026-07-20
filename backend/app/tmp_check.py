import asyncio
from app.database import AsyncSessionLocal
from app.models import Account
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Account))
        accounts = r = result.scalars().all()
        for a in accounts:
            print(a.id, a.name, a.account_type, a.account_subtype, a.account_code)

if __name__ == "__main__":
    asyncio.run(main())
