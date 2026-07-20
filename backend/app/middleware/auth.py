# =============================================================
# JK INFOTECT ERP — Auth Middleware
# File : app/middleware/auth.py
# =============================================================

# pyrefly: ignore [missing-import]
from fastapi import Depends, HTTPException, status, Request
# pyrefly: ignore [missing-import]
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from app.core.config import settings
from app.database import get_db
from app.models import User, Company

# Standard OAuth2 scheme for Bearer token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to validate JWT and return the current User.
    Supports standard Bearer token header or query parameter 'token'/'token_q'.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Fallback to query parameters for GET requests (like PDF views/downloads)
    if not token:
        token = request.query_params.get("token") or request.query_params.get("token_q")
        
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalars().first()

    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user

async def get_current_company(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Company:
    """
    Dependency to return the Company associated with the current user.
    """
    from sqlalchemy import select
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalars().first()

    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
        
    return company
async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Optional dependency to validate JWT and return the current User.
    Allows expired tokens specifically for the PIN verification flow.
    """
    if not token:
        return None
        
    try:
        # We allow expired tokens here because this is used by /verify-pin.
        # The PIN itself provides the secondary authentication.
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False} # Allow expired tokens for identification
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
            
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalars().first()
        
        if user and user.is_active:
            return user
    except Exception as e:
        print(f"DEBUG: get_current_user_optional failed: {str(e)}")
        return None
    
    return None
