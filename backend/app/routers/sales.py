from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func, delete
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import joinedload, selectinload

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import (
    Invoice, InvoiceItem, Customer, User, Company, SalesOrder, 
    SalesOrderItem, CreditNote, CreditNoteItem, StockEntry, Product
)
from app.schemas.sales import (
    Invoice as InvoiceSchema, InvoiceCreate,
    Customer as CustomerSchema, CustomerCreate,
    SalesOrder as SalesOrderSchema, SalesOrderCreate,
    CreditNote as CreditNoteSchema, CreditNoteCreate
)
from app.services.compliance import process_statutory_integrations
from app.services.reports import ReportService
from app.services.sequence_service import get_next_document_number
from app.core.redis import cache_manager
# pyrefly: ignore [missing-import]
from fastapi.responses import Response


router = APIRouter(prefix="/api/v1/sales", tags=["Sales"])

# --- Customers ---
@router.get("/customers", response_model=List[CustomerSchema])
async def list_customers(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Customer)
        .where(Customer.company_id == company.id)
    )
    return result.scalars().all()

@router.post("/customers", response_model=CustomerSchema)
async def create_customer(
    customer_in: CustomerCreate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    new_customer = Customer(**customer_in.model_dump(), company_id=company.id)
    db.add(new_customer)
    await db.commit()
    await db.refresh(new_customer)
    return new_customer

# --- Sales Orders ---
@router.get("/orders", response_model=List[SalesOrderSchema])
async def list_sales_orders(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(SalesOrder)
        .options(selectinload(SalesOrder.items))
        .where(SalesOrder.company_id == company.id)
        .order_by(SalesOrder.order_date.desc())
    )
    return result.scalars().unique().all()

@router.post("/orders", response_model=SalesOrderSchema)
async def create_sales_order(
    so_in: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    customer = await db.get(Customer, so_in.customer_id)
    if not customer or not customer.is_active:
        raise HTTPException(status_code=400, detail="Customer not found or inactive.")

    # Custom order number logic
    so_number = so_in.so_number or getattr(so_in, 'order_number', None)
    if not so_number or so_number == "SO-AUTO" or so_number.endswith("-AUTO") or so_number == "Generating...":
        so_number = await get_next_document_number(db, company.id, "Sales Order")
    else:
        # Verify uniqueness of custom sales order number
        from app.models import SalesOrder
        dup_check = await db.execute(
            select(SalesOrder).where(
                SalesOrder.company_id == company.id,
                SalesOrder.so_number == so_number
            )
        )
        if dup_check.scalars().first():
            raise HTTPException(status_code=400, detail=f"Sales Order number '{so_number}' already exists.")

    new_so = SalesOrder(
        **so_in.model_dump(exclude={"items", "so_number", "order_number"}),
        company_id=company.id,
        created_by=current_user.id
    )
    # Set whichever field holds the SO number
    if hasattr(new_so, 'so_number'):
        new_so.so_number = so_number
    elif hasattr(new_so, 'order_number'):
        new_so.order_number = so_number
    
    subtotal = Decimal("0.0")
    tax_amount = Decimal("0.0")
    
    for item_in in so_in.items:
        line_sub = item_in.quantity * item_in.unit_price
        discount = line_sub * (item_in.discount_pct / 100)
        line_taxable = line_sub - discount
        line_tax = line_taxable * (item_in.tax_rate / 100)
        line_total = line_taxable + line_tax
        
        item = SalesOrderItem(
            **item_in.model_dump(),
            tax_amount=line_tax,
            total=line_total
        )
        new_so.items.append(item)
        subtotal += line_taxable
        tax_amount += line_tax

    new_so.subtotal = subtotal
    new_so.tax_amount = tax_amount
    new_so.total = subtotal + tax_amount
    
    db.add(new_so)
    await db.commit()
    await db.refresh(new_so)
    return new_so

# --- Invoices ---
@router.get("/invoices", response_model=List[InvoiceSchema])
async def list_invoices(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.items).selectinload(InvoiceItem.product).selectinload(Product.category),
            selectinload(Invoice.customer)
        )
        .where(Invoice.company_id == company.id)
        .order_by(Invoice.invoice_date.desc())
    )
    return result.scalars().all()

