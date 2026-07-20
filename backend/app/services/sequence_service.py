# =============================================================
# JK INFOTECH ERP — Document Sequence Service
# File : app/services/sequence_service.py
# =============================================================

from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import (
    DocumentSequence, Invoice, PurchaseBill, SalesOrder, 
    PurchaseOrder, CreditNote, DebitNote
)
import datetime
import re

async def calculate_next_value(
    db: AsyncSession,
    company_id: UUID,
    document_type: str,
    fallback_value: int
) -> int:
    """
    Scans the database for existing documents of the given type, extracts 
    the numeric portion matching the configured prefix/suffix, and returns 
    the maximum value + 1. If none are found, returns the fallback_value.
    """
    # Mapping of document type to (ORM Model, Column Attribute)
    doc_mapping = {
        "Sales Invoice": (Invoice, Invoice.invoice_number),
        "Purchase Bill": (PurchaseBill, PurchaseBill.bill_number),
        "Sales Order": (SalesOrder, SalesOrder.so_number),
        "Purchase Order": (PurchaseOrder, PurchaseOrder.po_number),
        "Credit Note": (CreditNote, CreditNote.note_number),
        "Debit Note": (DebitNote, DebitNote.note_number),
    }

    if document_type not in doc_mapping:
        return fallback_value

    model, column = doc_mapping[document_type]

    # Query all existing document numbers for the company
    existing_stmt = select(column).where(model.company_id == company_id)
    existing_res = await db.execute(existing_stmt)
    existing_numbers = existing_res.scalars().all()

    # Get prefix/suffix from sequence to parse correctly
    seq_stmt = select(DocumentSequence).where(
        DocumentSequence.company_id == company_id,
        DocumentSequence.document_type == document_type,
        DocumentSequence.is_active == True,
    )
    seq_res = await db.execute(seq_stmt)
    seq = seq_res.scalars().first()

    prefix = seq.prefix or "" if seq else ""
    suffix = seq.suffix or "" if seq else ""

    parsed_values = []
    for num in existing_numbers:
        if not num:
            continue
        # Strip prefix and suffix if they match
        if num.startswith(prefix) and (not suffix or num.endswith(suffix)):
            start_idx = len(prefix)
            end_idx = len(num) - len(suffix) if suffix else len(num)
            middle = num[start_idx:end_idx]
            # Extract numeric part
            digits = re.findall(r'\d+', middle)
            if digits:
                try:
                    parsed_values.append(int(digits[0]))
                except ValueError:
                    pass

    if parsed_values:
        return max(parsed_values) + 1

    return fallback_value


async def get_next_document_number(
    db: AsyncSession,
    company_id: UUID,
    document_type: str,
) -> str:
    """
    Atomically fetch-and-increment the next document number for a company.
    """
    result = await db.execute(
        select(DocumentSequence)
        .where(
            DocumentSequence.company_id == company_id,
            DocumentSequence.document_type == document_type,
            DocumentSequence.is_active == True,
        )
        .with_for_update()
    )
    seq = result.scalars().first()

    if not seq:
        # Fallback: timestamp-based number (safe but not pretty)
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
        return f"{pfx}-{ts}"

    next_val = await calculate_next_value(db, company_id, document_type, seq.next_value)

    # Format the number
    number_str = str(next_val).zfill(seq.padding)
    prefix = seq.prefix or ""
    suffix = seq.suffix or ""
    formatted = f"{prefix}{number_str}{suffix}"

    # Increment and save next_value back to sequence config
    seq.next_value = next_val + 1

    return formatted
