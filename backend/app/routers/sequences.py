# =============================================================
# JK INFOTECH ERP — Document Sequences Router
# File : app/routers/sequences.py
# =============================================================

from uuid import UUID
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.middleware.auth import get_current_company
from app.models import Company, DocumentSequence
from app.services.seed_sequences import seed_default_sequences_for_company
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

router = APIRouter(
    prefix="/api/v1/sequences",
    tags=["Sequences"],
)

class SequenceUpdate(BaseModel):
    prefix: str | None = None
    suffix: str | None = None
    next_value: int | None = None
    padding: int | None = None
    is_active: bool | None = None

class SequenceResponse(BaseModel):
    id: UUID
    document_type: str
    prefix: str | None
    suffix: str | None
    next_value: int
    padding: int
    is_active: bool

    class Config:
        from_attributes = True

@router.get("/preview/{document_type}")
async def preview_sequence(
    document_type: str,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Preview the next document number without incrementing it."""
    result = await db.execute(
        select(DocumentSequence).where(
            DocumentSequence.company_id == company.id,
            DocumentSequence.document_type == document_type,
            DocumentSequence.is_active == True,
        )
    )
    seq = result.scalars().first()
    if not seq:
        import datetime
        ts = datetime.datetime.now().strftime("%y%m%d%H%M%S")
        prefix_map = {
            "Sales Invoice": "INV",
            "Purchase Bill": "PB",
            "Sales Order": "SO",
            "Purchase Order": "PO",
            "Payment": "PAY",
            "Receipt": "REC",
        }
        pfx = prefix_map.get(document_type, "DOC")
        return {"next_number": f"{pfx}-{ts}"}

    from app.services.sequence_service import calculate_next_value
    next_val = await calculate_next_value(db, company.id, document_type, seq.next_value)
    number_str = str(next_val).zfill(seq.padding)
    prefix = seq.prefix or ""
    suffix = seq.suffix or ""
    return {"next_number": f"{prefix}{number_str}{suffix}"}

@router.get("", response_model=List[SequenceResponse])
@router.get("/", response_model=List[SequenceResponse])
async def get_sequences(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Fetch all document sequences for the company."""
    result = await db.execute(
        select(DocumentSequence).where(DocumentSequence.company_id == company.id)
    )
    seqs = result.scalars().all()

    # Auto-seed if company has no sequences yet
    if not seqs:
        await seed_default_sequences_for_company(db, company.id)
        await db.commit()
        result = await db.execute(
            select(DocumentSequence).where(DocumentSequence.company_id == company.id)
        )
        seqs = result.scalars().all()

    return seqs

@router.patch("/{sequence_id}", response_model=SequenceResponse)
async def update_sequence(
    sequence_id: UUID,
    data: SequenceUpdate,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Update a specific document sequence."""
    result = await db.execute(
        select(DocumentSequence).where(
            DocumentSequence.id == sequence_id,
            DocumentSequence.company_id == company.id
        )
    )
    seq = result.scalars().first()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(seq, field, value)

    await db.commit()
    await db.refresh(seq)
    return seq

@router.post("/reset", response_model=List[SequenceResponse])
async def reset_sequences(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Reset all sequences to default prefix/suffix. Does NOT reset next_value."""
    # Delete existing and re-seed defaults
    result = await db.execute(
        select(DocumentSequence).where(DocumentSequence.company_id == company.id)
    )
    for seq in result.scalars().all():
        await db.delete(seq)
    await db.flush()

    await seed_default_sequences_for_company(db, company.id)
    await db.commit()

    result = await db.execute(
        select(DocumentSequence).where(DocumentSequence.company_id == company.id)
    )
    return result.scalars().all()
