# =============================================================
# JK INFOTECH ERP — Report Sharing Router (Email & WhatsApp)
# File : app/routers/reports_share.py
# =============================================================

import urllib.parse
from urllib.parse import urlparse
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, Company
from app.middleware.auth import get_current_user
from app.services.communication_service import CommunicationService

router = APIRouter(prefix="/api/v1/reports", tags=["Report Sharing"])

class SendEmailSchema(BaseModel):
    recipient_email: str
    subject: str
    message: str
    pdf_url: Optional[str] = None
    filename: Optional[str] = "ERP_Report.pdf"

class SendWhatsAppSchema(BaseModel):
    recipient_phone: str
    message: str
    pdf_url: Optional[str] = None
    filename: Optional[str] = "ERP_Report.pdf"

class TestSMTPSchema(BaseModel):
    test_email: str
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_use_tls: Optional[bool] = True

class TestWhatsAppSchema(BaseModel):
    test_phone: str

async def _fetch_pdf_bytes(pdf_url: str, auth_header: Optional[str] = None) -> bytes:
    if not pdf_url:
        return b""
    if pdf_url.startswith("data:"):
        import base64
        try:
            _, encoded = pdf_url.split(",", 1)
            return base64.b64decode(encoded)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 PDF data: {str(e)}")
    
    headers = {"User-Agent": "JKERP-Backend"}
    if auth_header:
        headers["Authorization"] = auth_header

    parsed = urlparse(pdf_url)
    is_local = (
        not parsed.netloc or 
        parsed.hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1")
    )
    try:
        if is_local:
            from app.main import app
            path_with_query = parsed.path
            if parsed.query:
                path_with_query += f"?{parsed.query}"
            
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
                resp = await client.get(path_with_query, headers=headers, timeout=30.0)
                if resp.status_code != 200:
                    raise Exception(f"HTTP {resp.status_code}: {resp.text}")
                return resp.content
        else:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                resp = await client.get(pdf_url, headers=headers)
                if resp.status_code != 200:
                    raise Exception(f"HTTP {resp.status_code}")
                return resp.content
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not download PDF from URL: {str(e)}"
        )

@router.post("/send-email")
async def send_report_email(
    data: SendEmailSchema,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="No active company selected")

    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    settings = company.settings or {}
    smtp_config = settings.get("smtp", {})

    if not smtp_config.get("smtp_host") or not smtp_config.get("smtp_username"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP email settings are not configured in Company Settings."
        )

    pdf_bytes = None
    if data.pdf_url:
        auth_header = request.headers.get("authorization")
        pdf_bytes = await _fetch_pdf_bytes(data.pdf_url, auth_header)

    try:
        res = await CommunicationService.send_email(
            smtp_config=smtp_config,
            recipient_email=data.recipient_email,
            subject=data.subject,
            body=data.message,
            attachment_bytes=pdf_bytes,
            filename=data.filename or "ERP_Report.pdf"
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@router.post("/send-whatsapp")
async def send_report_whatsapp(
    data: SendWhatsAppSchema,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="No active company selected")

    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    settings = company.settings or {}
    wa_config = settings.get("whatsapp", {})

    if not wa_config.get("wa_phone_number_id") or not wa_config.get("wa_access_token"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meta WhatsApp Cloud API credentials are not configured in Company Settings."
        )

    if not data.pdf_url:
        raise HTTPException(status_code=400, detail="PDF URL is required for WhatsApp document dispatch")

    auth_header = request.headers.get("authorization")
    pdf_bytes = await _fetch_pdf_bytes(data.pdf_url, auth_header)

    try:
        res = await CommunicationService.send_whatsapp(
            wa_config=wa_config,
            recipient_phone=data.recipient_phone,
            pdf_bytes=pdf_bytes,
            filename=data.filename or "ERP_Report.pdf",
            caption=data.message
        )
        return {"success": True, "message": "WhatsApp document sent successfully!", "details": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send WhatsApp document: {str(e)}")

@router.post("/test-smtp")
async def test_smtp(
    data: TestSMTPSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    saved_smtp = (company.settings or {}).get("smtp", {})
    smtp_config = {
        "smtp_host": data.smtp_host or saved_smtp.get("smtp_host"),
        "smtp_port": data.smtp_port or saved_smtp.get("smtp_port", 587),
        "smtp_username": data.smtp_username or saved_smtp.get("smtp_username"),
        "smtp_password": data.smtp_password or saved_smtp.get("smtp_password"),
        "smtp_from_email": data.smtp_from_email or saved_smtp.get("smtp_from_email"),
        "smtp_use_tls": data.smtp_use_tls if data.smtp_use_tls is not None else saved_smtp.get("smtp_use_tls", True),
    }
    try:
        await CommunicationService.send_email(
            smtp_config=smtp_config,
            recipient_email=data.test_email,
            subject="[JK Infotech ERP] SMTP Configuration Test",
            body="This is a test email from JK Infotech ERP to confirm your SMTP configuration works correctly."
        )
        return {"success": True, "message": f"SMTP Connection test successful! Test email delivered to {data.test_email}."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMTP Test Failed: {str(e)}")
