# =============================================================
# JK INFOTECT ERP — Auth Service
# File : app/services/auth.py
# =============================================================

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import bcrypt as _bcrypt
from jose import JWTError, jwt
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from twilio.rest import Client

import logging
from app.core.config import settings

logger = logging.getLogger(__name__)
from app.models import Company, User, UserSession
from fastapi import Request
from app.services.seed_accounts import seed_default_accounts_for_company
from app.services.seed_sequences import seed_default_sequences_for_company
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    SendOtpResponse,
    MessageResponse,
    TokenResponse,
    CompanyResponse,
    UserResponse,
    SetPinRequest,
    VerifyPinRequest,
    UnlockPinRequest,
)


# =============================================================
# PASSWORD HELPERS
# =============================================================

def hash_password(plain_password: str) -> str:
    """Hash password using bcrypt directly."""
    password_bytes = plain_password.encode("utf-8")
    # Industrial Standard: 10 rounds provides high security with optimized performance
    salt = _bcrypt.gensalt(rounds=10)
    return _bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return _bcrypt.checkpw(password_bytes, hashed_bytes)


# =============================================================
# JWT TOKEN HELPERS
# =============================================================

def create_access_token(user_id: UUID, company_id: UUID) -> str:
    """Create a short-lived JWT access token (15 minutes)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub":        str(user_id),
        "company_id": str(company_id),
        "type":       "access",
        "exp":        expire,
        "iat":        datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: UUID, company_id: UUID) -> str:
    """Create a long-lived JWT refresh token (30 days)."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub":        str(user_id),
        "company_id": str(company_id),
        "type":       "refresh",
        "exp":        expire,
        "iat":        datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM]
    )


