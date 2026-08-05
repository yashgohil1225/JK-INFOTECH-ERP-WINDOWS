# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Request, HTTPException
from app.core.hardware import get_hwid
from app.middleware.security_guard import sign_payload, MASTER_TOKEN, get_trusted_time, verify_payload
from datetime import timedelta

router = APIRouter(
    prefix="/api/v1/license",
    tags=["Security"],
)

from app.core.limiter import limiter

@router.get(
    "/status",
    summary="Get current license and system integrity status",
)
@limiter.exempt
async def get_license_status(request: Request):
    return {
        "frozen": False,
        "reason": "",
        "hwid": "PERPETUAL",
        "active": True,
        "expires_at": None
    }

@router.post(
    "/activate",
    summary="Activate application with a license key",
)
@limiter.exempt
async def activate_license(request: Request, data: dict):
    """
    Saves an encrypted license payload to disk and re-checks integrity.
    Supports both Standard Offline Keys and Emergency Master Token.
    """
    key = data.get("key")
    if not key:
        raise HTTPException(status_code=400, detail="Activation key is required.")
        
    duration = data.get("duration_months") # 1, 2, 3, 6, 12, or 'lifetime'
    signed_key = None
    
    if key == MASTER_TOKEN:
        # EMERGENCY / ADMIN GENERATION
        if not duration:
            raise HTTPException(status_code=400, detail="Duration is required for Master Token activation.")
            
        if duration == "lifetime":
            expires_at_str = "lifetime"
        elif duration == "5min":
            try:
                trusted_time = get_trusted_time()
                expires_time = trusted_time + timedelta(minutes=5)
                expires_at_str = expires_time.isoformat()
            except ValueError as e:
                if str(e) == "CLOCK_TAMPERED":
                    raise HTTPException(status_code=400, detail="System clock tampered. Cannot activate.")
                raise HTTPException(status_code=400, detail="Invalid duration format.")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        else:
            try:
                trusted_time = get_trusted_time()
                months = int(duration)
                expires_time = trusted_time + timedelta(days=30 * months)
                expires_at_str = expires_time.isoformat()
            except ValueError as e:
                if str(e) == "CLOCK_TAMPERED":
                    raise HTTPException(status_code=400, detail="System clock tampered. Cannot activate.")
                raise HTTPException(status_code=400, detail="Invalid duration format.")
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
                
        payload = {
            "hwid": get_hwid(),
            "expires_at": expires_at_str
        }
        signed_key = sign_payload(payload)
        message = "Master Key Activated."
    else:
        # STANDARD OFFLINE KEY
        payload = verify_payload(key)
        if not payload:
            raise HTTPException(status_code=400, detail="Invalid or corrupted Activation Key.")
            
        if payload.get("hwid") != get_hwid():
            raise HTTPException(status_code=400, detail="Key is not valid for this Hardware ID.")
            
        signed_key = key
        message = "Offline License Key activated successfully."
    
    # Sign and save
    from app.middleware.security_guard import check_system_integrity, LICENSE_PATH
    
    with open(LICENSE_PATH, "w", encoding="utf-8") as f:
        f.write(signed_key)
    
    # Re-trigger integrity check
    try:
        from app.middleware.security_guard import check_system_integrity
        await check_system_integrity(request.app)
    except ImportError:
        pass
    
    if getattr(request.app.state, "frozen", False):
        raise HTTPException(status_code=400, detail=request.app.state.freeze_reason)
        
    return {"message": message, "success": True}

@router.post(
    "/generate",
    summary="Generate offline license activation key (Admin Only)",
)
async def generate_license_endpoint(data: dict):
    master_token = data.get("master_token")
    if master_token != MASTER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized. Invalid Master Token.")
        
    hwid = data.get("hwid")
    duration = data.get("duration_months")
    
    if not hwid:
        raise HTTPException(status_code=400, detail="Hardware ID is required.")
    if not duration:
        raise HTTPException(status_code=400, detail="Duration is required.")
        
    if duration == "lifetime":
        expires_at_str = "lifetime"
    elif duration == "5min":
        try:
            trusted_time = get_trusted_time()
            expires_time = trusted_time + timedelta(minutes=5)
            expires_at_str = expires_time.isoformat()
        except ValueError as e:
            if str(e) == "CLOCK_TAMPERED":
                raise HTTPException(status_code=400, detail="System clock tampered. Cannot generate.")
            raise HTTPException(status_code=400, detail="Invalid duration format.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        try:
            trusted_time = get_trusted_time()
            months = int(duration)
            expires_time = trusted_time + timedelta(days=30 * months)
            expires_at_str = expires_time.isoformat()
        except ValueError as e:
            if str(e) == "CLOCK_TAMPERED":
                raise HTTPException(status_code=400, detail="System clock tampered. Cannot generate.")
            raise HTTPException(status_code=400, detail="Invalid duration format.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    payload = {
        "hwid": hwid,
        "expires_at": expires_at_str
    }
    
    signed_key = sign_payload(payload)
    return {"key": signed_key, "success": True}