@router.post("/invoices", response_model=InvoiceSchema)
async def create_invoice(
    invoice_in: InvoiceCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    from app.core.fy_validator import validate_transaction_date
    await validate_transaction_date(db, company.id, invoice_in.invoice_date)

    customer = await db.get(Customer, invoice_in.customer_id)
    if not customer or not customer.is_active:
        raise HTTPException(status_code=400, detail="Target entity is deactivated.")

    # Custom invoice number logic
    invoice_number = invoice_in.invoice_number
    if not invoice_number or invoice_number == "INV-AUTO" or invoice_number.endswith("-AUTO") or invoice_number == "Generating...":
        invoice_number = await get_next_document_number(db, company.id, "Sales Invoice")
    else:
        # Verify uniqueness of custom invoice number
        dup_check = await db.execute(
            select(Invoice).where(
                Invoice.company_id == company.id,
                Invoice.invoice_number == invoice_number
            )
        )
        if dup_check.scalars().first():
            raise HTTPException(status_code=400, detail=f"Invoice number '{invoice_number}' already exists.")

    new_invoice = Invoice(
        **invoice_in.model_dump(exclude={"items", "invoice_number"}),
        invoice_number=invoice_number,
        company_id=company.id,
        created_by=current_user.id,
        amount_paid=0
    )
    
    subtotal = Decimal("0.0")
    tax_amount = Decimal("0.0")
    cgst_amount = Decimal("0.0")
    sgst_amount = Decimal("0.0")
    igst_amount = Decimal("0.0")
    
    # Check if local or interstate transaction
    is_local = True
    if invoice_in.gst_nature == "Same State":
        is_local = True
    elif invoice_in.gst_nature == "Other State":
        is_local = False
    elif customer.state and company.registered_state:
        c_state = customer.state.strip().lower().split('-')[-1].strip()
        co_state = company.registered_state.strip().lower().split('-')[-1].strip()
        is_local = (c_state == co_state)
    
    for item_in in invoice_in.items:
        from app.models import Product
        product = await db.get(Product, item_in.product_id)
        hsn_val = item_in.hsn_code
        if not hsn_val and product:
            hsn_val = product.hsn_code or product.sac_code

        line_sub = item_in.quantity * item_in.unit_price
        discount = line_sub * (item_in.discount_pct / 100)
        line_taxable = line_sub - discount
        line_tax = line_taxable * (item_in.tax_rate / 100)
        line_total = line_taxable
        
        item = InvoiceItem(
            **item_in.model_dump(exclude={"hsn_code"}),
            hsn_code=hsn_val,
            tax_amount=line_tax,
            total=line_total
        )
        new_invoice.items.append(item)
        
        subtotal += line_taxable
        tax_amount += line_tax
        
        if is_local:
            cgst_amount += line_tax / Decimal("2.0")
            sgst_amount += line_tax / Decimal("2.0")
        else:
            igst_amount += line_tax

    # Lock recalculated financials for backend integrity
    round_off = Decimal(str(invoice_in.round_off_amount or 0.0))
    new_invoice.subtotal = subtotal
    new_invoice.tax_amount = tax_amount
    new_invoice.total = subtotal + tax_amount + round_off
    new_invoice.balance_due = new_invoice.total
    new_invoice.cgst_amount = cgst_amount
    new_invoice.sgst_amount = sgst_amount
    new_invoice.igst_amount = igst_amount

    db.add(new_invoice)
    await db.flush()

    for item_in in invoice_in.items:
        # INVENTORY SYNC: Add stock outward
        stock_entry = StockEntry(
            company_id=company.id,
            product_id=item_in.product_id,
            batch_id=item_in.batch_id,
            quantity=-item_in.quantity,  # Negative for sales out
            entry_type="SALE_OUT",
            reference_type="sales_invoice",
            reference_id=new_invoice.id,
            notes=f"Stock Outward via Sales Invoice {new_invoice.invoice_number}",
            created_by=current_user.id
        )
        db.add(stock_entry)

    await process_statutory_integrations(company, new_invoice)
    await db.commit()
    await cache_manager.invalidate_prefix(f"company:{company.id}:")
    await cache_manager.invalidate_prefix(f"banking_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"all_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"customers:{company.id}")

    
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.items).selectinload(InvoiceItem.product).selectinload(Product.category), selectinload(Invoice.customer)).where(Invoice.id == new_invoice.id)
    )
    return result.scalars().first()

