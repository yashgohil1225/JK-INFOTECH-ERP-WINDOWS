# =============================================================
# JK INFOTECH ERP — Support Router
# File : app/routers/support.py
# =============================================================

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func
import uuid
import logging
from datetime import datetime

from app.database import get_db
from app.middleware.auth import get_current_company, get_current_user
from app.models import Company, User, SupportTicket, CallbackRequest
from app.schemas.support import SupportTicketCreate, SupportTicketResponse, CallbackRequestCreate, CallbackRequestResponse

router = APIRouter(
    prefix="/api/v1/support",
    tags=["Support"],
)

SUPPORT_EMAIL = "yashgohil1225@gmail.com"

@router.post("/tickets", response_model=SupportTicketResponse)
async def create_ticket(
    data: SupportTicketCreate,
    user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new support ticket and notifies the team."""
    # Generate a professional ticket number
    count = await db.scalar(select(func.count(SupportTicket.id)))
    ticket_no = f"TKT-{datetime.now().year}-{count + 1:03d}"
    
    ticket = SupportTicket(
        company_id=company.id,
        user_id=user.id,
        ticket_no=ticket_no,
        node=data.node,
        priority=data.priority,
        description=data.description,
        status="OPEN"
    )
    
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    
    # LOG NOTIFICATION (Would be sent via SMTP in production)
    logging.info(f"NOTIFICATION: New Ticket {ticket_no} submitted by {user.full_name} for {company.name}.")
    logging.info(f"Target Support Email: {SUPPORT_EMAIL}")
    
    return ticket

@router.post("/callback", response_model=CallbackRequestResponse)
async def request_callback(
    data: CallbackRequestCreate,
    user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Logs an urgent callback request."""
    request = CallbackRequest(
        company_id=company.id,
        user_id=user.id,
        phone=data.phone,
        status="PENDING"
    )
    
    db.add(request)
    await db.commit()
    await db.refresh(request)
    
    logging.info(f"NOTIFICATION: Urgent Callback requested by {user.full_name} ({company.name}) at {data.phone}.")
    
    return request
