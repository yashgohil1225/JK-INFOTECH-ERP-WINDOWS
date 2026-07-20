from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import Customer, Supplier, Company
from app.schemas.parties import (
    Customer as CustomerSchema, CustomerCreate, CustomerUpdate,
    Supplier as SupplierSchema, SupplierCreate, SupplierUpdate,
    CustomerLight, SupplierLight
)

router = APIRouter(prefix="/api/v1", tags=["Parties"])

# --- Customers ---
@router.get("/customers/light", response_model=List[CustomerLight])
@router.get("/customers/light/", response_model=List[CustomerLight])
async def list_customers_light(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Customer.id, Customer.name, Customer.is_active)
        .where(Customer.company_id == company.id)
        .order_by(Customer.name)
    )
    return [{"id": row.id, "name": row.name, "is_active": row.is_active} for row in result]

@router.get("/customers/", response_model=List[CustomerSchema])
@router.get("/customers", response_model=List[CustomerSchema])
async def list_customers(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Customer)
        .where(Customer.company_id == company.id)
        .order_by(Customer.name)
    )
    return result.scalars().all()

@router.get("/customers/{customer_id}", response_model=CustomerSchema)
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
    return customer

@router.post("/customers/", response_model=CustomerSchema, status_code=status.HTTP_201_CREATED)
@router.post("/customers", response_model=CustomerSchema, status_code=status.HTTP_201_CREATED)
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

@router.put("/customers/{customer_id}", response_model=CustomerSchema)
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
    
    for key, value in customer_in.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
    
    await db.commit()
    await db.refresh(customer)
    return customer

@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    
    try:
        await db.delete(customer)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Integrity Breach: This entity has dependent transaction history. Record termination aborted to preserve audit trail. Please deactivate the node instead."
        )
    return None

# --- Suppliers ---
@router.get("/suppliers/light", response_model=List[SupplierLight])
@router.get("/suppliers/light/", response_model=List[SupplierLight])
async def list_suppliers_light(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Supplier.id, Supplier.name, Supplier.is_active)
        .where(Supplier.company_id == company.id)
        .order_by(Supplier.name)
    )
    return [{"id": row.id, "name": row.name, "is_active": row.is_active} for row in result]
@router.get("/suppliers/", response_model=List[SupplierSchema])
@router.get("/suppliers", response_model=List[SupplierSchema])
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Supplier)
        .where(Supplier.company_id == company.id)
        .order_by(Supplier.name)
    )
    return result.scalars().all()

@router.get("/suppliers/{supplier_id}", response_model=SupplierSchema)
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
    return supplier

@router.post("/suppliers/", response_model=SupplierSchema, status_code=status.HTTP_201_CREATED)
@router.post("/suppliers", response_model=SupplierSchema, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_in: SupplierCreate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    new_supplier = Supplier(**supplier_in.model_dump(), company_id=company.id)
    db.add(new_supplier)
    await db.commit()
    await db.refresh(new_supplier)
    return new_supplier

@router.put("/suppliers/{supplier_id}", response_model=SupplierSchema)
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
    
    for key, value in supplier_in.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    
    await db.flush()
    return supplier

@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    
    try:
        await db.delete(supplier)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Integrity Breach: This vendor has dependent procurement history. Record termination aborted. Please deactivate the node instead."
        )
    return None
