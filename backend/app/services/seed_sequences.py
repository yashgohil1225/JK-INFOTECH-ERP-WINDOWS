# =============================================================
# JK INFOTECH ERP — Seed Sequences
# File : app/services/seed_sequences.py
# =============================================================

from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import DocumentSequence

async def seed_default_sequences_for_company(db: AsyncSession, company_id: UUID):
    """
    Initialize standard document sequences for a new company.
    """
    default_types = [
        {"type": "Sales Invoice", "prefix": "INV/", "padding": 4},
        {"type": "Purchase Bill", "prefix": "PB/", "padding": 4},
        {"type": "Sales Order", "prefix": "SO/", "padding": 4},
        {"type": "Purchase Order", "prefix": "PO/", "padding": 4},
        {"type": "Payment", "prefix": "PAY/", "padding": 5},
        {"type": "Receipt", "prefix": "REC/", "padding": 5},
        {"type": "Journal", "prefix": "JV/", "padding": 4},
        {"type": "Stock Entry", "prefix": "SE/", "padding": 4},
    ]

    for dt in default_types:
        # Check if exists
        result = await db.execute(
            select(DocumentSequence).where(
                DocumentSequence.company_id == company_id,
                DocumentSequence.document_type == dt["type"]
            )
        )
        if not result.scalars().first():
            new_seq = DocumentSequence(
                company_id=company_id,
                document_type=dt["type"],
                prefix=dt["prefix"],
                suffix="", # Explicitly provide empty string for non-nullable column
                padding=dt["padding"],
                next_value=1
            )
            db.add(new_seq)
    
    await db.flush()
