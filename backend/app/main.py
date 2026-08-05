import sys
import asyncio

if sys.platform == 'win32':
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception as e:
        print(f"Failed to set ProactorEventLoopPolicy: {e}")

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Request, Response
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database import sync_engine
from app.models import Base
from fastapi.exceptions import RequestValidationError, ResponseValidationError  # pyrefly: ignore [missing-import]
from app.routers import auth, license, inventory, sales, purchase, banking, dashboard, analytics, parties, companies, sequences, audit, support, barcode, reports, search, backup, reports_share, system_update
from app.routers.companies import utils_router as companies_utils_router


from fastapi.openapi.docs import get_swagger_ui_html  # pyrefly: ignore [missing-import]

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url=None, # Disable default to override CDN
    redoc_url="/redoc",
)

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js",
        swagger_css_url="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.9.0/swagger-ui.css",
    )

@app.on_event("startup")
async def startup_event():
    # ── Playwright Browser Auto-Setup ──────────────────────────
    # Checks if Chromium is present on the client's PC and silently
    # installs it in the background if missing without blocking startup.
    def install_browsers():
        try:
            import os
            local_appdata = os.environ.get("LOCALAPPDATA")
            if local_appdata:
                os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.join(local_appdata, "ms-playwright")
            
            ms_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
            if ms_path and os.path.isdir(ms_path) and any("chromium" in d.lower() for d in os.listdir(ms_path)):
                print("JK ERP: Playwright Chromium browser already installed.")
                app.state.chromium_ready = True
                return

            print("JK ERP: Initiating background Playwright Chromium browser setup...")
            app.state.chromium_ready = False
            # pyrefly: ignore [missing-import]
            from playwright.cli.main import main as playwright_main
            try:
                playwright_main(["install", "chromium"])
                print("JK ERP: Playwright Chromium installation complete.")
                app.state.chromium_ready = True
            except SystemExit:
                app.state.chromium_ready = True
        except Exception as e:
            print(f"JK ERP: Playwright browser check exception: {e}")
            app.state.chromium_ready = False

    app.state.chromium_ready = False
    import threading
    threading.Thread(target=install_browsers, daemon=True, name="chromium-installer").start()

    # Industrial Protocol: Ensure all table schemas are synchronized in a background thread
    print("JK ERP: Synchronizing Database Schema...")
    def run_sync_db_setup():
        import time
        max_retries = 25
        for attempt in range(1, max_retries + 1):
            try:
                with sync_engine.connect() as conn:
                    pass
                Base.metadata.create_all(bind=sync_engine)
                print("JK ERP: Schema Synchronization Complete.")
                break
            except Exception as e:
                if attempt == max_retries:
                    raise e
                print(f"JK ERP: Database system is starting up... retrying connection ({attempt}/{max_retries})")
                time.sleep(2)

    await asyncio.to_thread(run_sync_db_setup)

    # ── Self-Healing Column Migration (Async) ───────────────────
    # Detects columns that exist in ORM models but are missing from
    # the actual PostgreSQL tables, and adds them via ALTER TABLE.
    try:
        from sqlalchemy import text
        _expected_columns = {
            "companies": {
                "legal_name":           "VARCHAR(255)",
                "default_hsn_sac_code": "VARCHAR(50)",
                "default_gst_rate":     "NUMERIC(15,2)",
                "default_tax_rate":     "FLOAT",
                "current_fy_id":        "CHAR(36)",
            },
            "fiscal_years": {
                "company_id":    "CHAR(36)",
                "label":         "VARCHAR(50)",
                "start_date":    "DATE",
                "end_date":      "DATE",
                "is_active":     "INTEGER DEFAULT 1",
                "closed_at":     "DATETIME",
                "closing_notes": "TEXT",
            },
            "customers": {
                "default_tax_rate": "FLOAT",
            },
            "suppliers": {
                "default_tax_rate": "FLOAT",
            },
            "purchase_order_items": {
                "product_name": "VARCHAR(255)",
                "product_sku":  "VARCHAR(100)",
            },
            "sales_order_items": {
                "product_name": "VARCHAR(255)",
                "product_sku":  "VARCHAR(100)",
            },
            "purchase_bills": {
                "cgst_amount": "NUMERIC(15,2) DEFAULT 0",
                "sgst_amount": "NUMERIC(15,2) DEFAULT 0",
                "igst_amount": "NUMERIC(15,2) DEFAULT 0",
            },
            "invoices": {
                "rounding_method":  "VARCHAR(50) DEFAULT 'normal'",
                "cgst_amount":      "NUMERIC(15,2) DEFAULT 0",
                "sgst_amount":      "NUMERIC(15,2) DEFAULT 0",
                "igst_amount":      "NUMERIC(15,2) DEFAULT 0",
                "round_off_amount": "NUMERIC(15,2) DEFAULT 0",
            },
            "invoice_items": {
                "note": "TEXT",
            },
            "payments": {
                "tds_amount": "NUMERIC(15,2) DEFAULT 0",
            },
            "products": {
                "is_active": "BOOLEAN DEFAULT TRUE",
            },
        }


        from app.database import async_engine
        if async_engine is not None:
            async with async_engine.connect() as conn:
                for table_name, columns in _expected_columns.items():
                    for col_name, col_type in columns.items():
                        try:
                            await conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col_name}" {col_type}'))
                            await conn.commit()
                            print(f"JK ERP: Auto-migrated missing column: {table_name}.{col_name}")
                        except Exception as e:
                            await conn.rollback()
                            pass
            print("JK ERP: Column integrity check passed.")
    except Exception as e:
        print(f"JK ERP: Column migration check skipped: {e}")

    # Seed document sequences for any company that has none yet
    try:
        from app.database import AsyncSessionLocal as async_session_factory
        from app.models import Company, DocumentSequence
        from app.services.seed_sequences import seed_default_sequences_for_company
        from sqlalchemy import select, func  # pyrefly: ignore [missing-import]
        async with async_session_factory() as db:
            companies = (await db.execute(select(Company))).scalars().all()
            for company in companies:
                count = (await db.execute(
                    select(func.count()).where(DocumentSequence.company_id == company.id)
                )).scalar_one()
                if count == 0:
                    await seed_default_sequences_for_company(db, company.id)
            await db.commit()
        print("JK ERP: Document Sequences Initialized.")
    except Exception as e:
        print(f"JK ERP: Sequence seeding skipped: {e}")

    try:
        with open("diagnostic_secret.txt", "w", encoding="utf-8") as f:
            f.write(settings.SECRET_KEY)
    except Exception as e:
        print(f"Failed to write diagnostic_secret.txt: {e}")

    # Industrial Protocol: Hardware Binding & Integrity Check
    from app.middleware.security_guard import check_system_integrity
    await check_system_integrity(app)
    if getattr(app.state, "frozen", False):
        print(f"JK ERP: SYSTEM FROZEN. Reason: {app.state.freeze_reason}")
    else:
        print("JK ERP: SYSTEM ACTIVATED. Hardware bound successfully.")

    # Launch Auto-Backup Background Scheduler Task
    try:
        from app.services.auto_backup_service import start_auto_backup_scheduler
        asyncio.create_task(start_auto_backup_scheduler())
        print("JK ERP: Auto-Backup & Cloud Sync Scheduler initialized.")
    except Exception as backup_err:
        print(f"JK ERP: Auto-Backup Scheduler initialization failed: {backup_err}")

