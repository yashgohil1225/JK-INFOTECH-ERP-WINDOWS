# =============================================================
# JK INFOTECT ERP — Auth Router
# File : app/routers/auth.py
# =============================================================
# API Endpoints:
#   POST   /api/auth/register           → create company + admin
#   POST   /api/auth/login              → login, get JWT tokens
#   POST   /api/auth/login/swagger      → Swagger UI login form
#   GET    /api/auth/me                 → get current user info
#   POST   /api/auth/refresh            → refresh expired token
#   POST   /api/auth/change-password    → change password
#   POST   /api/auth/reset-password     → reset password using OTP
#   GET    /api/auth/verify-gst/{gstin} → verify GST and get info
# =============================================================

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
# pyrefly: ignore [missing-import]
from fastapi.security import OAuth2PasswordRequestForm
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company, get_current_user_optional
from app.models import Company, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    LoginRequest,
    LoginResponse,
    MeResponse,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    SendOtpRequest,
    SendOtpResponse,
    TokenResponse,
    CompanyResponse,
    UserResponse,
    GSTVerificationResponse,
    SwitchCompanyRequest,
    SetPinRequest,
    VerifyPinRequest,
    UnlockPinRequest,
    UpdateSecurityRequest,
)
from typing import List, Optional
from app.services.auth import AuthService
from app.services.gst import gst_service
from app.services.seed_accounts import seed_default_accounts_for_company

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Auth"],
)


# =============================================================
# POST /api/auth/register
# =============================================================

@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new company and admin user",
    description="""
    Creates a new Company and the first Admin user together in one step.
    Returns JWT tokens so the user is logged in immediately after registration.
    """,
)
async def register(
    data: RegisterRequest,
    response: Response, db: AsyncSession = Depends(get_db),
):
    try:
        service = AuthService(db)
        result = await service.register(data)
        
        if hasattr(result, "tokens") and result.tokens.refresh_token:
            response.set_cookie(
                key="refresh_token",
                value=result.tokens.refresh_token,
                httponly=True,
                secure=settings.ENVIRONMENT.lower() == "production",
                samesite="lax",
                max_age=30 * 24 * 60 * 60
            )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================
# POST /api/auth/login
# =============================================================

@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login with email and password",
    description="""
    Authenticate with email + password.
    Returns access_token (15 min) and refresh_token (30 days).

    **Frontend usage:**
    1. Store access_token in memory (not localStorage)
    2. Store refresh_token in httpOnly cookie or secure storage
    3. Send access_token as: `Authorization: Bearer <token>`
    4. When access_token expires, call /refresh to get a new one
    """,
)
async def login(
    data: LoginRequest,
    request: Request,
    response: Response, db: AsyncSession = Depends(get_db),
):
    try:
        # Inject metadata for device fingerprinting
        setattr(data, "_ip_address", request.client.host if request.client else None)
        setattr(data, "_user_agent", request.headers.get("user-agent"))
        
        service = AuthService(db)
        result = await service.login(data)
        
        # Auto-seed accounts if missing (e.g. after DB reset)
        # Non-critical: must never block login even if seeding fails
        try:
            await seed_default_accounts_for_company(db, result.user.company_id, result.user.id)
            await db.commit()
        except Exception as seed_err:
            import logging
            logging.warning(f"Account seeding skipped during login: {seed_err}")
            await db.rollback()
        
        
        if hasattr(result, "tokens") and result.tokens.refresh_token:
            response.set_cookie(
                key="refresh_token",
                value=result.tokens.refresh_token,
                httponly=True,
                secure=settings.ENVIRONMENT.lower() == "production",
                samesite="lax",
                max_age=30 * 24 * 60 * 60
            )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


# =============================================================
# POST /api/auth/local-auto-login
# =============================================================

