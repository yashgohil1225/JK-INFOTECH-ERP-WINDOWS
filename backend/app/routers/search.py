from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, join
from typing import List, Dict, Any

from app.database import get_db
from app.middleware.auth import get_current_company
from app.models import (
    Invoice, PurchaseBill, Customer, Supplier, Product, Company
)

router = APIRouter(prefix="/api/v1/search", tags=["Search"])

@router.get("/global", response_model=Dict[str, List[Dict[str, Any]]])
async def global_search(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    query_str = f"%{q}%"
    
    # 1. Search Invoices (joined with Customer to search by customer name as well)
    invoice_stmt = (
        select(Invoice, Customer.name.label("customer_name"))
        .join(Customer, Invoice.customer_id == Customer.id, isouter=True)
        .where(Invoice.company_id == company.id)
        .where(
            or_(
                Invoice.invoice_number.ilike(query_str),
                Customer.name.ilike(query_str)
            )
        )
        .limit(10)
    )
    invoice_res = await db.execute(invoice_stmt)
    invoice_rows = invoice_res.all()
    
    invoice_results = [
        {
            "id": str(row.Invoice.id), 
            "title": row.Invoice.invoice_number, 
            "subtitle": f"Customer: {row.customer_name or 'Direct Retail'} | Total: ₹{float(row.Invoice.total):,.2f}",
            "type": "INVOICE"
        } for row in invoice_rows
    ]
    
    # 2. Search Purchase Bills (joined with Supplier)
    bill_stmt = (
        select(PurchaseBill, Supplier.name.label("supplier_name"))
        .join(Supplier, PurchaseBill.supplier_id == Supplier.id, isouter=True)
        .where(PurchaseBill.company_id == company.id)
        .where(
            or_(
                PurchaseBill.bill_number.ilike(query_str),
                PurchaseBill.supplier_bill_no.ilike(query_str),
                Supplier.name.ilike(query_str)
            )
        )
        .limit(10)
    )
    bill_res = await db.execute(bill_stmt)
    bill_rows = bill_res.all()
    
    bill_results = [
        {
            "id": str(row.PurchaseBill.id), 
            "title": f"Bill {row.PurchaseBill.bill_number}", 
            "subtitle": f"Supplier: {row.supplier_name or 'N/A'} | Total: ₹{float(row.PurchaseBill.total):,.2f}",
            "type": "BILL"
        } for row in bill_rows
    ]
    
    # 3. Search Customers
    customer_stmt = (
        select(Customer)
        .where(Customer.company_id == company.id)
        .where(
            or_(
                Customer.name.ilike(query_str),
                Customer.gst_number.ilike(query_str),
                Customer.phone.ilike(query_str)
            )
        )
        .limit(5)
    )
    customer_res = await db.execute(customer_stmt)
    customers = customer_res.scalars().all()
    
    customer_results = [
        {
            "id": str(c.id), 
            "title": c.name, 
            "subtitle": f"Customer | GSTIN: {c.gst_number or 'N/A'} | Phone: {c.phone or 'N/A'}",
            "type": "CUSTOMER"
        } for c in customers
    ]
    
    # 4. Search Suppliers
    supplier_stmt = (
        select(Supplier)
        .where(Supplier.company_id == company.id)
        .where(
            or_(
                Supplier.name.ilike(query_str),
                Supplier.gst_number.ilike(query_str),
                Supplier.phone.ilike(query_str)
            )
        )
        .limit(5)
    )
    supplier_res = await db.execute(supplier_stmt)
    suppliers = supplier_res.scalars().all()
    
    supplier_results = [
        {
            "id": str(s.id), 
            "title": s.name, 
            "subtitle": f"Supplier | GSTIN: {s.gst_number or 'N/A'} | Phone: {s.phone or 'N/A'}",
            "type": "SUPPLIER"
        } for s in suppliers
    ]
    
    # 5. Search Products
    product_stmt = (
        select(Product)
        .where(Product.company_id == company.id)
        .where(
            or_(
                Product.name.ilike(query_str),
                Product.sku.ilike(query_str),
                Product.barcode.ilike(query_str),
                Product.hsn_code.ilike(query_str)
            )
        )
        .limit(10)
    )
    product_res = await db.execute(product_stmt)
    products = product_res.scalars().all()
    
    product_results = [
        {
            "id": str(p.id), 
            "title": p.name, 
            "subtitle": f"SKU: {p.sku or 'N/A'} | Price: ₹{float(p.sale_price or 0.0):,.2f} | HSN: {p.hsn_code or 'N/A'}",
            "type": "PRODUCT"
        } for p in products
    ]
    
    return {
        "transactions": invoice_results + bill_results,
        "parties": customer_results + supplier_results,
        "inventory": product_results
    }