@app.on_event("shutdown")
async def shutdown_event():
    from app.core.redis import cache_manager
    await cache_manager.close()


# --- Security: Rate Limiting ---
from slowapi import _rate_limit_exceeded_handler  # pyrefly: ignore [missing-import]
from slowapi.errors import RateLimitExceeded  # pyrefly: ignore [missing-import]
from slowapi.middleware import SlowAPIMiddleware  # pyrefly: ignore [missing-import]
from app.core.limiter import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# --- Security: HTTP Headers Middleware ---
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if "X-Powered-By" in response.headers:
        del response.headers["X-Powered-By"]
    return response

# --- Security: Global Error Handler ---
import logging
from fastapi import status  # pyrefly: ignore [missing-import]

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full stack trace server-side only
    logger.exception(f"Unhandled exception during request {request.method} {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Something went wrong. Internal server error."},
    )


@app.middleware("http")
async def security_guard_middleware(request: Request, call_next):
    # Dynamic active expiration check
    expires_at = getattr(request.app.state, "license_expires_at", None)
    if not getattr(request.app.state, "frozen", False) and expires_at and expires_at != "lifetime":
        from app.middleware.security_guard import get_trusted_time
        from datetime import datetime
        try:
            current_time = get_trusted_time()
            exp_date = datetime.fromisoformat(expires_at)
            if current_time > exp_date:
                request.app.state.frozen = True
                request.app.state.freeze_reason = "MEMBERSHIP_EXPIRED"
        except Exception:
            pass

    # Check if the system is frozen (HWID mismatch or unregistered or expired)
    frozen = getattr(request.app.state, "frozen", False)
    
    # Allow license check, activation, docs, and root endpoints through
    path = request.url.path
    if frozen and path.startswith("/api/") and not (path.startswith("/api/v1/license") or path.startswith("/api/license")):
        return JSONResponse(
            status_code=451,
            content={
                "detail": "System is frozen due to hardware ID mismatch or missing activation.",
                "reason": getattr(request.app.state, "freeze_reason", "UNKNOWN")
            }
        )
    return await call_next(request)

