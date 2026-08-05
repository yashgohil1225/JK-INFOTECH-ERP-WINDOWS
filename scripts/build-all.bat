@echo off
echo ===================================================
echo [1/2] BUILDING PYTHON BACKEND (PyInstaller)...
echo ===================================================
cd backend
if exist "venv\Scripts\activate" (
    call venv\Scripts\activate
    pyinstaller --noconfirm backend.spec
    call deactivate
) else (
    echo [ERROR] Python virtual environment (venv) not found in backend directory.
)
cd ..

echo ===================================================
echo [2/2] BUILDING WINDOWS UWP APP (Release Mode)...
echo ===================================================
cd frontend
echo Running react-native run-windows in Release mode...
call npx react-native run-windows --logging --release
cd ..

echo ===================================================
echo BUILD COMPLETE!
echo ===================================================
pause
