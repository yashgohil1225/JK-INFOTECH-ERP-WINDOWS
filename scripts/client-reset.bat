@echo off
title JK INFOTECH ERP - Clean Client Reset Utility
pushd "%~dp0"

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ====================================================
    echo ATTENTION: ADMINISTRATOR PRIVILEGES REQUIRED!
    echo Elevating privileges automatically...
    echo ====================================================
    powershell -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~dp0reset-fresh-client.ps1\"\"' -Verb RunAs"
    exit /b
)

echo ====================================================
echo JK INFOTECH ERP - Resetting Client PC to Clean State
echo ====================================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0reset-fresh-client.ps1"

echo.
popd
pause