def create_token_response(user_id: UUID, company_id: UUID) -> TokenResponse:
    """Create both access and refresh tokens together."""
    return TokenResponse(
        access_token=create_access_token(user_id, company_id),
        refresh_token=create_refresh_token(user_id, company_id),
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# =============================================================
# AUTH SERVICE CLASS
# =============================================================

class AuthService:
    """All authentication operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> RegisterResponse:
        """Register a new Company + Admin User together."""

        # 1. Check for duplicate email
        existing_email = await self.db.execute(
            select(User).where(User.email == data.email.lower())
        )
        if existing_email.scalars().first():
            raise ValueError("An account with this email already exists")

        # 2. Check for duplicate phone
        if data.phone:
            existing_phone = await self.db.execute(
                select(User).where(User.phone == data.phone)
            )
            if existing_phone.scalars().first():
                raise ValueError("An account with this mobile number already exists")

        # 3. Create a placeholder company
        company = Company(
            name="Pending Setup",
            is_active=True,
        )
        self.db.add(company)
        await self.db.flush() # Get company.id

        # 4. Create the Admin User
        user = User(
            company_id=company.id,
            full_name=data.full_name.strip(),
            email=data.email.lower(),
            password_hash=hash_password(data.password),
            phone=data.phone,
            is_active=True,
            is_superadmin=True,
        )
        self.db.add(user)
        await self.db.flush() # Get user.id

        # 5. Auto-seed default accounts and document sequences for the new company
        # We do this BEFORE the final commit to ensure everything is atomic
        await seed_default_accounts_for_company(self.db, company.id, user.id)
        await seed_default_sequences_for_company(self.db, company.id)

        # 6. Capture response data BEFORE commit expires objects
        user_resp    = UserResponse.model_validate(user)
        user_resp.has_pin = user.pin_hash is not None
        company_resp = CompanyResponse.model_validate(company)

        # 7. Final atomic commit
        try:
            await self.db.commit()
        except IntegrityError as e:
            await self.db.rollback()
            if "users_phone_key" in str(e):
                raise ValueError("This mobile number is already registered with another account")
            if "users_email_key" in str(e):
                raise ValueError("An account with this email already exists")
            raise ValueError(f"Registration failed due to a database conflict: {str(e)}")

        tokens = create_token_response(user.id, company.id)

        return RegisterResponse(
            message="Registration successful! Welcome to JK INFOTECT ERP.",
            user=user_resp,
            company=company_resp,
            tokens=tokens,
        )

    async def local_auto_login(self, request_info: dict = None) -> LoginResponse:
        """
        Auto-login for local Windows environment.
        If any user exists, log in as the first available active user.
        If no user exists (first run), automatically register a default local user and company.
        """
        # 1. Query for any existing user
        stmt = select(User).order_by(User.last_login.desc().nulls_last(), User.created_at.asc())
        result = await self.db.execute(stmt)
        user = result.scalars().first()

        if not user:
            # 2. No user exists. Setup default company and user
            logger.info("No local user found. Performing auto-setup...")
            company = Company(
                name="My Business Entity",
                is_active=True,
            )

            self.db.add(company)
            await self.db.flush() # Get company.id

            user = User(
                company_id=company.id,
                full_name="Local Administrator",
                email="admin@jkerp.local",
                password_hash=hash_password("localadminpassword"),
                phone="9999999999",
                is_active=True,
                is_superadmin=True,
            )
            self.db.add(user)
            await self.db.flush()

            # Seed accounts & sequences
            await seed_default_accounts_for_company(self.db, company.id, user.id)
            await seed_default_sequences_for_company(self.db, company.id)
            await self.db.commit()
            await self.db.refresh(user)
        else:
            # Check user is active
            if not user.is_active:
                user.is_active = True
                self.db.add(user)
                await self.db.commit()
                await self.db.refresh(user)

        # 3. Load company context
        company_result = await self.db.execute(select(Company).where(Company.id == user.company_id))
        company = company_result.scalar_one()

        user.last_login = datetime.now(timezone.utc)
        
        user_resp = UserResponse.model_validate(user)
        user_resp.has_pin = user.pin_hash is not None
        company_resp = CompanyResponse.model_validate(company)

        tokens = create_token_response(user.id, company.id)

        # Create session
        session_expiry = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        new_session = UserSession(
            user_id=user.id,
            refresh_token=tokens.refresh_token,
            expires_at=session_expiry,
            user_agent=request_info.get("user_agent") if request_info else None,
            ip_address=request_info.get("ip_address") if request_info else None,
            is_revoked=False
        )
        self.db.add(new_session)
        await self.db.commit()
        await self.db.refresh(user)

        return LoginResponse(user=user_resp, company=company_resp, tokens=tokens)

    async def has_pin(self, login_id: str) -> bool:
        """Check if any user with this email or phone has a PIN."""
        login_id = login_id.strip().lower()
        if "@" in login_id:
            stmt = select(User).where(User.email == login_id)
        else:
            stmt = select(User).where(User.phone == login_id)
        
        result = await self.db.execute(stmt)
        users = result.scalars().all()
        
        if not users:
            raise ValueError("No account found with this identifier")
            
        return any(u.pin_hash is not None for u in users)

    async def send_otp(self, login_id: str) -> SendOtpResponse:
        """Send OTP to an existing user's mobile number via Twilio Verify."""
        login_id = login_id.strip()

        # Check if user exists with this phone number (prioritize active accounts)
        stmt = select(User).where(User.phone == login_id).order_by(User.is_active.desc())
        result = await self.db.execute(stmt)
        user: Optional[User] = result.scalars().first()

        if not user:
            raise ValueError("No account found with this mobile number")

        if not user.is_active:
            raise ValueError("Your account has been deactivated. Contact admin.")

        # Ensure Twilio is configured
        if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_VERIFY_SERVICE_SID]):
            if settings.ENVIRONMENT == "production":
                raise ValueError("SMS / OTP service is not configured on this server. Please contact support.")
            # Fallback for local testing when keys are missing
            print(f"\n======================================")
            print(f"MOCK SMS SENT TO: {user.phone}")
            print(f"MESSAGE: Your JK INFOTECT ERP OTP is 123456")
            print(f"======================================\n")
            return SendOtpResponse(message="Mock OTP sent successfully.")

        try:
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            verification = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verifications.create(
                to=user.phone, channel="sms"
            )
            return SendOtpResponse(message=f"OTP sent successfully. Status: {verification.status}")
        except Exception as e:
            # Handle standard twilio exceptions cleanly
            if "status code: 400" in str(e).lower() and "unverified phone number" in str(e).lower():
                raise ValueError("Twilio error: Target phone number is unverified for trial accounts.")
            raise ValueError(f"Failed to send OTP: {str(e)}")

    async def login(self, data: LoginRequest) -> LoginResponse:
        """Login with email or phone + password/otp/pin."""
        login_id = data.login_id.strip().lower()
        if "@" in login_id:
            stmt = select(User).where(User.email == login_id)
        else:
            stmt = select(User).where(User.phone == data.login_id.strip())

        stmt = stmt.order_by(User.last_login.desc().nulls_last())
        result = await self.db.execute(stmt)
        users = result.scalars().all()

        if not users:
            raise ValueError("Invalid email/phone or password/otp")
        
        valid_user = None

        # Determine authentication method
        if data.otp:
            user = users[0]
            if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_VERIFY_SERVICE_SID]):
                if settings.ENVIRONMENT == "production":
                    raise ValueError("SMS / OTP service is not configured. Cannot authenticate.")
                if data.otp != "123456":
                    raise ValueError("Invalid mock OTP. Use 123456 for local testing.")
            else:
                try:
                    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                    verification_check = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verification_checks.create(
                        to=user.phone, code=data.otp
                    )
                    if verification_check.status != "approved":
                        raise ValueError("Invalid or expired OTP")
                except Exception as e:
                    if isinstance(e, ValueError): raise
                    raise ValueError(f"OTP verification failed: {str(e)}")
            valid_user = user
        elif data.pin:
            for u in users:
                if u.pin_hash and verify_password(data.pin, u.pin_hash):
                    if u.pin_locked_until and u.pin_locked_until > datetime.now(timezone.utc):
                        diff = u.pin_locked_until - datetime.now(timezone.utc)
                        minutes = max(1, int(diff.total_seconds() // 60))
                        raise ValueError(f"PIN entry is locked. Try again in {minutes}m or use Password.")
                    u.failed_pin_attempts = 0
                    u.pin_locked_until = None
                    valid_user = u
                    break
            
            if not valid_user:
                for u in users:
                    if u.pin_hash:
                        u.failed_pin_attempts += 1
                        if u.failed_pin_attempts >= 3:
                            u.pin_locked_until = datetime.now(timezone.utc) + timedelta(minutes=10)
                await self.db.commit()
                raise ValueError("Invalid Quick Access PIN")
        elif data.password:
            # —— DEEP OPTIMIZATION: Multi-Tenant Hashing Efficiency ——
            unique_hashes = {}
            for u in users:
                if u.password_hash not in unique_hashes:
                    unique_hashes[u.password_hash] = u
            
            for pwd_hash, u in unique_hashes.items():
                if verify_password(data.password, pwd_hash):
                    valid_user = u
                    break
            
            if not valid_user:
                raise ValueError("Invalid email/phone or password")
        else:
             raise ValueError("Either password, PIN or OTP must be provided")

        user = valid_user
        if not user.is_active:
            raise ValueError("Your account has been deactivated. Contact admin.")

        user.last_login = datetime.now(timezone.utc)
        
        # Load company context
        company_result = await self.db.execute(select(Company).where(Company.id == user.company_id))
        company: Company = company_result.scalar_one()

        user_resp = UserResponse.model_validate(user)
        user_resp.has_pin = user.pin_hash is not None
        company_resp = CompanyResponse.model_validate(company)

        tokens = create_token_response(user.id, company.id)

        # Create session
        refresh_duration = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS) if data.remember_me else timedelta(days=1)
        session_expiry = datetime.now(timezone.utc) + refresh_duration

        new_session = UserSession(
            user_id=user.id,
            refresh_token=tokens.refresh_token,
            expires_at=session_expiry,
            user_agent=getattr(data, "_user_agent", None),
            ip_address=getattr(data, "_ip_address", None),
            is_revoked=False
        )
        self.db.add(new_session)
        
        # ATOMIC COMMIT: Everything happens in one roundtrip
        await self.db.commit()
        await self.db.refresh(user)

        return LoginResponse(user=user_resp, company=company_resp, tokens=tokens)

    async def refresh_tokens(self, refresh_token: str, request_info: dict = None) -> TokenResponse:
        """
        Exchange a valid refresh token for new tokens with Rotation (RTR).
        High Security: If an old token is reused, we revoke ALL sessions for that user.
        """
        try:
            payload = decode_token(refresh_token)
        except JWTError:
            raise ValueError("Invalid or expired refresh token")

        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")

        user_id    = UUID(payload["sub"])
        company_id = UUID(payload["company_id"])

        # 1. Lookup session in DB
        stmt = select(UserSession).where(UserSession.refresh_token == refresh_token)
        result = await self.db.execute(stmt)
        session = result.scalars().first()

        # ── SECURITY CASE: Token Reuse Detection (Replay Attack) ──
        if session and (session.is_revoked or session.expires_at < datetime.now(timezone.utc)):
            # Someone is trying to reuse a token that was already refreshed or has expired.
            # This is a major red flag (stolen token). We revoke EVERYTHING for this user.
            logger.warning(f"SECURITY ALERT: Token reuse detected for user {user_id}. Revoking all sessions.")
            revoke_stmt = (
                select(UserSession)
                .where(UserSession.user_id == user_id, UserSession.is_revoked == False)
            )
            all_sessions = (await self.db.execute(revoke_stmt)).scalars().all()
            for s in all_sessions:
                s.is_revoked = True
            await self.db.commit()
            raise ValueError("Security breach detected. Please log in again using your credentials.")

        if not session:
            # If "Remember Me" wasn't checked, the token won't be in DB.
            # We still allow refresh based on JWT validity, but without rotation tracking.
            # For "Industrial Grade", we could require ALL refresh tokens to be in DB.
            # Let's enforce DB-backed refresh for high security.
            raise ValueError("Session not found or expired. Please log in again.")

        # 2. Check User Status
        user_stmt = select(User).where(User.id == user_id, User.is_active == True)
        user = (await self.db.execute(user_stmt)).scalar_one_or_none()
        if not user:
            raise ValueError("User not found or deactivated")

        # 3. ROTATION: Issue new tokens and revoke old session
        new_tokens = create_token_response(user_id, company_id)
        
        # Detect if this was a "Remembered" session to set the new expiry
        # If the original session had more than 2 days total duration, we treat it as "Remembered"
        was_remembered = (session.expires_at - session.created_at) > timedelta(days=1, hours=1)
        new_expiry_duration = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS) if was_remembered else timedelta(days=1)
        
        # Mark old session as revoked
        session.is_revoked = True
        
        # Create NEW session for the rotated token (with sliding window)
        new_session = UserSession(
            user_id=user_id,
            refresh_token=new_tokens.refresh_token,
            expires_at=datetime.now(timezone.utc) + new_expiry_duration,
            user_agent=request_info.get("user_agent") if request_info else session.user_agent,
            ip_address=request_info.get("ip_address") if request_info else session.ip_address,
            is_revoked=False
        )
        self.db.add(new_session)
        
        await self.db.commit()

        return new_tokens

    async def revoke_session(self, refresh_token: str) -> bool:
        """Manually revoke a session (Logout sequence)."""
        stmt = select(UserSession).where(UserSession.refresh_token == refresh_token)
        result = await self.db.execute(stmt)
        session = result.scalars().first()
        if session:
            session.is_revoked = True
            await self.db.commit()
            return True
        return False

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Load a user from DB by their UUID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.is_active == True)
        )
        return result.scalar_one_or_none()

    async def change_password(
        self, user: User, current_password: str, new_password: str
    ) -> None:
        """Verify current password then set new one."""
        if not verify_password(current_password, user.password_hash):
            raise ValueError("Current password is incorrect")
        user.password_hash = hash_password(new_password)
        await self.db.commit()

    async def forgot_password(self, login_id: str) -> MessageResponse:
        """Request OTP for password reset — looks up user by phone number."""
        login_id = login_id.strip()
        stmt = select(User).where(User.phone == login_id)
        result = await self.db.execute(stmt)
        user: Optional[User] = result.scalars().first()

        if not user:
            raise ValueError("No account found with this mobile number.")
        if not user.is_active:
            raise ValueError("This account has been deactivated. Contact admin.")

        # Reuse existing send_otp logic
        await self.send_otp(login_id)
        return MessageResponse(message="OTP sent successfully for password reset.")

    async def reset_password(self, data: ResetPasswordRequest) -> MessageResponse:
        """Reset the password using OTP."""
        login_id = data.login_id.strip()
        stmt = select(User).where(User.phone == login_id)
        result = await self.db.execute(stmt)
        users = result.scalars().all()

        if not users:
            raise ValueError("No account found with this mobile number.")
            
        user = users[0]
        if not user.phone:
            raise ValueError("No phone number registered for this user.")

        # Verify OTP
        if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_VERIFY_SERVICE_SID]):
            if settings.ENVIRONMENT == "production":
                raise ValueError("SMS / OTP service is not configured. Cannot reset password.")
            if data.otp != "123456":
                raise ValueError("Invalid mock OTP. Use 123456 for local testing.")
        else:
            try:
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                verification_check = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verification_checks.create(
                    to=user.phone, code=data.otp
                )
                if verification_check.status != "approved":
                    raise ValueError("Invalid or expired OTP")
            except Exception as e:
                if isinstance(e, ValueError):
                    raise
                raise ValueError(f"OTP verification failed: {str(e)}")

        # Verification successful — update password
        for u in users:
            u.password_hash = hash_password(data.new_password)
            self.db.add(u)
        await self.db.commit()
        return MessageResponse(message="Password reset successfully")
    async def get_associated_companies(self, user: User) -> list[CompanyResponse]:
        """Get all companies this user's email has access to (or all active companies for superadmin)."""
        if user.is_superadmin:
            query = select(Company).where(Company.is_active == True).order_by(Company.name.asc())
        else:
            subq = (
                select(User.company_id, func.max(User.last_login).label("latest_login"))
                .where(User.email == user.email, User.is_active == True)
                .group_by(User.company_id)
            ).subquery()

            query = (
                select(Company)
                .join(subq, Company.id == subq.c.company_id)
                .where(Company.is_active == True)
                .order_by(subq.c.latest_login.desc().nulls_last(), Company.name.asc())
            )

        comp_result = await self.db.execute(query)
        companies = comp_result.scalars().all()
        return [CompanyResponse.model_validate(c) for c in companies]

    async def switch_company(
        self, 
        user: User, 
        target_company_id: UUID, 
        user_agent: Optional[str] = None, 
        ip_address: Optional[str] = None
    ) -> TokenResponse:
        """Switch to another company using the same email."""
        # Check if a user record exists for this email and target company
        result = await self.db.execute(
            select(User).where(
                User.email == user.email,
                User.company_id == target_company_id,
                User.is_active == True
            )
        )
        target_user = result.scalars().first()
        
        if not target_user:
            if user.is_superadmin:
                target_user = User(
                    company_id=target_company_id,
                    full_name=user.full_name,
                    email=user.email,
                    password_hash=user.password_hash,
                    phone=user.phone,
                    is_active=True,
                    is_superadmin=True,
                )
                self.db.add(target_user)
                await self.db.flush()
            else:
                raise ValueError("You do not have access to this company.")
            
        # Update last login
        target_user.last_login = datetime.now(timezone.utc)

        # Build response/tokens BEFORE potential session issues
        tokens = create_token_response(target_user.id, target_company_id)

        # Create rotated session in database for sliding window token tracking
        new_session = UserSession(
            user_id=target_user.id,
            refresh_token=tokens.refresh_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=user_agent,
            ip_address=ip_address,
            is_revoked=False
        )
        self.db.add(new_session)

        await self.db.commit()
        
        return tokens

    async def set_pin(self, user: User, data: SetPinRequest) -> None:
        """Set quick access PIN directly without password validation."""
        # Use bcrypt to hash the PIN as well — it's secure enough
        user.pin_hash = hash_password(data.pin)
        user.failed_pin_attempts = 0
        user.pin_locked_until = None
        await self.db.commit()

    async def verify_pin(
        self, 
        pin: str, 
        user: Optional[User] = None, 
        login_id: Optional[str] = None,
        refresh_token: Optional[str] = None,
        user_agent: str = None, 
        ip_address: str = None
    ) -> TokenResponse:
        """Authenticate using PIN and issue fresh session tokens."""
        try:
            from app.models import UserSession
            target_user = user
            
            # 1. Resolve user if not provided via login_id or current context
            if not target_user:
                # Fallback A: Use login_id (email/phone)
                if login_id:
                    login_id_clean = login_id.strip().lower()
                    if "@" in login_id_clean:
                        stmt = select(User).where(User.email == login_id_clean)
                    else:
                        stmt = select(User).where(User.phone == login_id_clean)
                    
                    stmt = stmt.order_by(User.last_login.desc().nulls_last())
                    result = await self.db.execute(stmt)
                    users = result.scalars().all()
                
                # Fallback B: Use refresh_token to identify user
                elif refresh_token:
                    stmt = select(User).join(
                        UserSession, 
                        User.id == UserSession.user_id
                    ).where(
                        UserSession.refresh_token == refresh_token,
                        UserSession.is_revoked == False
                    )
                    result = await self.db.execute(stmt)
                    users = [result.scalars().first()] if result else []
                
                else:
                    users = []

                if not users or users[0] is None:
                    raise ValueError("Authentication context missing. Please provide user or login_id.")
                
                # Check PIN against all candidate users
                for u in users:
                    if u.pin_hash and verify_password(pin, u.pin_hash):
                        target_user = u
                        break
                
                if not target_user:
                    # Increment failed attempts for all users with this login_id who have a PIN
                    for u in users:
                        if u.pin_hash:
                            u.failed_pin_attempts += 1
                            if u.failed_pin_attempts >= 3:
                                u.pin_locked_until = datetime.now(timezone.utc) + timedelta(minutes=10)
                    await self.db.commit()
                    raise ValueError("Invalid Quick Access PIN")
            
            if not target_user:
                raise ValueError("Authentication context missing. Please provide user or login_id.")

            # 2. Ensure user is fresh and attached to session
            target_user = await self.db.merge(target_user)
            await self.db.refresh(target_user)
            
            if not target_user.pin_hash:
                raise ValueError("PIN authentication is not configured for this account.")
            
            # 3. Check if currently locked
            if target_user.pin_locked_until and target_user.pin_locked_until > datetime.now(timezone.utc):
                diff = target_user.pin_locked_until - datetime.now(timezone.utc)
                minutes = int(diff.total_seconds() // 60)
                if minutes < 1:
                    minutes = 1
                raise ValueError(f"PIN entry is locked. Try again in {minutes}m or use OTP to unlock.")

            # 4. Verify PIN (if we didn't already verify it in the login_id branch)
            if not verify_password(pin, target_user.pin_hash):
                target_user.failed_pin_attempts += 1
                if target_user.failed_pin_attempts >= 3:
                    target_user.pin_locked_until = datetime.now(timezone.utc) + timedelta(minutes=10)
                    await self.db.commit()
                    raise ValueError("Too many failed attempts. PIN locked for 10 minutes.")
                
                await self.db.commit()
                remaining = 3 - target_user.failed_pin_attempts
                raise ValueError(f"Invalid Quick Access PIN. {remaining} attempts remaining.")
            
            # 5. PIN matches! Reset counters
            target_user.failed_pin_attempts = 0
            target_user.pin_locked_until = None
            target_user.last_login = datetime.now(timezone.utc)
            
            tokens = create_token_response(target_user.id, target_user.company_id)
            
            # 6. Create a persistent session
            session_expiry = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            new_session = UserSession(
                user_id=target_user.id,
                refresh_token=tokens.refresh_token,
                expires_at=session_expiry,
                user_agent=user_agent,
                ip_address=ip_address,
                is_revoked=False
            )
            self.db.add(new_session)
            await self.db.commit()
            
            return tokens
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Critical failure in verify_pin: {str(e)}", exc_info=True)
            raise ValueError("Internal authentication protocol failure. Please re-login.")

    async def unlock_pin(self, data: UnlockPinRequest) -> MessageResponse:
        """Reset PIN lock using mobile OTP."""
        login_id = data.login_id.strip()
        stmt = select(User).where(User.phone == login_id).order_by(User.is_active.desc())
        result = await self.db.execute(stmt)
        users = result.scalars().all()

        if not users:
            raise ValueError("No account found with this mobile number.")
            
        user = users[0]
        
        # Verify OTP
        if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_VERIFY_SERVICE_SID]):
            if settings.ENVIRONMENT == "production":
                raise ValueError("SMS / OTP service is not configured. Cannot unlock PIN.")
            if data.otp != "123456":
                raise ValueError("Invalid mock OTP. Use 123456 for local testing.")
        else:
            try:
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                verification_check = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verification_checks.create(
                    to=user.phone, code=data.otp
                )
                if verification_check.status != "approved":
                    raise ValueError("Invalid or expired OTP")
            except Exception as e:
                raise ValueError(f"OTP verification failed: {str(e)}")

        # Success! Reset locks for all accounts associated with this phone
        for u in users:
            u.failed_pin_attempts = 0
            u.pin_locked_until = None
            self.db.add(u)
        
        await self.db.commit()
        return MessageResponse(message="PIN entry unlocked successfully. You can now use your PIN again.")

    async def update_security_settings(self, user: User, pin_login_enabled: bool) -> UserResponse:
        """Update user security preferences."""
        if pin_login_enabled and not user.pin_hash:
            raise ValueError("You must configure a PIN before enabling PIN-based login.")
            
        user.pin_login_enabled = pin_login_enabled
        await self.db.commit()
        await self.db.refresh(user)
        
        resp = UserResponse.model_validate(user)
        resp.has_pin = user.pin_hash is not None
        return resp