@router.put("/invoices/{invoice_id}", response_model=InvoiceSchema)
async def update_sales_invoice(
    invoice_id: UUID,
    invoice_in: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    # 1. Fetch existing invoice
    stmt = select(Invoice).options(selectinload(Invoice.items)).where(
        Invoice.id == invoice_id,
        Invoice.company_id == company.id
    )
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    from app.core.fy_validator import validate_transaction_date
    # Validate both existing and target dates
    await validate_transaction_date(db, company.id, invoice.invoice_date)
    await validate_transaction_date(db, company.id, invoice_in.invoice_date)

    # 2. Recalculate totals
    customer = await db.get(Customer, invoice_in.customer_id)
    if not customer or not customer.is_active:
        raise HTTPException(status_code=400, detail="Target entity is deactivated.")

    subtotal = Decimal("0.0")
    tax_amount = Decimal("0.0")
    cgst_amount = Decimal("0.0")
    sgst_amount = Decimal("0.0")
    igst_amount = Decimal("0.0")
    
    is_local = True
    if invoice_in.gst_nature == "Same State":
        is_local = True
    elif invoice_in.gst_nature == "Other State":
        is_local = False
    elif customer.state and company.registered_state:
        c_state = customer.state.strip().lower().split('-')[-1].strip()
        co_state = company.registered_state.strip().lower().split('-')[-1].strip()
        is_local = (c_state == co_state)
    
    new_items = []
    for item_in in invoice_in.items:
        from app.models import Product
        product = await db.get(Product, item_in.product_id)
        hsn_val = item_in.hsn_code
        if not hsn_val and product:
            hsn_val = product.hsn_code or product.sac_code

        line_sub = item_in.quantity * item_in.unit_price
        discount = line_sub * (item_in.discount_pct / 100)
        line_taxable = line_sub - discount
        line_tax = line_taxable * (item_in.tax_rate / 100)
        line_total = line_taxable
        
        item = InvoiceItem(
            **item_in.model_dump(exclude={"hsn_code"}),
            hsn_code=hsn_val,
            tax_amount=line_tax,
            total=line_total
        )
        new_items.append(item)
        
        subtotal += line_taxable
        tax_amount += line_tax
        
        if is_local:
            cgst_amount += line_tax / Decimal("2.0")
            sgst_amount += line_tax / Decimal("2.0")
        else:
            igst_amount += line_tax

    round_off = Decimal(str(invoice_in.round_off_amount or 0.0))
    new_total = subtotal + tax_amount + round_off

    # 3. Check legal constraint: cannot modify total below already paid amount
    if new_total < invoice.amount_paid:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce invoice total below the amount already paid (Paid: ₹{invoice.amount_paid:.2f}). Please delete or adjust the payments first."
        )

    # Delete old StockEntry records for this invoice
    from app.models import StockEntry
    # pyrefly: ignore [missing-import]
    from sqlalchemy import delete
    await db.execute(
        delete(StockEntry).where(
            StockEntry.company_id == company.id,
            StockEntry.reference_type == "sales_invoice",
            StockEntry.reference_id == invoice_id
        )
    )

    # 4. Update fields
    for field, value in invoice_in.model_dump(exclude={"items"}).items():
        setattr(invoice, field, value)

    invoice.subtotal = subtotal
    invoice.tax_amount = tax_amount
    invoice.total = new_total
    invoice.balance_due = new_total - invoice.amount_paid
    invoice.cgst_amount = cgst_amount
    invoice.sgst_amount = sgst_amount
    invoice.igst_amount = igst_amount

    # Update status based on payment state
    if invoice.balance_due <= 0:
        invoice.status = "PAID"
    elif invoice.amount_paid > 0:
        invoice.status = "PARTIAL"
    else:
        invoice.status = "UNPAID"

    # Replace items
    invoice.items.clear()
    invoice.items.extend(new_items)

    # Recreate stock entries
    for item_in in invoice_in.items:
        stock_entry = StockEntry(
            company_id=company.id,
            product_id=item_in.product_id,
            batch_id=item_in.batch_id,
            quantity=-item_in.quantity,
            entry_type="SALE_OUT",
            reference_type="sales_invoice",
            reference_id=invoice.id,
            notes=f"Stock Outward via Sales Invoice {invoice.invoice_number}",
            created_by=current_user.id
        )
        db.add(stock_entry)

    await process_statutory_integrations(company, invoice)
    await db.commit()
    await cache_manager.invalidate_prefix(f"company:{company.id}:")
    await cache_manager.invalidate_prefix(f"banking_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"all_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"customers:{company.id}")
    await cache_manager.invalidate_prefix(f"invoice:pdf:{invoice_id}")

    
    # Reload invoice with items and customer
    reload_stmt = select(Invoice).options(
        selectinload(Invoice.items).selectinload(InvoiceItem.product).selectinload(Product.category), 
        selectinload(Invoice.customer)
    ).where(Invoice.id == invoice_id)
    reload_res = await db.execute(reload_stmt)
    return reload_res.scalars().first()

