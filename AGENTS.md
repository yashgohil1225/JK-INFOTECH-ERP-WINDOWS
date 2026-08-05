# JK INFOTECH ERP — Core System Locking & Upgrade Safety Standard

This document establishes **immutable architectural guards** for `JK INFOTECH ERP` to guarantee 100% upgrade consistency, zero client data loss, zero UI pop-up errors, and zero PDF rendering failures across all client machines.

---

## 1. Database Location & Upgrade Safety Guard (`pg_data`)

* **Immutable Master Directory:** `{app}\pg_data` (`C:\Program Files\JK Infotech ERP\pg_data`) is the SINGLE authorized database location for all production client installations.
* **Auto-Migration Priority (`scripts/migrate-db.ps1`):** During setup or updates on existing client PCs, `setup.iss` invokes `migrate-db.ps1` before service startup. It checks legacy directories in order of priority:
  1. `%APPDATA%\jk-erp-frontend\data`
  2. `%APPDATA%\frontend\data`
  If a legacy database is detected and `{app}\pg_data\PG_VERSION` is absent, it automatically migrates all data into `{app}\pg_data`.
* **Zero Data Loss Rule:** `setup.iss` evaluates `NotDataDirExists` (`FileExists('{app}\pg_data\PG_VERSION')`). `initdb.exe` is **NEVER** run if `{app}\pg_data` exists. Existing client databases must never be overwritten, re-initialized, or reset.

---

## 2. Self-Healing Schema & Column Migration (`backend/app/main.py`)

* **Automatic Schema Synchronization:** `main.py` maintains an explicit `_expected_columns` dictionary mapping table names to required column definitions.
* **Startup Self-Healing:** On startup, `main.py` inspects PostgreSQL tables and executes `ALTER TABLE "<table_name>" ADD COLUMN IF NOT EXISTS "<column_name>" <type>` for all required fields.
* **Zero UndefinedColumn Errors:** Whenever an ORM model field is added or modified in `app/models.py`, its entry **MUST** be added to `_expected_columns` in `main.py` so upgrading clients auto-heal on startup without manual SQL commands.

---

## 3. Dual PDF Rendering Engine (Zero-Failure Guarantee)

* **Primary Engine:** Playwright Chromium HTML-to-PDF (`_generate_pdf_async`).
* **Fail-Safe Engine:** ReportLab Native PDF Generator (`_generate_reportlab_invoice_pdf`).
* **Zero HTTP 500 Rule:** In [backend/app/services/reports.py](file:///y:/JK%20Infotech%20ERP/backend/app/services/reports.py), if Chromium is missing, downloading, or fails to launch, `generate_invoice_pdf` catches the exception and immediately falls back to ReportLab. PDF generation **MUST NEVER** raise HTTP 500 or crash the client preview modal.

---

## 4. Silent Launcher & Process Ordering (`launcher.vbs`)

* **Strict Dependency Startup Sequence:**
  1. `net start JK_Infotech_PostgreSQL` (Database)
  2. `net start JK_Infotech_Redis` (Cache)
  3. `backend.exe` (FastAPI Server)
  4. `powershell.exe -WindowStyle Hidden` (Silent Package Discovery & UI Launch)
* **Zero Pop-up Errors:** `launcher.vbs` uses dynamic PowerShell package resolution (`Get-AppxPackage *9428b0f2...`) instead of hardcoded certificate AUMID hashes. Windows shell error dialogs (`"Windows cannot find..."`) are strictly prohibited.

---

## 5. Client Cleanliness & Security Safeguards

* **Developer Tools Purged:** Internal developer scripts (`key_generator_gui.py`, `Generate License Key.lnk`, `build-release-package.ps1`, `version_upgrader_gui.py`, `reset-fresh-client.*`) are excluded from `{app}\scripts` and auto-deleted from existing client PCs upon setup via `[InstallDelete]` rules in `setup.iss`.
* **Runtime Script Lockdown:** `{app}\scripts` contains ONLY runtime helper scripts: `tune-redis.ps1`, `sideload.ps1`, and `migrate-db.ps1`.

---

## 6. One-Command Build Pipeline (`build-release-package.ps1`)

* All production release builds must be executed via `build-release-package.ps1`:
  - Enforces synchronized versioning across `Package.appxmanifest`, `package.json`, and `setup.iss`.
  - Rebuilds MSBuild React Native Windows UWP bundle (`JKErpWindows_<version>_x64_Test`).
  - Rebuilds `backend.exe` executable with PyInstaller.
  - Compiles Inno Setup installer (`JK_Infotech_ERP_Setup_v<version>.exe`).
