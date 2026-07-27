# =============================================================
# JK INFOTECH ERP — Universal Global Search Router
# File : app/routers/search.py
# =============================================================

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, cast, String
from typing import List, Dict, Any

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import User, Company, Invoice, PurchaseBill, Customer, Supplier, Product

from sqlalchemy.orm import selectinload

router = APIRouter(
    prefix="/api/v1/search",
    tags=["Global Search"],
)

@router.get("/global")
@router.get("/global/")
async def global_search(
    q: str = Query(..., min_length=1, description="Search query string"),
    current_company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Unified multi-entity global search across Invoices, Purchase Bills,
    Customers, Vendors, and Inventory Products.
    """
    search_pattern = f"%{q.strip()}%"
    results: List[Dict[str, Any]] = []

    # 1. Sales Invoices Search
    sales_stmt = (
        select(Invoice)
        .options(selectinload(Invoice.customer))
        .join(Customer, Invoice.customer_id == Customer.id, isouter=True)
        .where(
            Invoice.company_id == current_company.id,
            or_(
                Invoice.invoice_number.ilike(search_pattern),
                Customer.name.ilike(search_pattern),
                cast(Invoice.total, String).ilike(search_pattern),
                Invoice.status.ilike(search_pattern)
            )
        )
        .limit(6)
    )
    sales_res = await db.execute(sales_stmt)
    invoices = sales_res.scalars().all()
    for inv in invoices:
        cust_name = inv.customer.name if inv.customer else "Customer"
        results.append({
            "id": inv.id,
            "type": "invoice",
            "category": "INVOICES & SALES",
            "title": f"Sales Invoice {inv.invoice_number}",
            "subtitle": f"{cust_name} • ₹{float(inv.total or 0):,.2f} • {inv.invoice_date}",
            "status": (inv.status or "UNPAID").upper(),
            "targetScreen": "SALES",
            "targetId": inv.id,
            "icon": "🧾"
        })

    # 2. Purchase Bills Search
    purchase_stmt = (
        select(PurchaseBill)
        .options(selectinload(PurchaseBill.supplier))
        .join(Supplier, PurchaseBill.supplier_id == Supplier.id, isouter=True)
        .where(
            PurchaseBill.company_id == current_company.id,
            or_(
                PurchaseBill.bill_number.ilike(search_pattern),
                Supplier.name.ilike(search_pattern),
                cast(PurchaseBill.total, String).ilike(search_pattern),
                PurchaseBill.status.ilike(search_pattern)
            )
        )
        .limit(6)
    )
    purchase_res = await db.execute(purchase_stmt)
    bills = purchase_res.scalars().all()
    for bill in bills:
        supp_name = bill.supplier.name if bill.supplier else "Vendor"
        results.append({
            "id": bill.id,
            "type": "bill",
            "category": "PURCHASES & BILLS",
            "title": f"Purchase Bill {bill.bill_number}",
            "subtitle": f"{supp_name} • ₹{float(bill.total or 0):,.2f} • {bill.bill_date}",
            "status": (bill.status or "UNPAID").upper(),
            "targetScreen": "PURCHASES",
            "targetId": bill.id,
            "icon": "🛍️"
        })

    # 3. Customers Search
    cust_stmt = (
        select(Customer)
        .where(
            Customer.company_id == current_company.id,
            or_(
                Customer.name.ilike(search_pattern),
                Customer.phone.ilike(search_pattern),
                Customer.gst_number.ilike(search_pattern),
                Customer.city.ilike(search_pattern)
            )
        )
        .limit(6)
    )
    cust_res = await db.execute(cust_stmt)
    customers = cust_res.scalars().all()
    for cust in customers:
        results.append({
            "id": cust.id,
            "type": "customer",
            "category": "CUSTOMERS & CLIENTS",
            "title": cust.name,
            "subtitle": f"Phone: {cust.phone or 'N/A'} • GST: {cust.gst_number or 'Unregistered'} • {cust.city or ''}",
            "status": "CUSTOMER",
            "targetScreen": "PARTIES",
            "targetId": cust.id,
            "icon": "👤"
        })

    # 4. Suppliers Search
    supp_stmt = (
        select(Supplier)
        .where(
            Supplier.company_id == current_company.id,
            or_(
                Supplier.name.ilike(search_pattern),
                Supplier.phone.ilike(search_pattern),
                Supplier.gst_number.ilike(search_pattern),
                Supplier.city.ilike(search_pattern)
            )
        )
        .limit(6)
    )
    supp_res = await db.execute(supp_stmt)
    suppliers = supp_res.scalars().all()
    for supp in suppliers:
        results.append({
            "id": supp.id,
            "type": "supplier",
            "category": "VENDORS & SUPPLIERS",
            "title": supp.name,
            "subtitle": f"Phone: {supp.phone or 'N/A'} • GST: {supp.gst_number or 'Unregistered'} • {supp.city or ''}",
            "status": "VENDOR",
            "targetScreen": "PARTIES",
            "targetId": supp.id,
            "icon": "🏢"
        })

    # 5. Products Search
    prod_stmt = (
        select(Product)
        .where(
            Product.company_id == current_company.id,
            or_(
                Product.name.ilike(search_pattern),
                Product.sku.ilike(search_pattern),
                Product.hsn_code.ilike(search_pattern),
                Product.barcode.ilike(search_pattern),
                cast(Product.sale_price, String).ilike(search_pattern)
            )
        )
        .limit(6)
    )
    prod_res = await db.execute(prod_stmt)
    products = prod_res.scalars().all()
    for prod in products:
        results.append({
            "id": prod.id,
            "type": "product",
            "category": "INVENTORY PRODUCTS",
            "title": prod.name,
            "subtitle": f"SKU: {prod.sku or 'N/A'} • Stock: {float(prod.current_stock or 0)} {prod.unit or 'PCS'} • Price: ₹{float(prod.sale_price or 0):,.2f}",
            "status": f"{float(prod.current_stock or 0)} {prod.unit or 'PCS'}",
            "targetScreen": "INVENTORY",
            "targetId": prod.id,
            "icon": "📦"
        })

    return {
        "query": q,
        "total_results": len(results),
        "results": results
    }
