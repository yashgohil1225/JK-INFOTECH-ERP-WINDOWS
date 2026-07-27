# =============================================================
# JK INFOTECT ERP — App Configuration
# File : app/core/config.py
# =============================================================
#
# All settings are read from environment variables (or .env file).
# Never hardcode secrets in this file.
#
# Create a .env file in your project root:
#
#   DATABASE_HOST=localhost
#   DATABASE_PORT=5432
#   DATABASE_NAME=jk_erp
#   DATABASE_USER=postgres
#   DATABASE_PASSWORD=your_secret_password
#   SECRET_KEY=your_jwt_secret_key_min_32_chars
#   ENVIRONMENT=development
# =============================================================

from pydantic_settings import BaseSettings, SettingsConfigDict
import logging
from urllib.parse import quote_plus

# Setup basic logging
logging.basicConfig(level=logging.INFO)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── App ──────────────────────────────────────────────────
    APP_NAME: str       = "JK INFOTECT ERP"
    APP_VERSION: str    = "1.0.0"
    ENVIRONMENT: str    = "development"   # development | staging | production
    DEBUG: bool         = True

    # ── Database ─────────────────────────────────────────────
    DATABASE_HOST: str  = "localhost"
    DATABASE_PORT: int  = 5432
    DATABASE_NAME: str  = "jk_erp"
    DATABASE_USER: str  = "postgres"
    DATABASE_PASSWORD: str = "jkerp_password_2026"
    DB_ECHO: bool       = False           # set True to log SQL queries

    @property
    def DATABASE_URL_ASYNC(self) -> str:
        """asyncpg URL — used by FastAPI routes."""
        user = quote_plus(self.DATABASE_USER)
        password = quote_plus(self.DATABASE_PASSWORD)
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """psycopg2 URL — used by Alembic only."""
        user = quote_plus(self.DATABASE_USER)
        password = quote_plus(self.DATABASE_PASSWORD)
        return (
            f"postgresql://{user}:{password}"
            f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
        )


    # ── JWT Auth ─────────────────────────────────────────────
    SECRET_KEY: str         = "change-this-to-a-long-random-secret-key-min-32-chars"
    ALGORITHM: str          = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int   = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int     = 30

    # ── CORS ─────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # ── File uploads ─────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 10
    AWS_S3_BUCKET: str      = ""
    AWS_ACCESS_KEY: str     = ""
    AWS_SECRET_KEY: str     = ""
    AWS_REGION: str         = "ap-south-1"   # Mumbai

    # ── Email ────────────────────────────────────────────────
    RESEND_API_KEY: str     = ""
    EMAIL_FROM: str         = "noreply@jkerp.com"

    # ── Twilio OTP ───────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str         = ""
    TWILIO_AUTH_TOKEN: str          = ""
    TWILIO_VERIFY_SERVICE_SID: str  = ""

    GST_API_KEY: str = ""

    # ── Extra Security / Integrations ────────────────────────
    GMAIL_APP_PASSWORD: str = ""
    WHATSAPP_API_KEY: str = ""
    WS_TOKEN: str = ""

    # ── System Integrity & Licensing ────────────────────────
    SYSTEM_MASTER_TOKEN: str = "JKERP-X7M9B-K2Q6P-5D1H2-8W3Y4"
    INTEGRITY_SIGNING_KEY: str = "jk_infotech_erp_secure_key_2026"

    # ── Redis ────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379


# Singleton instance — import this everywhere
settings = Settings()
