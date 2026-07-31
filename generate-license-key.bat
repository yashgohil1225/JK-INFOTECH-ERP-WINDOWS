@echo off
title JK INFOTECH ERP - Official License Key Generator

set "GUI_SCRIPT="
if exist "%~dp0scripts\key_generator_gui.py" set "GUI_SCRIPT=%~dp0scripts\key_generator_gui.py"
if not defined GUI_SCRIPT if exist "Y:\JK Infotech ERP\scripts\key_generator_gui.py" set "GUI_SCRIPT=Y:\JK Infotech ERP\scripts\key_generator_gui.py"

if not defined GUI_SCRIPT (
    echo ===================================================
    echo [ERROR] key_generator_gui.py script not found!
    echo ===================================================
    echo.
    pause
    exit /b 1
)

set "PYTHONW_EXE=pythonw.exe"
if exist "%~dp0backend\venv\Scripts\pythonw.exe" set "PYTHONW_EXE=%~dp0backend\venv\Scripts\pythonw.exe"
if exist "Y:\JK Infotech ERP\backend\venv\Scripts\pythonw.exe" set "PYTHONW_EXE=Y:\JK Infotech ERP\backend\venv\Scripts\pythonw.exe"

start "" "%PYTHONW_EXE%" "%GUI_SCRIPT%"