@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    stmt = select(Invoice).where(
        Invoice.id == invoice_id,
        Invoice.company_id == company.id
    )
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales invoice not found.")
    
    from app.core.fy_validator import validate_transaction_date
    await validate_transaction_date(db, company.id, invoice.invoice_date)
    
    # Delete associated payments
    from app.models import Payment
    await db.execute(
        delete(Payment).where(
            Payment.company_id == company.id,
            Payment.reference_type == "invoice",
            Payment.reference_id == invoice_id
        )
    )
        
    # Cascade delete associated credit notes & their stock entries
    cn_stmt = select(CreditNote).where(CreditNote.invoice_id == invoice_id)
    cn_res = await db.execute(cn_stmt)
    credit_notes = cn_res.scalars().all()
    
    for note in credit_notes:
        # Delete related StockEntry records for the credit note (SALES_RETURN)
        await db.execute(
            delete(StockEntry).where(
                StockEntry.company_id == company.id,
                StockEntry.reference_type == "credit_note",
                StockEntry.reference_id == note.id
            )
        )
        # Delete the credit note itself (cascade deletes CreditNoteItem)
        await db.delete(note)


    # Delete related StockEntry records
    await db.execute(
        delete(StockEntry).where(
            StockEntry.company_id == company.id,
            StockEntry.reference_type == "sales_invoice",
            StockEntry.reference_id == invoice_id
        )
    )

    await db.delete(invoice)
    await db.commit()
    await cache_manager.invalidate_prefix(f"company:{company.id}:")
    await cache_manager.invalidate_prefix(f"banking_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"all_accounts:{company.id}")
    await cache_manager.invalidate_prefix(f"customers:{company.id}")
    await cache_manager.invalidate_prefix(f"invoice:pdf:{invoice_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/invoices/{invoice_id}", response_model=InvoiceSchema)
async def get_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Invoice)
        .options(joinedload(Invoice.customer), selectinload(Invoice.items).selectinload(InvoiceItem.product).selectinload(Product.category))
        .where(Invoice.id == invoice_id, Invoice.company_id == company.id)
    )
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return invoice

