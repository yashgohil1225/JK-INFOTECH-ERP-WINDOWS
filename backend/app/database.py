# =============================================================
# JK SOLUTION ERP — Database Connection
# File : app/database.py
# =============================================================
#
# Sets up:
#   - Async SQLAlchemy engine (asyncpg driver)
#   - Sync engine  (for Alembic migrations)
#   - get_db()     (FastAPI dependency — use in every route)
# =============================================================

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# ── Configure SQLite connection PRAGMAs for high-speed concurrency ─
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA busy_timeout=30000;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.close()
    except Exception:
        pass

# ── Async engine (used by FastAPI routes) ─────────────────────
# aiosqlite driver: sqlite+aiosqlite:///{app}/sqlite_data/jkerp.db
async_engine = create_async_engine(
    settings.DATABASE_URL_ASYNC,
    echo=settings.DB_ECHO,
    connect_args={
        "timeout": 30.0,
    }
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ── Sync engine (used by setup & migrations) ──────────────────
sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    echo=settings.DB_ECHO,
    connect_args={
        "timeout": 30.0,
    }
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)


# ── FastAPI dependency ────────────────────────────────────────
async def get_db() -> AsyncSession:
    """
    Yield an async DB session.  Use as a FastAPI dependency:

        @router.get("/products")
        async def list_products(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
