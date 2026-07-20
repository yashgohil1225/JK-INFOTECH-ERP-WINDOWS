# =============================================================
# JK INFOTECH ERP — Support Schemas
# File : app/schemas/support.py
# =============================================================

# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class SupportTicketCreate(BaseModel):
    node: str
    priority: str
    description: str

class SupportTicketResponse(BaseModel):
    id: UUID
    ticket_no: str
    node: str
    priority: str
    description: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class CallbackRequestCreate(BaseModel):
    phone: str

class CallbackRequestResponse(BaseModel):
    id: UUID
    phone: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
