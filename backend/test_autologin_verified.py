import asyncio
from app.database import AsyncSessionLocal
from app.services.auth import AuthService

async def run():
    async with AsyncSessionLocal() as db:
        res = await AuthService(db).local_auto_login()
        print("==================================================")
        print("AUTO LOGIN RESOLVED COMPANY NAME:", res.company.name)
        print("AUTO LOGIN RESOLVED COMPANY ID  :", res.company.id)
        print("AUTO LOGIN RESOLVED IS_ACTIVE   :", res.company.is_active)
        print("AUTO LOGIN RESOLVED USER EMAIL  :", res.user.email)
        print("==================================================")

if __name__ == "__main__":
    asyncio.run(run())
