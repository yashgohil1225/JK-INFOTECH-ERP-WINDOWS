import asyncio
from app.database import AsyncSessionLocal
from app.models import Company, User, CompanyUser
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Company))
        companies = res.scalars().all()
        print(f"TOTAL COMPANIES IN DB: {len(companies)}")
        for c in companies:
            print(f"- Company ID: {c.id} | Name: {c.name} | Legal Name: {c.legal_name} | Active: {c.is_active}")

        res2 = await db.execute(select(User))
        users = res2.scalars().all()
        print(f"\nTOTAL USERS IN DB: {len(users)}")
        for u in users:
            print(f"- User ID: {u.id} | Name: {u.full_name} | Phone: {u.phone} | Email: {u.email} | Superuser: {u.is_superuser}")

        res3 = await db.execute(select(CompanyUser))
        cu_links = res3.scalars().all()
        print(f"\nTOTAL COMPANY_USER MAPPINGS: {len(cu_links)}")
        for link in cu_links:
            print(f"- User ID: {link.user_id} -> Company ID: {link.company_id} (Role: {link.role})")

if __name__ == "__main__":
    asyncio.run(main())
