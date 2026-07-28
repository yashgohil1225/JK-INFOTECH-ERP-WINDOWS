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

import tempfile

TEMP_UPDATES_DIR = os.path.join(tempfile.gettempdir(), "JK_Infotech_Updates")


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

        # Automatically stage & trigger silent background update execution
        _execute_silent_update_installer(final_installer, version)

    except Exception as e:
        DOWNLOAD_STATE["is_downloading"] = False
        DOWNLOAD_STATE["status"] = "failed"
        DOWNLOAD_STATE["error"] = str(e)

def _execute_silent_update_installer(installer_path: str, version: str):
    """Prepares run_update.bat and executes silent installation without UAC dialogs."""
    try:
        script_path = os.path.join(TEMP_UPDATES_DIR, "run_update.bat")
        app_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
        launcher_vbs = os.path.join(app_dir, "launcher.vbs")

        batch_content = f"""@echo off
title JK INFOTECH ERP Silent Auto Updater
timeout /t 3 /nobreak > NUL
taskkill /F /IM JKErpWindows.exe /T > NUL 2>&1
taskkill /F /IM backend.exe /T > NUL 2>&1
timeout /t 1 /nobreak > NUL
"{installer_path}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
timeout /t 2 /nobreak > NUL
if exist "{launcher_vbs}" (
    wscript.exe "{launcher_vbs}"
)
"""
        with open(script_path, "w") as f:
            f.write(batch_content)

        print(f"[AutoUpdater] Launching silent update process for v{version}...")
        subprocess.Popen(
            f'cmd.exe /c start /min "" "{script_path}"',
            shell=True,
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        )
    except Exception as err:
        print(f"[AutoUpdater] Failed to execute silent update runner: {err}")

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

def _get_current_installed_version() -> str:
    try:
        app_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
        v_json = os.path.join(app_dir, "updates", "version.json")
        if os.path.exists(v_json):
            with open(v_json, "r") as f:
                data = json.load(f)
                return data.get("version", "1.2.0")
    except Exception:
        pass
    return "1.2.0"

# Auto Background Update Checker Engine
def _background_auto_update_worker():
    """Silently checks for cloud updates on startup, downloads release, and stages for silent install on exit."""
    time.sleep(8)  # Wait 8s after startup to avoid slowing boot
    try:
        url = "https://raw.githubusercontent.com/yashgohil1225/JK-INFOTECH-ERP-WINDOWS/main/updates/version.json"
        req = urllib.request.Request(url, headers={'User-Agent': 'JK_Infotech_ERP_AutoUpdater'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            
        latest_ver = data.get("version")
        download_url = data.get("downloadUrl")
        
        current_ver = _get_current_installed_version()
        if latest_ver and download_url and _is_newer_ver(current_ver, latest_ver):
            print(f"[AutoUpdater] New version v{latest_ver} detected (current: v{current_ver}). Silently downloading & updating in background...")
            _download_task(download_url, latest_ver)
    except Exception as e:
        print(f"[AutoUpdater] Background check silent skip: {e}")

def _is_newer_ver(current: str, latest: str) -> bool:
    try:
        c_parts = [int(p) for p in current.split('.')]
        l_parts = [int(p) for p in latest.split('.')]
        for i in range(max(len(c_parts), len(l_parts))):
            c = c_parts[i] if i < len(c_parts) else 0
            l = l_parts[i] if i < len(l_parts) else 0
            if l > c: return True
            if l < c: return False
    except Exception:
        pass
    return False

# Launch background checker thread on router load
threading.Thread(target=_background_auto_update_worker, daemon=True).start()

@router.post("/apply-update")
async def apply_update(data: ApplyUpdateRequest):
    """Executes the silent software update installer without UAC prompts."""
    global DOWNLOAD_STATE
    installer_path = data.installer_path or DOWNLOAD_STATE.get("local_file")
    
    if not installer_path or not os.path.exists(installer_path):
        raise HTTPException(status_code=404, detail="Downloaded update installer package not found.")

    script_path = os.path.join(TEMP_UPDATES_DIR, "run_update.bat")
    app_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
    launcher_vbs = os.path.join(app_dir, "launcher.vbs")

    batch_content = f"""@echo off
title JK INFOTECH ERP Silent Auto Updater
timeout /t 2 /nobreak > NUL
taskkill /F /IM JKErpWindows.exe /T > NUL 2>&1
taskkill /F /IM backend.exe /T > NUL 2>&1
timeout /t 1 /nobreak > NUL
"{installer_path}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
timeout /t 2 /nobreak > NUL
if exist "{launcher_vbs}" (
    wscript.exe "{launcher_vbs}"
)
"""
    with open(script_path, "w") as f:
        f.write(batch_content)

    subprocess.Popen(
        f'cmd.exe /c start /min "" "{script_path}"',
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
    )

    def _shutdown():
        time.sleep(1.5)
        os._exit(0)

    threading.Thread(target=_shutdown, daemon=True).start()

    return {
        "success": True,
        "message": f"Version v{data.version} silent update initiated.",
        "installer": installer_path
    }

