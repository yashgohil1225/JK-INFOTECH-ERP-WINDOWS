# =============================================================
# JK INFOTECH ERP — Communication Service (Email & WhatsApp)
# File : app/services/communication_service.py
# =============================================================

import asyncio
import smtplib
import ssl
import json
import urllib.request
import urllib.parse
import urllib.error
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Dict, Any, Optional

class CommunicationService:
    @staticmethod
    def _sync_send_email(
        smtp_config: Dict[str, Any],
        recipient_email: str,
        subject: str,
        body: str,
        attachment_bytes: Optional[bytes] = None,
        filename: Optional[str] = "report.pdf"
    ) -> None:
        host = smtp_config.get("smtp_host", "").strip()
        port = int(smtp_config.get("smtp_port", 587))
        username = smtp_config.get("smtp_username", "").strip()
        password = smtp_config.get("smtp_password", "").strip()
        from_email = smtp_config.get("smtp_from_email", "").strip() or username
        use_tls = smtp_config.get("smtp_use_tls", True)

        if not host or not username or not password:
            raise ValueError("SMTP host, username, and password must be configured in settings.")

        msg = MIMEMultipart()
        msg["From"] = from_email
        msg["To"] = recipient_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html" if "<html>" in body.lower() else "plain"))

        if attachment_bytes and filename:
            part = MIMEApplication(attachment_bytes, Name=filename)
            part["Content-Disposition"] = f'attachment; filename="{filename}"'
            msg.attach(part)

        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if use_tls:
                    server.starttls(context=ssl.create_default_context())
                server.login(username, password)
                server.send_message(msg)

    @classmethod
    async def send_email(
        cls,
        smtp_config: Dict[str, Any],
        recipient_email: str,
        subject: str,
        body: str,
        attachment_bytes: Optional[bytes] = None,
        filename: Optional[str] = "report.pdf"
    ) -> Dict[str, Any]:
        await asyncio.to_thread(
            cls._sync_send_email,
            smtp_config,
            recipient_email,
            subject,
            body,
            attachment_bytes,
            filename
        )
        return {"success": True, "message": f"Email sent successfully to {recipient_email}"}

    @staticmethod
    def _sync_send_whatsapp_doc(
        wa_config: Dict[str, Any],
        recipient_phone: str,
        pdf_bytes: bytes,
        filename: str,
        caption: str
    ) -> Dict[str, Any]:
        phone_number_id = wa_config.get("wa_phone_number_id", "").strip()
        access_token = wa_config.get("wa_access_token", "").strip()

        if not phone_number_id or not access_token:
            raise ValueError("Meta WhatsApp Phone Number ID and Access Token must be configured in settings.")

        clean_phone = "".join(filter(str.isdigit, recipient_phone))
        if len(clean_phone) == 10:
            clean_phone = "91" + clean_phone

        upload_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/media"
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        
        body_parts = []
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"messaging_product\"\r\n\r\nwhatsapp\r\n".encode("utf-8"))
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: application/pdf\r\n\r\n".encode("utf-8"))
        body_parts.append(pdf_bytes)
        body_parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
        
        post_data = b"".join(body_parts)

        req = urllib.request.Request(
            upload_url,
            data=post_data,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": f"multipart/form-data; boundary={boundary}"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                upload_res = json.loads(resp.read().decode("utf-8"))
                media_id = upload_res.get("id")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            raise ValueError(f"Meta Upload API Error ({e.code}): {err_body}")

        if not media_id:
            raise ValueError("Failed to obtain media_id from WhatsApp upload API.")

        message_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "document",
            "document": {
                "id": media_id,
                "caption": caption,
                "filename": filename
            }
        }

        msg_data = json.dumps(payload).encode("utf-8")
        req_msg = urllib.request.Request(
            message_url,
            data=msg_data,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req_msg, timeout=30) as resp_msg:
                send_res = json.loads(resp_msg.read().decode("utf-8"))
                return {"success": True, "res": send_res}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            raise ValueError(f"Meta Send Message API Error ({e.code}): {err_body}")

    @classmethod
    async def send_whatsapp(
        cls,
        wa_config: Dict[str, Any],
        recipient_phone: str,
        pdf_bytes: bytes,
        filename: str,
        caption: str
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            cls._sync_send_whatsapp_doc,
            wa_config,
            recipient_phone,
            pdf_bytes,
            filename,
            caption
        )