@router.post(
    "/local-auto-login",
    response_model=LoginResponse,
    summary="Automatic local login for Windows app context",
)
async def local_auto_login(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    try:
        request_info = {
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent")
        }
        service = AuthService(db)
        result = await service.local_auto_login(request_info)

        if hasattr(result, "tokens") and result.tokens.refresh_token:
            response.set_cookie(
                key="refresh_token",
                value=result.tokens.refresh_token,
                httponly=True,
                secure=settings.ENVIRONMENT.lower() == "production",
                samesite="lax",
                max_age=30 * 24 * 60 * 60
            )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# =============================================================
# POST /api/auth/check-pin
# =============================================================

@router.post(
    "/check-pin",
    response_model=dict,
    summary="Check if a user has a PIN set",
)
async def check_pin(
    data: SendOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        service = AuthService(db)
        has_pin = await service.has_pin(data.login_id)
        return {"has_pin": has_pin}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# =============================================================
# POST /api/auth/send-otp
# =============================================================

@router.post(
    "/send-otp",
    response_model=SendOtpResponse,
    summary="Send OTP via Twilio to a mobile number",
    description="""
    Sends an OTP to the given mobile number using Twilio Verify API.
    Used for passwordless mobile login.
    """,
)
async def send_otp(
    data: SendOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        service = AuthService(db)
        return await service.send_otp(data.login_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================
# POST /api/auth/forgot-password
# =============================================================

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request a password reset OTP",
)
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        service = AuthService(db)
        return await service.forgot_password(data.login_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================
# POST /api/auth/reset-password
# =============================================================

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password using OTP",
)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        service = AuthService(db)
        return await service.reset_password(data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================
# GET /api/auth/verify-gst/{gstin}
# =============================================================

@router.get(
    "/verify-gst/{gstin}",
    response_model=GSTVerificationResponse,
    summary="Verify GSTIN and get business details",
    description="""
    Calls the Government of India's GST public lookup API.
    Returns the legal name, status, and registration details.
    """,
)
async def verify_gst(
    gstin: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public lookup for GST verification during registration.
    """
    result = await gst_service.verify_gst(gstin, db)
    
    if not result.get("is_valid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Invalid GSTIN or service unavailable"),
        )
    
    return GSTVerificationResponse(**result)


# =============================================================
# POST /api/auth/login/swagger   (for Swagger UI "Authorize" button)
# =============================================================

@router.post(
    "/login/swagger",
    response_model=TokenResponse,
    include_in_schema=False,  # hide from docs — internal use only
    summary="Swagger UI login",
)
async def login_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    This endpoint exists only so Swagger UI's "Authorize" button works.
    OAuth2PasswordRequestForm sends username/password as form fields.
    We map username → email.
    """
    try:
        service = AuthService(db)
        login_data = LoginRequest(login_id=form_data.username, password=form_data.password)
        result = await service.login(login_data)
        # Swagger needs exactly: {"access_token": "...", "token_type": "bearer"}
        return TokenResponse(
            access_token=result.tokens.access_token,
            refresh_token=result.tokens.refresh_token,
            token_type="bearer",
            expires_in=result.tokens.expires_in,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


# =============================================================
# GET /api/auth/me
# =============================================================

@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get current logged-in user info",
    description="""
    Returns the profile of the currently authenticated user
    along with their company information.
    Requires: `Authorization: Bearer <access_token>`
    """,
)
async def get_me(
    current_user: User    = Depends(get_current_user),
    company: Company      = Depends(get_current_company),
):
    return MeResponse(
        user=UserResponse.model_validate(current_user),
        company=CompanyResponse.model_validate(company),
    )

# =============================================================
# GET /api/auth/my-companies
# =============================================================

@router.get(
    "/my-companies",
    response_model=List[CompanyResponse],
    summary="Get all companies available to current user",
)
async def get_my_companies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession   = Depends(get_db),
):
    service = AuthService(db)
    return await service.get_associated_companies(current_user)


# =============================================================
# POST /api/auth/switch-company
# =============================================================

@router.post(
    "/switch-company",
    response_model=TokenResponse,
    summary="Switch to another company",
    description="Returns a new set of tokens for the newly selected company.",
)
async def switch_company(
    data: SwitchCompanyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession   = Depends(get_db),
):
    try:
        service = AuthService(db)
        user_agent = request.headers.get("user-agent")
        ip_address = request.client.host if request.client else None
        return await service.switch_company(
            current_user, 
            data.company_id, 
            user_agent=user_agent, 
            ip_address=ip_address
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


# =============================================================
# POST /api/auth/refresh
# =============================================================

@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="""
    Exchange a valid refresh_token for a new access_token + refresh_token pair.
    Call this automatically when you receive a 401 response.
    """,
)
async def refresh_token(
    data: RefreshRequest,
    request: Request,
    response: Response, db: AsyncSession = Depends(get_db),
):
    try:
        request_info = {
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent")
        }
        service = AuthService(db)
        # Read from cookie first, fallback to body
        token_to_refresh = request.cookies.get("refresh_token") or data.refresh_token
        if not token_to_refresh:
            raise ValueError("No refresh token provided")
            
        result = await service.refresh_tokens(token_to_refresh, request_info)
        
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            secure=settings.ENVIRONMENT.lower() == "production",
            samesite="lax",
            max_age=30 * 24 * 60 * 60
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


# =============================================================
# POST /api/auth/change-password
# =============================================================

@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change current user's password",
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User    = Depends(get_current_user),
    db: AsyncSession      = Depends(get_db),
):
    try:
        service = AuthService(db)
        await service.change_password(
            current_user,
            data.current_password,
            data.new_password,
        )
        return MessageResponse(message="Password changed successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================
# POST /api/auth/logout
# =============================================================

@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout current user",
    description="""
    In addition to frontend clearing tokens, this endpoint revokes the 
    persistent session in the database for high security.
    """,
)
async def logout(
    data: RefreshRequest,
    request: Request, response: Response, db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    token_to_revoke = request.cookies.get("refresh_token") or data.refresh_token
    if token_to_revoke:
        await service.revoke_session(token_to_revoke)
    
    response.delete_cookie("refresh_token")
    return MessageResponse(
        message="Logged out successfully."
    )


# =============================================================
# PIN AUTHENTICATION
# =============================================================

@router.post(
    "/set-pin",
    response_model=MessageResponse,
    summary="Set or update Quick Access PIN",
)
async def set_pin(
    data: SetPinRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession  = Depends(get_db),
):
    try:
        service = AuthService(db)
        await service.set_pin(current_user, data)
        return MessageResponse(message="Quick Access PIN set successfully.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post(
    "/verify-pin",
    response_model=TokenResponse,
    summary="Login using Quick Access PIN",
)
async def verify_pin(
    data: VerifyPinRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession  = Depends(get_db),
):
    print(f"DEBUG: verify-pin request - body: {data.dict()}, current_user: {current_user.email if current_user else 'None'}")
    try:
        service = AuthService(db)
        return await service.verify_pin(
            pin=data.pin, 
            user=current_user,
            login_id=data.login_id,
            refresh_token=data.refresh_token,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        import traceback
        import logging
        logging.error(f"Error in verify_pin: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal Server Error during PIN verification")

@router.post(
    "/unlock-pin",
    response_model=MessageResponse,
    summary="Unlock PIN entry using mobile OTP",
)
async def unlock_pin(
    data: UnlockPinRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        service = AuthService(db)
        return await service.unlock_pin(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "/security-settings",
    response_model=UserResponse,
    summary="Update user security preferences",
)
async def update_security_settings(
    data: UpdateSecurityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession  = Depends(get_db),
):
    try:
        service = AuthService(db)
        return await service.update_security_settings(current_user, data.pin_login_enabled)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================
# LICENSE & SECURITY (OFFLINE)
# =============================================================

@router.get(
    "/license/status",
    tags=["Security"],
    summary="Get current license and system integrity status",
)
async def get_license_status(request: Request):
    """
    Returns the current security status of the application.
    If 'frozen' is true, the UI should show the activation screen.
    """
    from app.core.hardware import get_hwid
    return {
        "frozen": getattr(request.app.state, "frozen", False),
        "reason": getattr(request.app.state, "freeze_reason", ""),
        "hwid": get_hwid()
    }

@router.post(
    "/license/activate",
    tags=["Security"],
    summary="Activate application with a license key",
)
async def activate_license(request: Request, data: dict):
    """
    Saves the provided license key to disk and re-checks integrity.
    """
    key = data.get("key")
    if not key:
        raise HTTPException(status_code=400, detail="License key is required.")
    
    from app.middleware.security_guard import check_system_integrity, LICENSE_PATH
    
    # Save to disk
    with open(LICENSE_PATH, "w", encoding="utf-8") as f:
        f.write(key)
    
    # Re-trigger integrity check
    from app.middleware.security_guard import check_system_integrity
    await check_system_integrity(request.app)
    
    if getattr(request.app.state, "frozen", False):
        raise HTTPException(status_code=400, detail=request.app.state.freeze_reason)
        
    return {"message": "License activated successfully. System unlocked."}

@router.post(
    "/license/override",
    tags=["Security"],
    include_in_schema=False, # Secret endpoint
)
async def secret_override(request: Request, data: dict):
    """
    Andy Code Protector: Secret bypass using a master token.
    """
    master_token = data.get("master_token")
    # This matches the MASTER_SECRET in license.py or a specific 'Andy' key
    if master_token == "JKERP-X7M9B-K2Q6P-5D1H2-8W3Y4":
        request.app.state.frozen = False
        request.app.state.freeze_reason = "MANUAL_OVERRIDE"
        return {"message": "System force-unlocked by Andy Code Protector."}
    
    raise HTTPException(status_code=401, detail="Unauthorized")