@router.get("/invoices/public/{invoice_id}/pdf")
async def public_invoice_pdf(
    invoice_id: UUID,
    theme: Optional[str] = None,
    copy_type: Optional[str] = "original",
    orientation: Optional[str] = "portrait",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    try:
        cache_key = f"invoice:pdf:{invoice_id}:{theme or ''}:{copy_type or 'original'}:{orientation or 'portrait'}:{search or ''}"
        cached_pdf = await cache_manager.get_bytes(cache_key)
        if cached_pdf is not None and b"ReportLab" not in cached_pdf:
            import json
            return Response(
                content=cached_pdf,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"inline; filename=Tax_Invoice_{invoice_id}.pdf",
                    "Access-Control-Expose-Headers": "Content-Disposition, X-PDF-Search-Matches, X-Cache",
                    "X-PDF-Search-Matches": json.dumps([]),
                    "X-Cache": "HIT"
                }
            )

        stmt = select(Invoice).where(Invoice.id == invoice_id)
        result = await db.execute(stmt)
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found.")
            
        service = ReportService(db, invoice.company_id)
        pdf_bytes, match_counts = await service.generate_invoice_pdf(
            invoice_id, 
            invoice.company_id, 
            theme=theme, 
            copy_type=copy_type,
            landscape=(orientation == "landscape"),
            search_query=search
        )
        if b"ReportLab" not in pdf_bytes:
            await cache_manager.set_bytes(cache_key, pdf_bytes, ttl_seconds=3600)
        import json
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=Tax_Invoice_{invoice_id}.pdf",
                "Access-Control-Expose-Headers": "Content-Disposition, X-PDF-Search-Matches, X-Cache",
                "X-PDF-Search-Matches": json.dumps(match_counts),
                "X-Cache": "MISS"
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@router.get("/invoices/public/{invoice_id}/print")
async def public_invoice_print(
    invoice_id: UUID,
    theme: Optional[str] = None,
    copy_type: Optional[str] = "original",
    db: AsyncSession = Depends(get_db)
):
    try:
        stmt = select(Invoice).where(Invoice.id == invoice_id)
        result = await db.execute(stmt)
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found.")
            
        service = ReportService(db, invoice.company_id)
        html_content = await service.generate_invoice_html(invoice_id, invoice.company_id, theme=theme, copy_type=copy_type)
        
        print_script = "<script>window.onload = function() { window.print(); }</script>"
        if "</body>" in html_content:
            html_content = html_content.replace("</body>", f"{print_script}</body>")
        else:
            html_content += print_script
            
        # pyrefly: ignore [missing-import]
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=html_content)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Print generation failed: {str(e)}")

@router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: UUID,
    theme: Optional[str] = None,
    copy_type: Optional[str] = "original",
    orientation: Optional[str] = "portrait",
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    try:
        cache_key = f"invoice:pdf:{invoice_id}:{theme or ''}:{copy_type or 'original'}:{orientation or 'portrait'}:{search or ''}"
        cached_pdf = await cache_manager.get_bytes(cache_key)
        if cached_pdf is not None and b"ReportLab" not in cached_pdf:
            # Fetch invoice number for filename
            inv_stmt = select(Invoice.invoice_number).where(Invoice.id == invoice_id, Invoice.company_id == company.id)
            inv_result = await db.execute(inv_stmt)
            inv_number = inv_result.scalar_one_or_none() or str(invoice_id)
            safe_filename = inv_number.replace('/', '_').replace(' ', '_')
            import json
            return Response(
                content=cached_pdf,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"inline; filename=Tax_Invoice_{safe_filename}.pdf",
                    "Access-Control-Expose-Headers": "Content-Disposition, X-PDF-Search-Matches, X-Cache",
                    "X-PDF-Search-Matches": json.dumps([]),
                    "X-Cache": "HIT"
                }
            )

        service = ReportService(db, company.id)
        # Fetch invoice number for filename
        inv_stmt = select(Invoice.invoice_number).where(Invoice.id == invoice_id, Invoice.company_id == company.id)
        inv_result = await db.execute(inv_stmt)
        inv_number = inv_result.scalar_one_or_none() or str(invoice_id)
        safe_filename = inv_number.replace('/', '_').replace(' ', '_')
        
        pdf_bytes, match_counts = await service.generate_invoice_pdf(
            invoice_id, 
            company.id, 
            theme=theme, 
            copy_type=copy_type,
            landscape=(orientation == "landscape"),
            search_query=search
        )
        if b"ReportLab" not in pdf_bytes:
            await cache_manager.set_bytes(cache_key, pdf_bytes, ttl_seconds=3600)
        import json
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=Tax_Invoice_{safe_filename}.pdf",
                "Access-Control-Expose-Headers": "Content-Disposition, X-PDF-Search-Matches, X-Cache",
                "X-PDF-Search-Matches": json.dumps(match_counts),
                "X-Cache": "MISS"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@router.get("/invoices/{invoice_id}/excel")
