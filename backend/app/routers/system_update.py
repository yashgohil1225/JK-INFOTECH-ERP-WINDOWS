# =============================================================
# JK INFOTECH ERP — System Update Router (In-App Auto Update)
# File : app/routers/system_update.py
# =============================================================

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
import os
import sys
import shutil
import zipfile
import urllib.request
import subprocess
import threading
import time

router = APIRouter(
    prefix="/api/v1/system",
    tags=["System Updates"],
)

TEMP_UPDATES_DIR = os.path.join(os.getcwd(), "temp_updates")

# Global Download State Tracker
DOWNLOAD_STATE = {
    "is_downloading": False,
    "progress": 0.0,
    "status": "idle",
    "error": None,
    "local_file": None,
    "version": None
}

class DownloadRequest(BaseModel):
    download_url: str
    version: str

class ApplyUpdateRequest(BaseModel):
    version: str
    installer_path: str | None = None

def _download_task(download_url: str, version: str):
    global DOWNLOAD_STATE
    os.makedirs(TEMP_UPDATES_DIR, exist_ok=True)
    
    DOWNLOAD_STATE["is_downloading"] = True
    DOWNLOAD_STATE["progress"] = 0.0
    DOWNLOAD_STATE["status"] = "downloading"
    DOWNLOAD_STATE["error"] = None
    DOWNLOAD_STATE["local_file"] = None
    DOWNLOAD_STATE["version"] = version

    try:
        req = urllib.request.Request(
            download_url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JK_Infotech_ERP_Updater'}
        )
        
        target_filename = f"JK_Infotech_ERP_Update_v{version}.tmp"
        dest_path = os.path.join(TEMP_UPDATES_DIR, target_filename)

        with urllib.request.urlopen(req) as response, open(dest_path, 'wb') as out_file:
            total_size = int(response.headers.get('Content-Length', 0))
            bytes_downloaded = 0
            chunk_size = 128 * 1024  # 128 KB chunks

            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                out_file.write(chunk)
                bytes_downloaded += len(chunk)
                
                if total_size > 0:
                    pct = round((bytes_downloaded / total_size) * 100, 1)
                    DOWNLOAD_STATE["progress"] = min(pct, 99.0)

        # Handle downloaded file format (.zip vs .exe)
        final_installer = None
        if dest_path.endswith('.zip') or zipfile.is_zipfile(dest_path):
            DOWNLOAD_STATE["status"] = "extracting"
            extract_dir = os.path.join(TEMP_UPDATES_DIR, f"v{version}")
            os.makedirs(extract_dir, exist_ok=True)
            with zipfile.ZipFile(dest_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # Find setup exe in extracted files
            for root, dirs, files in os.walk(extract_dir):
                for f in files:
                    if f.endswith('.exe') and ('Setup' in f or 'JK' in f):
                        final_installer = os.path.join(root, f)
                        break
            if not final_installer:
                # If no setup.exe inside zip, fallback to extract dir
                final_installer = dest_path
        else:
            final_installer_path = os.path.join(TEMP_UPDATES_DIR, f"JK_Infotech_ERP_Setup_v{version}.exe")
            if os.path.exists(final_installer_path):
                os.remove(final_installer_path)
            os.rename(dest_path, final_installer_path)
            final_installer = final_installer_path

        DOWNLOAD_STATE["progress"] = 100.0
        DOWNLOAD_STATE["status"] = "ready_to_install"
        DOWNLOAD_STATE["local_file"] = final_installer
        DOWNLOAD_STATE["is_downloading"] = False

    except Exception as e:
        DOWNLOAD_STATE["is_downloading"] = False
        DOWNLOAD_STATE["status"] = "failed"
        DOWNLOAD_STATE["error"] = str(e)

@router.post("/download-update")
async def start_download_update(data: DownloadRequest, background_tasks: BackgroundTasks):
    """Triggers an in-app asynchronous download of the release update package."""
    global DOWNLOAD_STATE
    if DOWNLOAD_STATE["is_downloading"]:
        return {"message": "Download already in progress", "state": DOWNLOAD_STATE}
    
    background_tasks.add_task(_download_task, data.download_url, data.version)
    return {"message": "Update download started", "version": data.version}

@router.get("/download-progress")
async def get_download_progress():
    """Returns the current download percentage and installation readiness state."""
    return DOWNLOAD_STATE

@router.post("/apply-update")
async def apply_update(data: ApplyUpdateRequest):
    """Executes the silent software update installer and restarts the application."""
    global DOWNLOAD_STATE
    installer_path = data.installer_path or DOWNLOAD_STATE.get("local_file")
    
    if not installer_path or not os.path.exists(installer_path):
        raise HTTPException(status_code=404, detail="Downloaded update installer package not found.")

    # Create a updater runner script that waits for current app to exit, installs update, and launches desktop app
    script_path = os.path.join(TEMP_UPDATES_DIR, "run_update.bat")
    app_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
    launcher_vbs = os.path.join(app_dir, "launcher.vbs")

    batch_content = f"""@echo off
timeout /t 2 /nobreak > NUL
start "" "{installer_path}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
timeout /t 5 /nobreak > NUL
if exist "{launcher_vbs}" (
    wscript.exe "{launcher_vbs}"
)
"""
    with open(script_path, "w") as f:
        f.write(batch_content)

    # Launch detached update process
    subprocess.Popen(
        f'cmd.exe /c start /min "" "{script_path}"',
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
    )

    # Exit python backend process after 1.5 seconds to release file locks
    def _shutdown():
        time.sleep(1.5)
        os._exit(0)

    threading.Thread(target=_shutdown, daemon=True).start()

    return {
        "success": True,
        "message": f"Version v{data.version} installation initiated. Application is updating...",
        "installer": installer_path
    }
