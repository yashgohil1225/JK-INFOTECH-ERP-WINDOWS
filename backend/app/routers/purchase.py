from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
import logging

logger = logging.getLogger("purchase")

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import (
    PurchaseOrder, PurchaseBill, Supplier, Company, User, 
    PurchaseOrderItem, DebitNote, DebitNoteItem, StockEntry,
    PurchaseBillItem, Batch
)
from app.schemas.purchase import (
    PurchaseOrder as POSchema, PurchaseOrderCreate,
    PurchaseBill as BillSchema, PurchaseBillCreate,
    DebitNote as DebitNoteSchema, DebitNoteCreate
)
from app.services.reports import ReportService
from app.services.sequence_service import get_next_document_number
from fastapi.responses import Response


router = APIRouter(prefix="/api/v1/purchase", tags=["Purchase"])

# --- Purchase Orders ---
@router.get("/orders", response_model=List[POSchema])
async def list_purchase_orders(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.company_id == company.id)
        .order_by(PurchaseOrder.order_date.desc())
    )
    return result.scalars().unique().all()

@router.post("/orders", response_model=POSchema)
async def create_purchase_order(
    po_in: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    supplier = await db.get(Supplier, po_in.supplier_id)
    if not supplier or not supplier.is_active:
        raise HTTPException(status_code=400, detail="Supplier not found or inactive.")

    po_number = await get_next_document_number(db, company.id, "Purchase Order")

    new_po = PurchaseOrder(
        **po_in.model_dump(exclude={"items", "po_number"}),
        po_number=po_number,
        company_id=company.id,
        status="DRAFT",
        created_by=current_user.id
    )
    
    subtotal = Decimal("0.0")
    tax_amount = Decimal("0.0")
    
    for item_in in po_in.items:
        line_sub = item_in.quantity * item_in.unit_price
        discount = line_sub * (item_in.discount_pct / 100)
        line_taxable = line_sub - discount
        line_tax = line_taxable * (item_in.tax_rate / 100)
        line_total = line_taxable + line_tax
        
        item = PurchaseOrderItem(
            **item_in.model_dump(),
            tax_amount=line_tax,
            total=line_total,
            received_quantity=0
        )
        new_po.items.append(item)
        subtotal += line_taxable
        tax_amount += line_tax

    new_po.subtotal = subtotal
    new_po.tax_amount = tax_amount
    new_po.total = subtotal + tax_amount
    
    db.add(new_po)
    await db.commit()
    await db.refresh(new_po)
    return new_po

# --- Purchase Bills ---
@router.get("/bills", response_model=List[BillSchema])
async def list_purchase_bills(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(PurchaseBill)
        .options(selectinload(PurchaseBill.items))
        .where(PurchaseBill.company_id == company.id)
        .order_by(PurchaseBill.bill_date.desc())
    )
    return result.scalars().unique().all()

@router.post("/bills", response_model=BillSchema)
async def create_bill(
    bill_in: PurchaseBillCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    from app.core.fy_validator import validate_transaction_date
    await validate_transaction_date(db, company.id, bill_in.bill_date)

    logger.info(f"[CREATE_BILL] Received {len(bill_in.items)} items")
    print(f"[CREATE_BILL] items count: {len(bill_in.items)}")

    supplier = await db.get(Supplier, bill_in.supplier_id)
    if not supplier or not supplier.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Procurement Protocol Failure: Target vendor is currently deactivated."
        )

    # Auto-generate bill number from sequence
    bill_number = await get_next_document_number(db, company.id, "Purchase Bill")

    try:
        new_bill = PurchaseBill(
            **bill_in.model_dump(exclude={"items", "due_days", "narration_1", "narration_2", "bill_number"}),
            bill_number=bill_number,
            company_id=company.id,
            status="PENDING",
            amount_paid=0,
            balance_due=bill_in.total
        )

        subtotal = Decimal("0.0")
        tax_amount = Decimal("0.0")
        for item_in in bill_in.items:
            line_val = item_in.quantity * item_in.unit_price
            line_tax = line_val * (item_in.tax_rate / Decimal("100"))
            line_total = line_val + line_tax

            # Resolve/Create batch if batch_number is provided
            resolved_batch_id = item_in.batch_id
            if not resolved_batch_id and item_in.batch_number:
                # Search if batch already exists
                batch_stmt = select(Batch).where(
                    Batch.company_id == company.id,
                    Batch.product_id == item_in.product_id,
                    Batch.batch_number == item_in.batch_number.strip()
                )
                batch_res = await db.execute(batch_stmt)
                existing_batch = batch_res.scalar_one_or_none()
                if existing_batch:
                    resolved_batch_id = existing_batch.id
                else:
                    # Create a new batch
                    new_batch = Batch(
                        company_id=company.id,
                        product_id=item_in.product_id,
                        batch_number=item_in.batch_number.strip(),
                        manufacturing_date=item_in.manufacturing_date,
                        expiry_date=item_in.expiry_date,
                        cost_price=item_in.unit_price,
                        sale_price=item_in.unit_price,  # default sale price to purchase price
                        is_active=True
                    )
                    db.add(new_batch)
                    await db.flush()  # to get new_batch.id
                    resolved_batch_id = new_batch.id

            item = PurchaseBillItem(
                product_id=item_in.product_id,
                quantity=item_in.quantity,
                quantity_2=item_in.quantity_2 or Decimal("0"),
                quantity_3=item_in.quantity_3 or Decimal("0"),
                unit_price=item_in.unit_price,
                tax_rate=item_in.tax_rate,
                tax_amount=line_tax,
                total=line_total,
                p_challan_no=item_in.p_challan_no,
                batch_id=resolved_batch_id,
            )
            new_bill.items.append(item)
            subtotal += line_val
            tax_amount += line_tax

            # INVENTORY SYNC: Add stock inward
            stock_entry = StockEntry(
                company_id=company.id,
                product_id=item_in.product_id,
                batch_id=resolved_batch_id,
                quantity=item_in.quantity,
                entry_type="PURCHASE_IN",
                reference_type="purchase_bill",
                reference_id=new_bill.id,
                notes=f"Stock Inward via Purchase Bill {new_bill.bill_number}",
                created_by=current_user.id
            )
            db.add(stock_entry)


        new_bill.subtotal = subtotal
        new_bill.tax_amount = tax_amount

        db.add(new_bill)
        await db.commit()
        await db.refresh(new_bill, ["items"])
        print(f"[CREATE_BILL] Saved bill {new_bill.bill_number} with {len(new_bill.items)} items")
        return new_bill
    except Exception as e:
        await db.rollback()
        print(f"[CREATE_BILL ERROR] {type(e).__name__}: {e}")
        logger.exception("create_bill failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/bills/{bill_id}", response_model=BillSchema)
async def update_purchase_bill(
    bill_id: UUID,
    bill_in: PurchaseBillCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    stmt = select(PurchaseBill).options(selectinload(PurchaseBill.items)).where(
        PurchaseBill.id == bill_id,
        PurchaseBill.company_id == company.id
    )
    result = await db.execute(stmt)
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Purchase bill not found.")

    from app.core.fy_validator import validate_transaction_date
    await validate_transaction_date(db, company.id, bill.bill_date)
    await validate_transaction_date(db, company.id, bill_in.bill_date)

    supplier = await db.get(Supplier, bill_in.supplier_id)
    if not supplier or not supplier.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Procurement Protocol Failure: Target vendor is currently deactivated."
        )

    # Legal Check: Cannot modify total below already paid amount
    if bill_in.total < bill.amount_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reduce bill total below the amount already paid (Paid: ₹{bill.amount_paid:.2f}). Please delete or adjust the payments first."
        )

    # Delete old StockEntry records for this bill
    from app.models import StockEntry
    from sqlalchemy import delete
    await db.execute(
        delete(StockEntry).where(
            StockEntry.company_id == company.id,
            StockEntry.reference_type == "purchase_bill",
            StockEntry.reference_id == bill_id
        )
    )

    _SKIP_FIELDS = {"items", "due_days", "narration_1", "narration_2"}
    # Update fields (skip schema-only fields not on the ORM model)
    for field, value in bill_in.model_dump(exclude=_SKIP_FIELDS).items():
        if hasattr(bill, field):
            setattr(bill, field, value)

    # Clear and recreate items
    bill.items.clear()
    subtotal = Decimal("0.0")
    tax_amount = Decimal("0.0")
    for item_in in bill_in.items:
        line_val = item_in.quantity * item_in.unit_price
        line_tax = line_val * (item_in.tax_rate / Decimal("100"))
        line_total = line_val + line_tax

        # Resolve/Create batch if batch_number is provided
        resolved_batch_id = item_in.batch_id
        if not resolved_batch_id and item_in.batch_number:
            # Search if batch already exists
            batch_stmt = select(Batch).where(
                Batch.company_id == company.id,
                Batch.product_id == item_in.product_id,
                Batch.batch_number == item_in.batch_number.strip()
            )
            batch_res = await db.execute(batch_stmt)
            existing_batch = batch_res.scalar_one_or_none()
            if existing_batch:
                resolved_batch_id = existing_batch.id
            else:
                # Create a new batch
                new_batch = Batch(
                    company_id=company.id,
                    product_id=item_in.product_id,
                    batch_number=item_in.batch_number.strip(),
                    manufacturing_date=item_in.manufacturing_date,
                    expiry_date=item_in.expiry_date,
                    cost_price=item_in.unit_price,
                    sale_price=item_in.unit_price,
                    is_active=True
                )
                db.add(new_batch)
                await db.flush()  # to get new_batch.id
                resolved_batch_id = new_batch.id

        item = PurchaseBillItem(
            product_id=item_in.product_id,
            quantity=item_in.quantity,
            quantity_2=item_in.quantity_2 or Decimal("0"),
            quantity_3=item_in.quantity_3 or Decimal("0"),
            unit_price=item_in.unit_price,
            tax_rate=item_in.tax_rate,
            tax_amount=line_tax,
            total=line_total,
            p_challan_no=item_in.p_challan_no,
            batch_id=resolved_batch_id,
        )
        bill.items.append(item)
        subtotal += line_val
        tax_amount += line_tax

        # INVENTORY SYNC: Re-create stock inward
        stock_entry = StockEntry(
            company_id=company.id,
            product_id=item_in.product_id,
            batch_id=resolved_batch_id,
            quantity=item_in.quantity,
            entry_type="PURCHASE_IN",
            reference_type="purchase_bill",
            reference_id=bill.id,
            notes=f"Stock Inward via Purchase Bill {bill.bill_number}",
            created_by=current_user.id
        )
        db.add(stock_entry)


    bill.subtotal = subtotal
    bill.tax_amount = tax_amount
    bill.balance_due = bill.total - bill.amount_paid
    if bill.balance_due <= 0:
        bill.status = "PAID"
    elif bill.amount_paid > 0:
        bill.status = "PARTIAL"
    else:
        bill.status = "PENDING"

    await db.commit()
    await db.refresh(bill, ["items"])
    print(f"[UPDATE_BILL] Saved {bill.bill_number} with {len(bill.items)} items")
    return bill


