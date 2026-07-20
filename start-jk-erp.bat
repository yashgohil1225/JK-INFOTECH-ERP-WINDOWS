@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo [1/3] STARTING EMBEDDED POSTGRESQL DATABASE SERVICE...
echo ========================================================
set PG_DIR=%~dp0pgsql
set PG_DATA=%~dp0pg_data

:: Check if the database data folder is initialized. If not, initialize it.
if not exist "!PG_DATA!" (
    echo Initializing database cluster at !PG_DATA!...
    "!PG_DIR!\bin\initdb.exe" -D "!PG_DATA!" -U postgres --auth-host=scram-sha-256 --auth-local=scram-sha-256
    
    echo Starting database temporarily to create database 'jk_erp'...
    start /B "" "!PG_DIR!\bin\pg_ctl.exe" -D "!PG_DATA!" start
    timeout /t 5 >nul
    
    echo Creating database 'jk_erp'...
    "!PG_DIR!\bin\createdb.exe" -U postgres -h localhost jk_erp
    
    echo Stopping temporary service...
    "!PG_DIR!\bin\pg_ctl.exe" -D "!PG_DATA!" stop
)

:: Start PostgreSQL
start /B "" "!PG_DIR!\bin\pg_ctl.exe" -D "!PG_DATA!" -l "!PG_DATA!\pg_log.txt" start

echo ========================================================
echo [2/3] STARTING REDIS CACHE ENGINE...
echo ========================================================
set REDIS_DIR=%~dp0redis
if exist "!REDIS_DIR!\redis-server.exe" (
    start /B "" "!REDIS_DIR!\redis-server.exe" --port 6379
) else (
    echo [WARNING] Embedded redis-server.exe not found. Ensuring service port 6379 is accessible.
)

echo ========================================================
echo [3/3] STARTING FASTAPI PYTHON BACKEND...
echo ========================================================
set BACKEND_DIR=%~dp0backend
if exist "!BACKEND_DIR!\run.exe" (
    cd /d "!BACKEND_DIR!"
    start "" "run.exe"
) else (
    cd /d "!BACKEND_DIR!"
    start "" cmd /k "call venv\Scripts\activate && python run.py"
)

echo ========================================================
echo ALL SERVICES INITIATED! Launching UWP Client App...
echo ========================================================
:: Launch the UWP React Native app using the protocol extension we registered
start jkerpwindows://

echo Startup sequence finished. Keep this window open to maintain database services.
echo To shut down database services safely, close this window.
pause

echo Shutting down database...
"!PG_DIR!\bin\pg_ctl.exe" -D "!PG_DATA!" stop
exit