async def get_invoice_excel(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    service = ReportService(db, company.id)
    try:
        # Fetch invoice number for filename
        inv_stmt = select(Invoice.invoice_number).where(Invoice.id == invoice_id, Invoice.company_id == company.id)
        inv_result = await db.execute(inv_stmt)
        inv_number = inv_result.scalar_one_or_none() or str(invoice_id)
        safe_filename = inv_number.replace('/', '_').replace(' ', '_')
        
        excel_bytes = await service.generate_invoice_excel(invoice_id, company.id)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=Tax_Invoice_{safe_filename}.xlsx",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")


# --- Credit Notes (Sales Return) ---

@router.get("/credit-notes", response_model=List[CreditNoteSchema])
async def list_credit_notes(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(CreditNote)
        .options(selectinload(CreditNote.items))
        .where(CreditNote.company_id == company.id)
        .order_by(CreditNote.note_date.desc())
    )
    return result.scalars().unique().all()

@router.post("/credit-notes", response_model=CreditNoteSchema)
async def create_credit_note(
    note_in: CreditNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    # Industrial Standard: Auto-generate Note Number
    count_result = await db.execute(select(func.count(CreditNote.id)).where(CreditNote.company_id == company.id))
    count = count_result.scalar() or 0
    note_number = f"CN-{datetime.now().year}-{(count + 1):04d}"

    new_note = CreditNote(
        company_id=company.id,
        customer_id=note_in.customer_id,
        invoice_id=note_in.invoice_id,
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

        item = CreditNoteItem(
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

        # INVENTORY SYNC: Add returned goods back to stock (Skip if purely financial/payment settlement)
        if getattr(note_in, "return_mode", "GOODS_RETURN") != "FINANCIAL_ADJUSTMENT":
            stock_entry = StockEntry(
                company_id=company.id,
                product_id=item_in.product_id,
                batch_id=item_in.batch_id,
                quantity=item_in.quantity, # Positive for return to stock
                entry_type="SALES_RETURN",
                reference_type="credit_note",
                reference_id=new_note.id,
                notes=f"Return from Customer (Note: {note_number})",
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
    
    # FINANCIAL SYNC: Reduce receivable if invoice is linked
    if note_in.invoice_id:
        invoice = await db.get(Invoice, note_in.invoice_id)
        if invoice:
            invoice.balance_due -= new_note.total

    await db.commit()
    await db.refresh(new_note, ["items"])
    return new_note

@router.delete("/credit-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credit_note(
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    stmt = select(CreditNote).where(
        CreditNote.id == note_id,
        CreditNote.company_id == company.id
    )
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit note not found.")
    
    # Restore the invoice's balance_due if an invoice was linked
    if note.invoice_id:
        invoice = await db.get(Invoice, note.invoice_id)
        if invoice:
            invoice.balance_due += note.total
            # Recalculate status
            if invoice.balance_due <= 0:
                invoice.status = "PAID"
            elif invoice.amount_paid > 0:
                invoice.status = "PARTIAL"
            else:
                invoice.status = "UNPAID"

    # Delete related StockEntry records
    from app.models import StockEntry
    # pyrefly: ignore [missing-import]
    from sqlalchemy import delete
    stock_stmt = delete(StockEntry).where(
        StockEntry.company_id == company.id,
        StockEntry.reference_type == "credit_note",
        StockEntry.reference_id == note_id
    )
    await db.execute(stock_stmt)

    # Delete the credit note (cascade deletes CreditNoteItem)
    await db.delete(note)
    await db.commit()

@router.get("/credit-notes/{note_id}/pdf")
@router.get("/sales/credit-notes/{note_id}/pdf")
async def get_credit_note_pdf_route(
    note_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    try:
        service = ReportService(db, company.id)
        pdf_bytes, note_number = await service.generate_credit_note_pdf(note_id, company.id)
        safe_filename = note_number.replace('/', '_').replace(' ', '_')
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=Credit_Note_{safe_filename}.pdf"
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Credit note PDF generation failed: {str(e)}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
