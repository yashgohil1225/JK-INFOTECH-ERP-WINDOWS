@echo off
rem =====================================================================
rem JK INFOTECH ERP — Launch Release Version Upgrader GUI
rem File: Y:\JK Infotech ERP\version-upgrader.bat
rem =====================================================================

cd /d "%~dp0"

if exist "backend\venv\Scripts\pythonw.exe" (
    start "" "backend\venv\Scripts\pythonw.exe" "scripts\version_upgrader_gui.py"
) else (
    start "" pythonw "scripts\version_upgrader_gui.py"
)
