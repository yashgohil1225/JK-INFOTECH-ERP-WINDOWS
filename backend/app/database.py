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

# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# ── Async engine (used by FastAPI routes) ─────────────────────
# asyncpg driver: postgresql+asyncpg://user:pass@host:port/dbname
async_engine = create_async_engine(
    settings.DATABASE_URL_ASYNC,
    echo=settings.DB_ECHO,          
    pool_size=20,                   # Increased for higher industrial concurrency
    max_overflow=10,
    pool_recycle=3600,              # Recycle connections every hour
    pool_pre_ping=True,             # Critical: auto-reconnect on stale connections
    connect_args={
        "command_timeout": 30,      # Increased to 30s for complex industrial queries
    }
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ── Sync engine (used by Alembic only) ───────────────────────
# psycopg2 driver: postgresql://user:pass@host:port/dbname
sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    echo=settings.DB_ECHO,
    pool_pre_ping=True,
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