@router.delete("/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchase_bill(
    bill_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    stmt = select(PurchaseBill).where(
        PurchaseBill.id == bill_id,
        PurchaseBill.company_id == company.id
    )
    result = await db.execute(stmt)
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase bill not found.")

    from app.core.fy_validator import validate_transaction_date
    await validate_transaction_date(db, company.id, bill.bill_date)

    # Cascade delete associated payments
    from app.models import Payment
    await db.execute(
        delete(Payment).where(
            Payment.company_id == company.id,
            Payment.reference_type == "purchase_bill",
            Payment.reference_id == bill_id
        )
    )

    # Cascade delete associated debit notes & their stock entries
    dn_stmt = select(DebitNote).where(DebitNote.bill_id == bill_id)
    dn_res = await db.execute(dn_stmt)
    debit_notes = dn_res.scalars().all()
    
    for note in debit_notes:
        # Delete related StockEntry records for the debit note (PURCHASE_RETURN)
        await db.execute(
            delete(StockEntry).where(
                StockEntry.company_id == company.id,
                StockEntry.reference_type == "debit_note",
                StockEntry.reference_id == note.id
            )
        )
        # Delete the debit note itself (cascade deletes DebitNoteItem)
        await db.delete(note)


    # Delete related StockEntry records
    await db.execute(
        delete(StockEntry).where(
            StockEntry.company_id == company.id,
            StockEntry.reference_type == "purchase_bill",
            StockEntry.reference_id == bill_id
        )
    )

    await db.delete(bill)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/bills/{bill_id}/pdf")
async def get_bill_pdf(
    bill_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    service = ReportService(db, company.id)
    try:
        # Retrieve bill number to form a descriptively-named PDF
        bill_stmt = select(PurchaseBill.bill_number).where(
            PurchaseBill.id == bill_id,
            PurchaseBill.company_id == company.id
        )
        bill_res = await db.execute(bill_stmt)
        bill_number = bill_res.scalar_one_or_none() or str(bill_id)
        safe_filename = bill_number.replace('/', '_').replace(' ', '_')
        
        pdf_bytes = await service.generate_purchase_bill_pdf(bill_id, company.id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=Purchase_Bill_{safe_filename}.pdf",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@router.get("/bills/{bill_id}/excel")
async def get_bill_excel(
    bill_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    service = ReportService(db, company.id)
    try:
        excel_bytes = await service.generate_purchase_bill_excel(bill_id, company.id)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=bill_{bill_id}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")


# --- Debit Notes (Purchase Return) ---
@router.get("/debit-notes", response_model=List[DebitNoteSchema])
async def list_debit_notes(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(DebitNote)
        .options(selectinload(DebitNote.items))
        .where(DebitNote.company_id == company.id)
        .order_by(DebitNote.note_date.desc())
    )
    return result.scalars().unique().all()

@router.post("/debit-notes", response_model=DebitNoteSchema)
async def create_debit_note(
    note_in: DebitNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    # Industrial Standard: Auto-generate sequential Note Number
    count_result = await db.execute(select(func.count(DebitNote.id)).where(DebitNote.company_id == company.id))
    count = count_result.scalar() or 0
    note_number = f"DN-{datetime.now().year}-{(count + 1):04d}"

    new_note = DebitNote(
        company_id=company.id,
        supplier_id=note_in.supplier_id,
        bill_id=note_in.bill_id,
        note_number=note_number,
        note_date=note_in.note_date,
        reason=note_in.reason,
        created_by=current_user.id
    )

    subtotal = Decimal("0.0")
    tax_amount = Decimal("0.0")

    for item_in in note_in.items:
        line_val = item_in.quantity * item_in.unit_price
        line_tax = line_val * (item_in.tax_rate / Decimal("100"))
        line_total = line_val + line_tax

        item = DebitNoteItem(
            product_id=item_in.product_id,
            quantity=item_in.quantity,
            unit_price=item_in.unit_price,
            tax_rate=item_in.tax_rate,
            tax_amount=line_tax,
            total=line_total,
            batch_id=item_in.batch_id
        )
        new_note.items.append(item)
        subtotal += line_val
        tax_amount += line_tax

        # INVENTORY SYNC: Remove returned goods from stock
        stock_entry = StockEntry(
            company_id=company.id,
            product_id=item_in.product_id,
            batch_id=item_in.batch_id,
            quantity=-item_in.quantity, # Negative for return
            entry_type="PURCHASE_RETURN",
            reference_type="debit_note",
            reference_id=new_note.id,
            notes=f"Return to Supplier (Note: {note_number})",
            created_by=current_user.id
        )
        db.add(stock_entry)


    new_note.subtotal = subtotal
    new_note.tax_amount = tax_amount
    new_note.total = subtotal + tax_amount
    
    # Industrial Standard: Split GST 50/50 for Local transactions
    new_note.cgst_amount = tax_amount / Decimal("2.0")
    new_note.sgst_amount = tax_amount / Decimal("2.0")
    new_note.igst_amount = Decimal("0.0")

    db.add(new_note)
    
    # FINANCIAL SYNC: Reduce liability if bill is linked
    if note_in.bill_id:
        bill = await db.get(PurchaseBill, note_in.bill_id)
        if bill:
            bill.balance_due -= new_note.total
            # Adjust amount_paid if total return exceeds balance (advanced logic usually required)

    await db.commit()
    await db.refresh(new_note, ["items"])
    return new_note

@router.delete("/debit-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_debit_note(
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    stmt = select(DebitNote).where(
        DebitNote.id == note_id,
        DebitNote.company_id == company.id
    )
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debit note not found.")

    # Restore the bill's balance_due if a bill was linked
    if note.bill_id:
        bill = await db.get(PurchaseBill, note.bill_id)
        if bill:
            bill.balance_due += note.total
            # Recalculate status
            if bill.balance_due <= 0:
                bill.status = "PAID"
            elif bill.amount_paid > 0:
                bill.status = "PARTIAL"
            else:
                bill.status = "PENDING"

    # Delete related StockEntry records
    from app.models import StockEntry
    from sqlalchemy import delete
    stock_stmt = delete(StockEntry).where(
        StockEntry.company_id == company.id,
        StockEntry.reference_type == "debit_note",
        StockEntry.reference_id == note_id
    )
    await db.execute(stock_stmt)

    # Delete the debit note (cascade deletes DebitNoteItem)
    await db.delete(note)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
