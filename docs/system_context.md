# JK Infotech ERP System Context

This document serves as the comprehensive and authoritative system context for the **JK Infotech ERP** project. It provides full context of the architecture, tech stack, database schema, frontend structure, and key workflows. Use this context to avoid unnecessary re-analyzation of the codebase and to make informed architectural decisions.

## 1. System Overview

**JK Infotech ERP** is an industrial-grade Enterprise Resource Planning system. It features a high-performance backend serving a sleek, highly-animated, "premium" React frontend. The system is designed for multi-tenant (multi-company) use per user, enabling comprehensive management of parties (customers/suppliers), inventory, sales, purchases, banking/capital, and reporting.

## 2. Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database ORM**: SQLAlchemy (Async using `asyncpg`)
- **Database Engine**: PostgreSQL
- **Data Validation**: Pydantic v2
- **Authentication**: JWT (JSON Web Tokens) with Passlib & Bcrypt
- **Migration Tool**: Alembic (uses sync `psycopg2` engine)

### Frontend
- **Framework**: React 18 (TypeScript) with Vite
- **Styling**: Tailwind CSS + Custom CSS (`index.css`)
- **Animations**: Framer Motion
- **Icons**: HugeIcons (`@hugeicons/react`, `@hugeicons/core-free-icons`)
- **State Management**: Zustand (Persisted stores)
- **Routing**: React Router DOM
- **API Client**: Axios (`api/client.ts`)

## 3. Backend Architecture

The backend is structured under `backend/app/`:
- `main.py`: Application entry point. Includes global exception handlers, CORS configuration, and middleware (e.g., API version routing).
- `database.py`: Defines the asynchronous DB engine (`async_engine`), synchronous engine (for Alembic), and the `get_db()` FastAPI dependency.
- `models.py`: Centralized SQLAlchemy declarative models representing the database schema.
- `routers/`: Contains grouped FastAPI routes (e.g., `auth.py`, `sales.py`, `purchase.py`, `inventory.py`, `banking.py`, `reports.py`).
- `schemas/`: Pydantic models for request validation and response serialization.
- `services/`: Encapsulated business logic or third-party service integrations (if any).

## 4. Database Schema Summary (`models.py`)

The application uses an industrial relational schema with UUIDs as primary keys:

- **Auth & Access**: 
  - `User`, `Company`, `Role`, `UserCompanyAccess`
- **Entities**: 
  - `Party` (Customers/Suppliers with GST details, ledgers)
- **Inventory**: 
  - `ItemCategory`, `Item`, `StockTransaction` (FIFO/LIFO tracking), `Warehouse`
- **Sales & Purchase**: 
  - `Invoice`, `InvoiceItem` (Sales)
  - `PurchaseBill`, `PurchaseBillItem` (Purchases)
- **Banking & Capital**:
  - `Account` (Bank/Cash accounts with opening balance and subtypes)
  - `Payment` (Tracks receipts, payments, and capital transfers. Maps to `payments` table)
- **Accounting Engine**:
  - `JournalEntry`, `JournalEntryLine` (Double-entry accounting system)
- **Security & Logging**:
  - `AuditLog`
- **Licensing**:
  - `LicenseLock` (System freezing based on license validity)

## 5. Frontend Architecture

The frontend is structured under `frontend/src/`:
- `App.tsx`: Root component configuring routing (`ProtectedRoute`, `PublicRoute`) and global stores. Handles global License Lock checking and Auth syncing.
- `api/`: API integration layer.
  - `client.ts`: Axios instance with interceptors for attaching JWTs and handling 401s (token refresh/logout).
- `store/`: Zustand state management.
  - `authStore.ts`: Manages user session, selected company, JWT token, and hydration status.
  - `uiStore.ts`: Global UI state (sidebar, dark mode).
  - `licenseStore.ts`: Polls backend for license lock status.
- `components/ui/`: Reusable, highly styled UI components (e.g., `DataTable`, `FilterRibbon`, `ActionMenu`, `ModalComponents`, `FullScreenModal`).
- `web_pages/`: The core views, categorized by feature:
  - `auth/`: Login, Register, Company Selection.
  - `dashboard/`: Main overview with interactive stats.
  - `sales/` & `purchase/`: Invoice and Bill generation, viewing, and settlement.
  - `inventory/`: Item management.
  - `bank_cash/` & `banking/`: Treasury, ledger visualization, and capital transfers.
  - `reports/`: Analytics and financial statements (GST, Profit & Loss).

## 6. Key Workflows & Design Patterns

### Authentication & Multi-Company
1. User logs in -> receives `access_token` and `refresh_token`.
2. Must select an active `Company` via `/select-company` before accessing the dashboard.
3. Every API request passes the JWT (for User) and the `Company-ID` header (via `get_current_company` dependency) to scope data strictly to the selected company.

### Dynamic Balances (Banking)
Balances in the Banking and Bank/Cash pages are computed dynamically on the frontend by aggregating the `opening_balance` from the `Account` models and the net `amount` of standard `Payment` models (filtered by `CASH` or `BANK`). Journal entry payments are excluded from dynamic summation to prevent double-counting.

### Industrial UI Design
The frontend heavily utilizes deep blacks, muted slates, and vivid accent colors (Emerald, Rose, Indigo) to represent financial data. Modals frequently use `FullScreenModal` (with standard or `compact` variants) providing spring-animated entries. Tables (`DataTable`) are highly customized with skeleton loaders and status badges.

## 7. Known Nuances / "Gotchas"
- **API Versioning**: `main.py` has a middleware that transparently reroutes `/api/` calls to `/api/v1/`.
- **Loading States**: Always ensure `setLoading(false)` is present in `finally` blocks when fetching data to prevent infinite skeleton loaders.
- **Table Naming**: The backend SQLAlchemy model is `Payment`, but the table name is `payments`.
- **Double-Entry Engine**: Manual capital transfers create robust `JournalEntry` and `JournalEntryLine` records, along with a "shadow" `Payment` record for ledger visibility.
