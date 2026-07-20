# =============================================================
# JK INFOTECH ERP — Database Backup & Restore Router
# File : app/routers/backup.py
# =============================================================

import os
import subprocess
import tempfile
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import User
from app.core.config import settings

router = APIRouter(
    prefix="/api/v1/backup",
    tags=["Backup"],
)

@router.post("/create")
async def create_backup(
    current_user: User = Depends(get_current_user)
):
    """
    Generates a PostgreSQL logical backup using pg_dump and returns the file for download.
    Only authorized superadmins can trigger this.
    """
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only administrators can generate backups.")

    # Prepare connection parameters
    db_host = settings.DATABASE_HOST
    db_port = str(settings.DATABASE_PORT)
    db_name = settings.DATABASE_NAME
    db_user = settings.DATABASE_USER
    db_password = settings.DATABASE_PASSWORD

    # Create temporary file
    temp_dir = tempfile.gettempdir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"jkerp_backup_{timestamp}.bak"
    backup_path = os.path.join(temp_dir, backup_filename)

    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    # Try to find pg_dump path on Windows
    pg_dump_cmd = "pg_dump"
    # Common Windows PostgreSQL install paths
    possible_paths = [
        r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\13\bin\pg_dump.exe",
        r"C:\Program Files\PostgreSQL\12\bin\pg_dump.exe",
    ]
    for path in possible_paths:
        if os.path.exists(path):
            pg_dump_cmd = path
            break

    cmd = [
        pg_dump_cmd,
        "-h", db_host,
        "-p", db_port,
        "-U", db_user,
        "-d", db_name,
        "-F", "c",
        "-f", backup_path
    ]

    try:
        # Run pg_dump synchronously
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, check=True)
        
        # Return the generated file as response
        return FileResponse(
            path=backup_path,
            filename=backup_filename,
            media_type="application/octet-stream"
        )
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or e.stdout or str(e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate backup via pg_dump: {error_msg}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Restores a PostgreSQL backup using pg_restore.
    Only authorized superadmins can trigger this.
    """
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only administrators can restore backups.")

    # Save uploaded file to temp path
    temp_dir = tempfile.gettempdir()
    uploaded_path = os.path.join(temp_dir, f"restore_{uuid.uuid4().hex}.bak")
    
    with open(uploaded_path, "wb") as buffer:
        buffer.write(await file.read())

    db_host = settings.DATABASE_HOST
    db_port = str(settings.DATABASE_PORT)
    db_name = settings.DATABASE_NAME
    db_user = settings.DATABASE_USER
    db_password = settings.DATABASE_PASSWORD

    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    # Try to find pg_restore path on Windows
    pg_restore_cmd = "pg_restore"
    possible_paths = [
        r"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe",
        r"C:\Program Files\PostgreSQL\15\bin\pg_restore.exe",
        r"C:\Program Files\PostgreSQL\14\bin\pg_restore.exe",
        r"C:\Program Files\PostgreSQL\13\bin\pg_restore.exe",
        r"C:\Program Files\PostgreSQL\12\bin\pg_restore.exe",
    ]
    for path in possible_paths:
        if os.path.exists(path):
            pg_restore_cmd = path
            break

    # Build pg_restore command
    cmd = [
        pg_restore_cmd,
        "-h", db_host,
        "-p", db_port,
        "-U", db_user,
        "-d", db_name,
        "-c",  # Clean first (drops existing tables before recreating them)
        uploaded_path
    ]

    try:
        # Run restore
        subprocess.run(cmd, env=env, capture_output=True, text=True, check=True)
        
        # Cleanup
        if os.path.exists(uploaded_path):
            os.remove(uploaded_path)
            
        return {"message": "Database restored successfully. Please reload application.", "success": True}
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or e.stdout or str(e)
        if os.path.exists(uploaded_path):
            os.remove(uploaded_path)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to restore backup via pg_restore: {error_msg}"
        )
    except Exception as e:
        if os.path.exists(uploaded_path):
            os.remove(uploaded_path)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during restore: {str(e)}"
        )
