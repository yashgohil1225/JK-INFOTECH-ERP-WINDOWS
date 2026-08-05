import os
import sys
import uuid
import json
import asyncio
import tempfile
import subprocess
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import Company, AuditLog
from app.core.config import settings

logger = logging.getLogger("auto_backup_service")


async def generate_postgresql_bak_file(destination_path: str) -> bool:
    """Generates an online SQLite binary database backup snapshot directly to destination_path."""
    try:
        import sqlite3
        src_db = settings.SQLITE_DB_PATH
        dest_dir = os.path.dirname(destination_path)
        if dest_dir:
            os.makedirs(dest_dir, exist_ok=True)

        def _sqlite_backup():
            con_src = sqlite3.connect(src_db)
            con_dest = sqlite3.connect(destination_path)
            with con_dest:
                con_src.backup(con_dest)
            con_dest.close()
            con_src.close()

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _sqlite_backup)
        return True
    except Exception as e:
        logger.error(f"Failed SQLite database backup generation: {str(e)}")
        raise e


async def generate_json_workspace_file(company: Company, destination_path: str, db: Optional[AsyncSession] = None) -> bool:
    """Generates a complete JSON Workspace backup file containing 100% of all company tables and records."""
    def default_serializer(obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return str(obj)

    def model_to_dict(inst):
        if not inst:
            return {}
        res = {}
        for c in inst.__table__.columns:
            val = getattr(inst, c.name)
            res[c.name] = default_serializer(val) if val is not None else None
        return res

    workspace_data: Dict[str, Any] = {
        "export_metadata": {
            "system": "JK INFOTECH ERP",
            "version": "1.0.0",
            "exported_at": datetime.now().astimezone().isoformat(),
            "company_name": company.name,
            "company_id": str(company.id),
        },
        "company": model_to_dict(company),
        "entities": {}
    }

    if db:
        try:
            from app.models import (
                User, Role, ProductCategory, Product, Supplier, Customer,
                PurchaseOrder, SalesOrder, Invoice, PurchaseBill, Account,
                JournalEntry, FiscalYear
            )

            models_to_export = [
                ("users", User),
                ("roles", Role),
                ("product_categories", ProductCategory),
                ("products", Product),
                ("suppliers", Supplier),
                ("customers", Customer),
                ("purchase_orders", PurchaseOrder),
                ("sales_orders", SalesOrder),
                ("invoices", Invoice),
                ("purchase_bills", PurchaseBill),
                ("accounts", Account),
                ("journal_entries", JournalEntry),
                ("fiscal_years", FiscalYear),
            ]

            for key, m_class in models_to_export:
                try:
                    stmt = select(m_class).where(getattr(m_class, "company_id") == company.id)
                    res = await db.execute(stmt)
                    rows = res.scalars().all()
                    workspace_data["entities"][key] = [model_to_dict(r) for r in rows]
                except Exception as m_err:
                    logger.warning(f"Note: Could not export entity '{key}': {m_err}")

        except Exception as db_err:
            logger.warning(f"Note: Error exporting full JSON database entities: {db_err}")

    with open(destination_path, "w", encoding="utf-8") as f:
        json.dump(workspace_data, f, indent=2, default=default_serializer)
    return True


async def upload_to_google_drive(file_path: str, gdrive_config: Dict[str, Any]) -> Dict[str, Any]:
    """Uploads/overwrites file to Google Drive using Google Drive REST API v3."""
    folder_id = gdrive_config.get("folder_id", "").strip()
    access_token = gdrive_config.get("access_token", "").strip()
    file_id = gdrive_config.get("file_id", "").strip()

    if not access_token:
        raise ValueError("Google Drive Access Token is required.")

    filename = os.path.basename(file_path)

    headers = {
        "Authorization": f"Bearer {access_token}",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        if file_id:
            update_url = f"https://www.googleapis.com/upload/drive/v3/files/{file_id}?uploadType=media"
            res = await client.patch(update_url, headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/octet-stream"}, content=file_bytes)
            if res.status_code == 200:
                data = res.json()
                return {"success": True, "file_id": data.get("id"), "message": f"Overwrote Google Drive file '{filename}'."}

        query_str = f"name = '{filename}' and trashed = false"
        if folder_id:
            query_str += f" and '{folder_id}' in parents"
        
        search_res = await client.get("https://www.googleapis.com/drive/v3/files", headers=headers, params={"q": query_str})
        
        if search_res.status_code == 200:
            files = search_res.json().get("files", [])
            if files:
                existing_id = files[0]["id"]
                update_url = f"https://www.googleapis.com/upload/drive/v3/files/{existing_id}?uploadType=media"
                patch_res = await client.patch(update_url, headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/octet-stream"}, content=file_bytes)
                if patch_res.status_code == 200:
                    data = patch_res.json()
                    return {"success": True, "file_id": existing_id, "message": f"Updated existing Google Drive file '{filename}'."}

        metadata = {"name": filename}
        if folder_id:
            metadata["parents"] = [folder_id]

        files_payload = {
            "data": ("metadata", json.dumps(metadata), "application/json; charset=UTF-8"),
            "file": (filename, file_bytes, "application/octet-stream")
        }
        upload_url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
        res = await client.post(upload_url, headers=headers, files=files_payload)
        
        if res.status_code in (200, 201):
            data = res.json()
            return {"success": True, "file_id": data.get("id"), "message": f"Uploaded initial Google Drive file '{filename}'."}
        else:
            raise ValueError(f"Google Drive API error ({res.status_code}): {res.text}")


async def upload_to_s3_or_compatible(file_path: str, s3_config: Dict[str, Any]) -> Dict[str, Any]:
    """Uploads file to AWS S3 or S3-compatible cloud storage."""
    bucket = s3_config.get("bucket", "").strip()
    endpoint_url = s3_config.get("endpoint_url", "").strip()
    access_key = s3_config.get("access_key", "").strip()
    secret_key = s3_config.get("secret_key", "").strip()
    region = s3_config.get("region", "us-east-1").strip()

    if not bucket or not access_key or not secret_key:
        raise ValueError("S3 Bucket, Access Key, and Secret Key are required.")

    filename = os.path.basename(file_path)

    try:
        import boto3
        def _boto_upload():
            client_kwargs = {
                "service_name": "s3",
                "aws_access_key_id": access_key,
                "aws_secret_access_key": secret_key,
                "region_name": region
            }
            if endpoint_url:
                client_kwargs["endpoint_url"] = endpoint_url
            s3_client = boto3.client(**client_kwargs)
            s3_client.upload_file(file_path, bucket, filename)
            return True

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _boto_upload)
        return {"success": True, "message": f"Uploaded '{filename}' to S3 bucket '{bucket}'."}
    except ImportError:
        raise ValueError("boto3 package not installed on backend server for S3 upload.")


async def upload_to_webhook(file_path: str, webhook_config: Dict[str, Any]) -> Dict[str, Any]:
    """Uploads single backup file to a custom Cloud Upload Webhook URL."""
    url = webhook_config.get("webhook_url", "").strip()
    secret_header = webhook_config.get("secret_header", "").strip()

    if not url:
        raise ValueError("Webhook URL is required.")

    filename = os.path.basename(file_path)
    headers = {}
    if secret_header:
        headers["X-Backup-Secret"] = secret_header

    async with httpx.AsyncClient(timeout=120.0) as client:
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, "application/octet-stream")}
            res = await client.post(url, headers=headers, files=files)
            if res.status_code in (200, 201, 202, 204):
                return {"success": True, "message": f"Uploaded backup to Cloud Webhook URL."}
            else:
                raise ValueError(f"Webhook cloud endpoint error ({res.status_code}): {res.text}")


async def perform_company_auto_backup(company_id: uuid.UUID, db: AsyncSession, force: bool = False) -> Dict[str, Any]:
    """
    Executes auto-backup for a single company based on stored backup settings.
    Supports '.bak', '.json', and 'both' (.bak + .json) formats.
    Overwrites single local backup file(s) and uploads to selected Cloud Provider.
    """
    company = await db.get(Company, company_id)
    if not company:
        raise ValueError(f"Company with ID {company_id} not found.")

    company_settings = company.settings or {}
    backup_config = company_settings.get("backup", {})

    if not force and not backup_config.get("auto_backup_enabled", False):
        return {"status": "skipped", "reason": "Auto backup is disabled."}

    target_dir = backup_config.get("target_directory", "").strip()
    if not target_dir:
        target_dir = os.path.join(os.getcwd(), "backups")
    
    os.makedirs(target_dir, exist_ok=True)

    backup_format = backup_config.get("backup_format", "both").lower()
    single_file_overwrite = backup_config.get("single_file_overwrite", True)

    company_clean = (company.name or "jkerp").lower().replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    generated_files: List[str] = []

    # 1. Generate Backup Files
    if backup_format in ("bak", "both"):
        bak_filename = f"{company_clean}_auto_backup.bak" if single_file_overwrite else f"{company_clean}_backup_{timestamp}.bak"
        bak_full_path = os.path.join(target_dir, bak_filename)
        await generate_postgresql_bak_file(bak_full_path)
        generated_files.append(bak_full_path)

    if backup_format in ("json", "both"):
        json_filename = f"{company_clean}_auto_backup.json" if single_file_overwrite else f"{company_clean}_backup_{timestamp}.json"
        json_full_path = os.path.join(target_dir, json_filename)
        await generate_json_workspace_file(company, json_full_path, db)
        generated_files.append(json_full_path)

    # 2. Cloud Backup Upload (If Enabled)
    cloud_status = "NOT_CONFIGURED"
    cloud_message = ""

    if backup_config.get("cloud_backup_enabled", False) and generated_files:
        cloud_provider = backup_config.get("cloud_provider", "gdrive").lower()
        cloud_messages = []
        try:
            for file_path in generated_files:
                if cloud_provider == "gdrive":
                    gdrive_conf = backup_config.get("gdrive", {})
                    res = await upload_to_google_drive(file_path, gdrive_conf)
                    cloud_messages.append(res.get("message", "Uploaded to Google Drive."))
                    if res.get("file_id"):
                        gdrive_conf["file_id"] = res.get("file_id")
                        backup_config["gdrive"] = gdrive_conf
                elif cloud_provider == "s3":
                    s3_conf = backup_config.get("s3", {})
                    res = await upload_to_s3_or_compatible(file_path, s3_conf)
                    cloud_messages.append(res.get("message", "Uploaded to S3."))
                elif cloud_provider == "webhook":
                    webhook_conf = backup_config.get("webhook", {})
                    res = await upload_to_webhook(file_path, webhook_conf)
                    cloud_messages.append(res.get("message", "Uploaded to Webhook."))

            cloud_status = "SUCCESS"
            cloud_message = " | ".join(cloud_messages)
        except Exception as cloud_err:
            logger.error(f"Cloud upload error for company {company.name}: {str(cloud_err)}")
            cloud_status = "FAILED"
            cloud_message = f"Cloud upload failed: {str(cloud_err)}"

    from sqlalchemy.orm.attributes import flag_modified

    # 3. Update Timestamps and Save Config back to DB
    now_iso = datetime.now().astimezone().isoformat()
    backup_config["last_backup_timestamp"] = now_iso
    backup_config["last_backup_path"] = ", ".join(generated_files)
    backup_config["cloud_last_sync_status"] = cloud_status
    backup_config["cloud_last_sync_message"] = cloud_message
    if cloud_status == "SUCCESS":
        backup_config["cloud_last_sync_timestamp"] = now_iso

    company_settings = dict(company.settings or {})
    company_settings["backup"] = backup_config
    company.settings = company_settings
    flag_modified(company, "settings")
    db.add(company)
    await db.commit()

    logger.info(f"Auto-backup successfully generated for '{company.name}': {generated_files}")

    return {
        "status": "success",
        "local_files": generated_files,
        "single_file_overwrite": single_file_overwrite,
        "cloud_status": cloud_status,
        "cloud_message": cloud_message,
        "timestamp": now_iso
    }


def get_now() -> datetime:
    return datetime.now().astimezone()

def parse_iso_datetime(iso_str: str) -> Optional[datetime]:
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.astimezone()
        return dt
    except Exception:
        return None


async def start_auto_backup_scheduler():
    """
    Background worker loop that runs periodically every 15 seconds to perform scheduled backups.
    Supports minutes-based intervals (e.g., 5-minute testing timer) and days-based intervals.
    """
    logger.info("Starting Auto-Backup Background Scheduler Worker (Frequency Check: Every 15 seconds)...")
    await asyncio.sleep(3) # Initial startup delay

    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Company))
                companies = result.scalars().all()

                for comp in companies:
                    comp_settings = comp.settings or {}
                    b_conf = comp_settings.get("backup", {})
                    
                    if not b_conf.get("auto_backup_enabled", False):
                        continue

                    # Extract interval in minutes (or calculate from interval_days)
                    interval_mins = b_conf.get("interval_minutes")
                    if interval_mins is None or interval_mins == "":
                        interval_days = float(b_conf.get("interval_days", 7))
                        interval_mins = interval_days * 1440
                    else:
                        interval_mins = float(interval_mins)

                    last_backup_str = b_conf.get("last_backup_timestamp")

                    is_due = False
                    if not last_backup_str:
                        is_due = True
                    else:
                        last_dt = parse_iso_datetime(last_backup_str)
                        now = get_now()
                        if last_dt is None or now >= last_dt + timedelta(minutes=interval_mins):
                            is_due = True

                    if is_due:
                        logger.info(f"⏰ TIMER TRIGGERED: Executing scheduled auto-backup for company '{comp.name}' (Interval: {interval_mins} mins)...")
                        try:
                            async with AsyncSessionLocal() as backup_db:
                                res = await perform_company_auto_backup(comp.id, backup_db)
                                logger.info(f"✅ Timed backup complete for '{comp.name}': {res}")
                        except Exception as err:
                            logger.error(f"❌ Error executing scheduled auto-backup for '{comp.name}': {str(err)}")

        except Exception as loop_err:
            logger.error(f"Error in auto_backup_scheduler loop: {str(loop_err)}")

        # Check every 15 seconds to catch 5-minute testing timers promptly
        await asyncio.sleep(15)