@app.middleware("http")
async def api_versioning_middleware(request: Request, call_next):
    # Transparently route old /api/ requests to the new /api/v1/ endpoints
    if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/v1/"):
        request.scope["path"] = request.scope["path"].replace("/api/", "/api/v1/", 1)
    return await call_next(request)

# CORS Whitelist — includes both HTTP and HTTPS variants for dev (Vite) and prod
_default_origins = [
    "http://localhost:5173",
    "https://localhost:5173",   # Vite HTTPS dev server
    "http://127.0.0.1:5173",
    "https://127.0.0.1:5173",
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
    "https://127.0.0.1:3000",
    "capacitor://localhost",    # Capacitor mobile app origin
    "http://localhost",         # Capacitor Web View fallback origin
    "https://localhost",        # Capacitor Android https scheme origin
]

# Dynamically add local network IPs so mobile devices on LAN are allowed
try:
    import socket as _socket
    _s = _socket.socket(_socket.AF_INET, _socket.SOCK_DGRAM)
    _s.connect(("10.255.255.255", 1))
    _local_ip = _s.getsockname()[0]
    _s.close()
    # Allow both HTTP and HTTPS on the detected local network IP (Vite port 5173)
    _default_origins += [
        f"http://{_local_ip}:5173",
        f"https://{_local_ip}:5173",
        f"http://{_local_ip}:3000",
        f"https://{_local_ip}:3000",
    ]
except Exception:
    pass

if hasattr(settings, "ALLOWED_ORIGINS"):
    _default_origins.extend(settings.ALLOWED_ORIGINS)
CORS_ORIGINS = list(set(_default_origins))

import re

def get_cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin")
    if origin and (origin in CORS_ORIGINS or re.match(r"^https://.*\.vercel\.app$", origin)):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log validation details for industrial debugging
    from datetime import datetime
    try:
        with open("error.log", "a", encoding="utf-8") as f:
            f.write(f"\n--- VALIDATION_ERROR at {datetime.now()} ---\n")
            f.write(f"Errors: {exc.errors()}\n")
            f.write(f"Body: {str(exc.body)}\n")
            f.write("-" * 50 + "\n")
    except:
        pass
    print(f"VALIDATION ERROR: {exc.errors()}")
    
    body_repr = str(exc.body) if exc.body is not None else None
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": body_repr},
        headers=get_cors_headers(request)
    )

from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.exception_handler(ResponseValidationError)
async def response_validation_exception_handler(request: Request, exc: ResponseValidationError):
    """
    Catches MissingGreenlet / lazy-load errors during response serialization.
    This happens when a route returns an ORM object whose relationships were not
    eagerly loaded. We return a clear 500 so the frontend shows a helpful message.
    """
    import traceback
    from datetime import datetime
    error_trace = traceback.format_exc()
    try:
        with open("error.log", "a", encoding="utf-8") as f:
            f.write(f"\n--- RESPONSE_VALIDATION_ERROR at {datetime.now()} ---\n")
            f.write(f"URL: {request.url}\n")
            f.write(f"Error: {str(exc)}\n")
            f.write("-" * 50 + "\n")
    except:
        pass
    return JSONResponse(
        status_code=500,
        content={"detail": "Response serialization error. The record was saved successfully."},
        headers=get_cors_headers(request)
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    from datetime import datetime
    error_trace = traceback.format_exc()
    
    # Industrial Diagnostic: Record full crash report to local storage
    try:
        with open("error.log", "a", encoding="utf-8") as f:
            f.write(f"\n--- REVENUE_EVENT_FAILURE at {datetime.now()} ---\n")
            f.write(f"Error: {str(exc)}\n")
            f.write(f"Traceback:\n{error_trace}\n")
            f.write("-" * 50 + "\n")
    except:
        pass

    print(f"GLOBAL ERROR: {str(exc)}\n{error_trace}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error", 
            "error": str(exc),
            "traceback": error_trace
        },
        headers=get_cors_headers(request)
    )


# Register Routers
app.include_router(auth.router)
app.include_router(license.router)
app.include_router(inventory.router)
app.include_router(barcode.router)

app.include_router(sales.router)
app.include_router(purchase.router)
app.include_router(banking.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(parties.router)
app.include_router(companies.router)
app.include_router(companies_utils_router)
app.include_router(sequences.router)
app.include_router(audit.router)
app.include_router(support.router)
app.include_router(reports.router)
app.include_router(reports_share.router)
app.include_router(search.router)
app.include_router(backup.router)
app.include_router(system_update.router)


@app.get("/favicon.ico", include_in_schema=False)           
async def favicon():
    return Response(status_code=204)

@app.get("/")
async def root():
    return {"message": "JK Infotech ERP - Backend API Engine (Pure CSS Scope Loaded) is running", "version": settings.APP_VERSION}

@app.get("/health")
async def health():
    return {"status": "healthy"}