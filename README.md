# JK INFOTECH ERP — Industrial Monorepo

Welcome to the **JK Infotech ERP** project. This repository is structured as a unified full-stack monorepo containing the FastAPI backend, the React Native Windows desktop client, and embedded PostgreSQL database configurations.

## Directory Structure

```
y:\JK Infotech ERP (Workspace Root)
├── backend/                  # FastAPI Python backend application
│   ├── app/                  # Application source (routers, models, schemas)
│   ├── alembic/              # Database migration scripts
│   ├── requirements.txt      # Python dependencies
│   └── run.py                # Backend entrypoint script
├── frontend/                 # React Native Windows desktop application
│   ├── src/                  # React Native TSX components, screens, & stores
│   ├── windows/              # Native UWP application solution & configurations
│   └── package.json          # Node dependencies and scripts
├── pgsql/                    # Embedded PostgreSQL database engine binaries
├── docs/                     # Documentation files & context (system_context.md)
├── JK INFOTECH branding/     # Standard brand asset package (monogram, logo, SVGs)
├── .agents/                  # Workspace-specific custom AI assistant instructions
├── .gitignore                # Global gitignore configuration
├── setup.iss                 # Inno Setup installation compiler configuration
├── start-jk-erp.bat          # Main local launch script
└── build-all.bat             # Release compiler build script
```

---

## Getting Started

### 1. Prerequisites
Ensure you have the following installed on your Windows machine:
- **Node.js** (v22.11.0 or higher recommended)
- **Python** (v3.11 or higher)
- **Visual Studio 2022** (with "Desktop development with C++" and "Universal Windows Platform development" workloads installed)
- **PostgreSQL 15** (if running via Docker or external service)

### 2. Local Launch (All Services)
Simply double-click or run the startup script at the root:
```cmd
start-jk-erp.bat
```
This script automates:
1. Initializing and launching the embedded PostgreSQL database cluster.
2. Launching the FastAPI backend server (via custom virtual environment or compiled run.exe).
3. Activating the local Redis cache.
4. Launching the Windows UWP client application.

---

## Technical Stack & Configuration

### Backend
- **Framework:** FastAPI (Python)
- **ORM:** SQLAlchemy (Async via `asyncpg`)
- **Database Engine:** PostgreSQL
- **Migration Engine:** Alembic
- **Schemas:** Pydantic v2

### Frontend
- **Framework:** React Native Windows (v0.75+)
- **State Management:** Zustand
- **API Client:** Axios
- **Database Wrapper:** React Native Async Storage

---

## Compiling & Packaging Releases

To compile both the Python backend and package the Windows UWP application for distribution, run the build script at the root:
```cmd
build-all.bat
```

This compiles:
1. The FastAPI backend into a single executable using PyInstaller.
2. The UWP client application in Release configuration.
3. Packages the release binaries inside the Inno Setup compiler using `setup.iss`.

---

## License & Branding
All brand marks, vector assets, and monogram assets reside under `JK INFOTECH branding assests/`. The distribution configuration is managed under Inno Setup (`setup.iss`) with administrative privilege checks for smooth corporate deployments.
