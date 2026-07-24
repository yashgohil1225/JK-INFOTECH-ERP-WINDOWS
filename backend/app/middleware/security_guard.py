import os
import json
import base64
import hmac
import hashlib
import time
from datetime import datetime, timezone
import urllib.request
from app.core.hardware import get_hwid
from app.core.config import settings

MASTER_TOKEN = settings.SYSTEM_MASTER_TOKEN
SECRET_KEY = settings.INTEGRITY_SIGNING_KEY.encode()
app_data_dir = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "jk-erp")
os.makedirs(app_data_dir, exist_ok=True)
LICENSE_PATH = os.path.join(app_data_dir, "license.key")
TIME_LOCK_PATH = os.path.join(app_data_dir, "system_time.lock")

def sign_payload(payload_dict: dict) -> str:
    payload_str = base64.b64encode(json.dumps(payload_dict).encode()).decode()
    signature = hmac.new(SECRET_KEY, payload_str.encode(), hashlib.sha256).hexdigest()
    return f"{payload_str}.{signature}"

def verify_payload(signed_payload: str) -> dict:
    try:
        payload_str, signature = signed_payload.rsplit(".", 1)
        expected_sig = hmac.new(SECRET_KEY, payload_str.encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected_sig, signature):
            return json.loads(base64.b64decode(payload_str).decode())
    except Exception:
        pass
    return None

def get_trusted_time() -> datetime:
    # 1. Try to get time from World Time API
    try:
        req = urllib.request.Request("http://worldtimeapi.org/api/timezone/Etc/UTC", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=1) as response:
            data = json.loads(response.read())
            online_time = datetime.fromisoformat(data["utc_datetime"]).replace(tzinfo=timezone.utc)
            _update_high_water_mark(online_time.timestamp())
            return online_time
    except Exception:
        pass
        
    # 2. Fallback to local time
    local_time_ts = time.time()
    
    # Check high-water mark
    high_water_mark = _get_high_water_mark()
    if local_time_ts < high_water_mark:
        # Clock tampered (rolled back)
        raise ValueError("CLOCK_TAMPERED")
        
    _update_high_water_mark(local_time_ts)
    return datetime.fromtimestamp(local_time_ts, tz=timezone.utc)

def _get_high_water_mark() -> float:
    if os.path.exists(TIME_LOCK_PATH):
        try:
            with open(TIME_LOCK_PATH, "r", encoding="utf-8") as f:
                return float(f.read().strip())
        except:
            pass
    return 0.0

def _update_high_water_mark(ts: float):
    current_hwm = _get_high_water_mark()
    if ts > current_hwm:
        with open(TIME_LOCK_PATH, "w", encoding="utf-8") as f:
            f.write(str(ts))

async def check_system_integrity(app):
    hwid = get_hwid()
    
    if not os.path.exists(LICENSE_PATH):
        app.state.frozen = True
        app.state.freeze_reason = "SYSTEM_UNREGISTERED"
        app.state.license_expires_at = None
        return

    with open(LICENSE_PATH, "r", encoding="utf-8") as f:
        stored_key = f.read().strip()
        
    if stored_key == MASTER_TOKEN:
        app.state.frozen = False
        app.state.freeze_reason = ""
        app.state.license_expires_at = "lifetime"
        return
        
    payload = verify_payload(stored_key)
    if not payload:
        app.state.frozen = True
        app.state.freeze_reason = "LICENSE_CORRUPTED"
        app.state.license_expires_at = None
        return
        
    if payload.get("hwid") != hwid:
        app.state.frozen = True
        app.state.freeze_reason = "HWID_MISMATCH"
        app.state.license_expires_at = None
        return
        
    # Check expiration
    expires_at = payload.get("expires_at")
    app.state.license_expires_at = expires_at or "lifetime"
    
    if expires_at and expires_at != "lifetime":
        try:
            trusted_time = get_trusted_time()
            exp_date = datetime.fromisoformat(expires_at)
            if trusted_time > exp_date:
                app.state.frozen = True
                app.state.freeze_reason = "MEMBERSHIP_EXPIRED"
                return
        except ValueError as e:
            if str(e) == "CLOCK_TAMPERED":
                app.state.frozen = True
                app.state.freeze_reason = "SYSTEM_CLOCK_TAMPERED"
                return
            else:
                app.state.frozen = True
                app.state.freeze_reason = "LICENSE_CORRUPTED"
                return

    app.state.frozen = False
    app.state.freeze_reason = ""
