from typing import List, Optional
from uuid import UUID
from decimal import Decimal
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, update, delete, func
# pyrefly: ignore [missing-import]
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import Customer, Supplier, Company, Invoice, PurchaseBill, SalesOrder, PurchaseOrder, Payment
from app.schemas.parties import (
    Customer as CustomerSchema, CustomerCreate, CustomerUpdate,
    Supplier as SupplierSchema, SupplierCreate, SupplierUpdate,
    CustomerLight, SupplierLight
)

router = APIRouter(prefix="/api/v1", tags=["Parties"])

from app.core.redis import cache_manager

# --- Customers ---
@router.get("/customers/light", response_model=List[CustomerLight])
@router.get("/customers/light/", response_model=List[CustomerLight])
@router.get("/parties/customers/light", response_model=List[CustomerLight])
@router.get("/parties/customers/light/", response_model=List[CustomerLight])
async def list_customers_light(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"customers_light:{company.id}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        select(Customer.id, Customer.name, Customer.is_active)
        .where(Customer.company_id == company.id)
        .order_by(Customer.name)
    )
    res_data = [{"id": row.id, "name": row.name, "is_active": row.is_active} for row in result]
    await cache_manager.set(cache_key, res_data, ttl_seconds=60)
    return res_data

@router.get("/customers/", response_model=List[CustomerSchema])
@router.get("/customers", response_model=List[CustomerSchema])
@router.get("/parties/customers/", response_model=List[CustomerSchema])
@router.get("/parties/customers", response_model=List[CustomerSchema])
async def list_customers(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"customers:{company.id}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    bal_stmt = (
        select(Invoice.customer_id, func.coalesce(func.sum(Invoice.balance_due), 0).label("due_sum"))
        .where(Invoice.company_id == company.id)
        .group_by(Invoice.customer_id)
    )
    bal_res = await db.execute(bal_stmt)
    due_map = {row.customer_id: Decimal(str(row.due_sum or 0)) for row in bal_res}

    result = await db.execute(
        select(Customer)
        .where(Customer.company_id == company.id)
        .order_by(Customer.name)
    )
    customers = result.scalars().all()
    out = []
    for c in customers:
        c_dict = CustomerSchema.model_validate(c).model_dump()
        due = due_map.get(c.id, Decimal("0.0"))
        c_dict["outstanding_balance"] = Decimal(str(c.opening_balance or 0)) + due
        out.append(c_dict)

    await cache_manager.set(cache_key, out, ttl_seconds=60)
    return out

