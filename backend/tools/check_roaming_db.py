import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:jkerp_password_2026@127.0.0.1:5433/jk_erp"

async def check_roaming_db():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        res = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """))
        tables = [row[0] for row in res.fetchall()]
        print(f"Total Public Tables in Roaming DB (port 5433): {len(tables)}\n")
        
        for t in tables:
            c_res = await db.execute(text(f'SELECT COUNT(*) FROM "{t}";'))
            cnt = c_res.scalar()
            if cnt > 0:
                print(f"  ★ Table '{t}': {cnt} records")
            else:
                print(f"    Table '{t}': 0 records")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_roaming_db())
