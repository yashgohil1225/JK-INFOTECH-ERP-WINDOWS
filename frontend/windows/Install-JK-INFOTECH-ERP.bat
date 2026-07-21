@echo off
TITLE Installing JK INFOTECH ERP...
CD /D "%~dp0"

:: 1. Auto Self-Elevate Batch to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator Privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ====================================================
echo        LAUNCHING JK INFOTECH ERP INSTALLER
echo ====================================================
echo.

:: 2. Launch PowerShell installer script with ExecutionPolicy Bypass and NoExit
powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-JK-INFOTECH-ERP.ps1"

echo.
echo ====================================================
echo Press any key to exit...
echo ====================================================
pause >nul