@router.get("/customers/{customer_id}", response_model=CustomerSchema)
@router.get("/parties/customers/{customer_id}", response_model=CustomerSchema)
async def get_customer(
    customer_id: UUID, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Customer)
        .filter(Customer.id == customer_id, Customer.company_id == company.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found in this company context")

    bal_res = await db.execute(
        select(func.coalesce(func.sum(Invoice.balance_due), 0))
        .where(Invoice.customer_id == customer_id, Invoice.company_id == company.id)
    )
    due_sum = bal_res.scalar() or 0

    c_dict = CustomerSchema.model_validate(customer).model_dump()
    c_dict["outstanding_balance"] = Decimal(str(customer.opening_balance or 0)) + Decimal(str(due_sum))
    return c_dict

@router.post("/customers/", response_model=CustomerSchema, status_code=status.HTTP_201_CREATED)
@router.post("/customers", response_model=CustomerSchema, status_code=status.HTTP_201_CREATED)
@router.post("/parties/customers/", response_model=CustomerSchema, status_code=status.HTTP_201_CREATED)
@router.post("/parties/customers", response_model=CustomerSchema, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_in: CustomerCreate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    valid_cols = {c.name for c in Customer.__table__.columns}
    cust_data = {k: v for k, v in customer_in.model_dump().items() if k in valid_cols}
    new_customer = Customer(**cust_data, company_id=company.id)
    db.add(new_customer)
    await db.commit()
    await db.refresh(new_customer)

    await cache_manager.invalidate_prefix(f"customers:{company.id}")
    await cache_manager.invalidate_prefix(f"customers_light:{company.id}")
    await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    return new_customer

@router.put("/customers/{customer_id}", response_model=CustomerSchema)
@router.put("/parties/customers/{customer_id}", response_model=CustomerSchema)
async def update_customer_route(
    customer_id: UUID, 
    customer_in: CustomerUpdate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Customer)
        .filter(Customer.id == customer_id, Customer.company_id == company.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    valid_cols = {c.name for c in Customer.__table__.columns}
    for key, value in customer_in.model_dump(exclude_unset=True).items():
        if key in valid_cols:
            setattr(customer, key, value)
    
    await db.commit()
    await db.refresh(customer)
    await cache_manager.invalidate_prefix(f"customers:{company.id}")
    await cache_manager.invalidate_prefix(f"customers_light:{company.id}")
    await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    return customer

@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/parties/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer_route(
    customer_id: UUID, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Customer)
        .filter(Customer.id == customer_id, Customer.company_id == company.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # 1. Check linked Invoices
    inv_check = await db.execute(
        select(func.count(Invoice.id)).where(Invoice.customer_id == customer_id, Invoice.company_id == company.id)
    )
    inv_count = inv_check.scalar() or 0

    # 2. Check linked Sales Orders
    so_check = await db.execute(
        select(func.count(SalesOrder.id)).where(SalesOrder.customer_id == customer_id, SalesOrder.company_id == company.id)
    )
    so_count = so_check.scalar() or 0

    # 3. Check linked Payments
    pmt_check = await db.execute(
        select(func.count(Payment.id)).where(Payment.party_id == customer_id, Payment.company_id == company.id)
    )
    pmt_count = pmt_check.scalar() or 0

    # 4. Check outstanding / opening balance
    bal_check = await db.execute(
        select(func.coalesce(func.sum(Invoice.balance_due), 0))
        .where(Invoice.customer_id == customer_id, Invoice.company_id == company.id)
    )
    due_sum = bal_check.scalar() or 0
    total_outstanding = Decimal(str(customer.opening_balance or 0)) + Decimal(str(due_sum))

    if inv_count > 0 or so_count > 0 or pmt_count > 0 or total_outstanding > 0:
        raise HTTPException(
            status_code=400, 
            detail="This customer has existing invoices or payment history. Deletion is blocked to protect your tax & accounting records. Please mark this customer as INACTIVE instead."
        )

    try:
        await db.delete(customer)
        await db.commit()
        await cache_manager.invalidate_prefix(f"customers:{company.id}")
        await cache_manager.invalidate_prefix(f"customers_light:{company.id}")
        await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="This customer has existing invoices or payment history. Deletion is blocked to protect your tax & accounting records. Please mark this customer as INACTIVE instead."
        )
    return None

# --- Suppliers ---
@router.get("/suppliers/light", response_model=List[SupplierLight])
@router.get("/suppliers/light/", response_model=List[SupplierLight])
@router.get("/parties/suppliers/light", response_model=List[SupplierLight])
@router.get("/parties/suppliers/light/", response_model=List[SupplierLight])
async def list_suppliers_light(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"suppliers_light:{company.id}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        select(Supplier.id, Supplier.name, Supplier.is_active)
        .where(Supplier.company_id == company.id)
        .order_by(Supplier.name)
    )
    res_data = [{"id": row.id, "name": row.name, "is_active": row.is_active} for row in result]
    await cache_manager.set(cache_key, res_data, ttl_seconds=60)
    return res_data

@router.get("/suppliers/", response_model=List[SupplierSchema])
@router.get("/suppliers", response_model=List[SupplierSchema])
@router.get("/parties/suppliers/", response_model=List[SupplierSchema])
@router.get("/parties/suppliers", response_model=List[SupplierSchema])
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    cache_key = f"suppliers:{company.id}"
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    bal_stmt = (
        select(PurchaseBill.supplier_id, func.coalesce(func.sum(PurchaseBill.balance_due), 0).label("due_sum"))
        .where(PurchaseBill.company_id == company.id)
        .group_by(PurchaseBill.supplier_id)
    )
    bal_res = await db.execute(bal_stmt)
    due_map = {row.supplier_id: Decimal(str(row.due_sum or 0)) for row in bal_res}

    result = await db.execute(
        select(Supplier)
        .where(Supplier.company_id == company.id)
        .order_by(Supplier.name)
    )
    suppliers = result.scalars().all()
    out = []
    for s in suppliers:
        s_dict = SupplierSchema.model_validate(s).model_dump()
        due = due_map.get(s.id, Decimal("0.0"))
        s_dict["outstanding_balance"] = Decimal(str(s.opening_balance or 0)) + due
        out.append(s_dict)

    await cache_manager.set(cache_key, out, ttl_seconds=60)
    return out

@router.get("/suppliers/{supplier_id}", response_model=SupplierSchema)
@router.get("/parties/suppliers/{supplier_id}", response_model=SupplierSchema)
async def get_supplier(
    supplier_id: UUID, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Supplier)
        .filter(Supplier.id == supplier_id, Supplier.company_id == company.id)
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    bal_res = await db.execute(
        select(func.coalesce(func.sum(PurchaseBill.balance_due), 0))
        .where(PurchaseBill.supplier_id == supplier_id, PurchaseBill.company_id == company.id)
    )
    due_sum = bal_res.scalar() or 0

    s_dict = SupplierSchema.model_validate(supplier).model_dump()
    s_dict["outstanding_balance"] = Decimal(str(supplier.opening_balance or 0)) + Decimal(str(due_sum))
    return s_dict

@router.post("/suppliers/", response_model=SupplierSchema, status_code=status.HTTP_201_CREATED)
@router.post("/suppliers", response_model=SupplierSchema, status_code=status.HTTP_201_CREATED)
@router.post("/parties/suppliers/", response_model=SupplierSchema, status_code=status.HTTP_201_CREATED)
@router.post("/parties/suppliers", response_model=SupplierSchema, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_in: SupplierCreate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    valid_cols = {c.name for c in Supplier.__table__.columns}
    supp_data = {k: v for k, v in supplier_in.model_dump().items() if k in valid_cols}
    new_supplier = Supplier(**supp_data, company_id=company.id)
    db.add(new_supplier)
    await db.commit()
    await db.refresh(new_supplier)

    await cache_manager.invalidate_prefix(f"suppliers:{company.id}")
    await cache_manager.invalidate_prefix(f"suppliers_light:{company.id}")
    await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    return new_supplier

@router.put("/suppliers/{supplier_id}", response_model=SupplierSchema)
@router.put("/parties/suppliers/{supplier_id}", response_model=SupplierSchema)
async def update_supplier_route(
    supplier_id: UUID, 
    supplier_in: SupplierUpdate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(select(Supplier).filter(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    valid_cols = {c.name for c in Supplier.__table__.columns}
    for key, value in supplier_in.model_dump(exclude_unset=True).items():
        if key in valid_cols:
            setattr(supplier, key, value)
    
    await db.flush()
    await db.commit()
    await db.refresh(supplier)

    await cache_manager.invalidate_prefix(f"suppliers:{company.id}")
    await cache_manager.invalidate_prefix(f"suppliers_light:{company.id}")
    await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    return supplier

@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/parties/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier_route(
    supplier_id: UUID, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Supplier)
        .filter(Supplier.id == supplier_id, Supplier.company_id == company.id)
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # 1. Check linked Purchase Bills
    bill_check = await db.execute(
        select(func.count(PurchaseBill.id)).where(PurchaseBill.supplier_id == supplier_id, PurchaseBill.company_id == company.id)
    )
    bill_count = bill_check.scalar() or 0

    # 2. Check linked Purchase Orders
    po_check = await db.execute(
        select(func.count(PurchaseOrder.id)).where(PurchaseOrder.supplier_id == supplier_id, PurchaseOrder.company_id == company.id)
    )
    po_count = po_check.scalar() or 0

    # 3. Check linked Payments
    pmt_check = await db.execute(
        select(func.count(Payment.id)).where(Payment.party_id == supplier_id, Payment.company_id == company.id)
    )
    pmt_count = pmt_check.scalar() or 0

    # 4. Check outstanding / opening balance
    bal_check = await db.execute(
        select(func.coalesce(func.sum(PurchaseBill.balance_due), 0))
        .where(PurchaseBill.supplier_id == supplier_id, PurchaseBill.company_id == company.id)
    )
    due_sum = bal_check.scalar() or 0
    total_outstanding = Decimal(str(supplier.opening_balance or 0)) + Decimal(str(due_sum))

    if bill_count > 0 or po_count > 0 or pmt_count > 0 or total_outstanding > 0:
        raise HTTPException(
            status_code=400, 
            detail="This vendor has existing purchase bills or payment history. Deletion is blocked to protect your tax & accounting records. Please mark this vendor as INACTIVE instead."
        )

    try:
        await db.delete(supplier)
        await db.commit()
        await cache_manager.invalidate_prefix(f"suppliers:{company.id}")
        await cache_manager.invalidate_prefix(f"suppliers_light:{company.id}")
        await cache_manager.invalidate_prefix(f"analytics:{company.id}")
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="This vendor has existing purchase bills or payment history. Deletion is blocked to protect your tax & accounting records. Please mark this vendor as INACTIVE instead."
        )
    return None
