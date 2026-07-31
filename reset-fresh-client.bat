@echo off
title JK INFOTECH ERP - Reset Fresh Client State

set "PS_SCRIPT="
if exist "%~dp0scripts\reset-fresh-client.ps1" set "PS_SCRIPT=%~dp0scripts\reset-fresh-client.ps1"
if not defined PS_SCRIPT if exist "Y:\JK Infotech ERP\scripts\reset-fresh-client.ps1" set "PS_SCRIPT=Y:\JK Infotech ERP\scripts\reset-fresh-client.ps1"
if not defined PS_SCRIPT if exist "C:\Program Files\JK Infotech ERP\scripts\reset-fresh-client.ps1" set "PS_SCRIPT=C:\Program Files\JK Infotech ERP\scripts\reset-fresh-client.ps1"

if not defined PS_SCRIPT (
    echo ===================================================
    echo [ERROR] reset-fresh-client.ps1 script not found!
    echo Please ensure you are running this from your project
    echo directory or that scripts\reset-fresh-client.ps1 exists.
    echo ===================================================
    echo.
    pause
    exit /b 1
)

echo ===================================================
echo JK INFOTECH ERP - Resetting PC to Fresh Client State
echo ===================================================
echo.

powershell -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

echo.
pause
