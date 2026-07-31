import asyncio
from app.database import AsyncSessionLocal
from app.models import User
from app.core.security import verify_password
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.email == "admin@jkerp.local")
        result = await db.execute(stmt)
        u = result.scalar_one_or_none()
        if u:
            print("User found:", u.email)
            print("Is 000000 correct?", verify_password("000000", u.pin_hash))
            u.failed_pin_attempts = 0
            u.pin_locked_until = None
            await db.commit()
            print("Successfully reset failed attempts and unlocked account in DB!")

if __name__ == "__main__":
    asyncio.run(main())
