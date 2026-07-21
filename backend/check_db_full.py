import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def check_all_tables():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """))
        tables = [row[0] for row in res.fetchall()]
        print(f"Total Public Tables in PostgreSQL: {len(tables)}\n")
        
        row_counts = {}
        for t in tables:
            c_res = await db.execute(text(f'SELECT COUNT(*) FROM "{t}";'))
            cnt = c_res.scalar()
            row_counts[t] = cnt
            if cnt > 0:
                print(f"  ★ Table '{t}': {cnt} records")
            else:
                print(f"    Table '{t}': 0 records")

if __name__ == "__main__":
    asyncio.run(check_all_tables())
