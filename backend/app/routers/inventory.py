from decimal import Decimal
from typing import List, Optional
from uuid import UUID
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select, update, delete
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import selectinload
# pyrefly: ignore [missing-import]
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import Product, ProductCategory, StockEntry, Company, User, Batch
from app.schemas.inventory import (
    Product as ProductSchema, ProductCreate, ProductUpdate,
    ProductCategory as CategorySchema, ProductCategoryCreate,
    StockEntry as StockEntrySchema, StockEntryCreate,
    Batch as BatchSchema, BatchCreate, BatchUpdate
)


router = APIRouter(prefix="/api/v1/inventory", tags=["Inventory"])

# --- Products ---
@router.get("/products", response_model=List[ProductSchema])
async def list_products(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    # HIGH-PERFORMANCE INDUSTRIAL AGGREGATION
    # Avoid selectinload on 1000+ records to prevent session saturation
    # pyrefly: ignore [missing-import]
    from sqlalchemy import func
    
    stock_sub = (
        select(
            StockEntry.product_id, 
            func.sum(StockEntry.quantity).label("computed_stock")
        )
        .where(StockEntry.company_id == company.id)
        .group_by(StockEntry.product_id)
        .subquery()
    )

    result = await db.execute(
        select(Product, stock_sub.c.computed_stock)
        .outerjoin(stock_sub, Product.id == stock_sub.c.product_id)
        .options(selectinload(Product.category))
        .where(Product.company_id == company.id)
        .order_by(Product.name)
    )
    
    # Use .unique() to ensure ORM consistency with eager loading
    rows = result.unique().all()
    
    products_with_stock = []
    for product, computed_stock in rows:
        # Inject computed stock into the model instance for Pydantic serialization
        # We use an override attribute to avoid triggering the @property setter
        product._current_stock_override = computed_stock or Decimal("0.0")
        products_with_stock.append(product)
        
    return products_with_stock

@router.post("/products", response_model=ProductSchema, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    # Pre-emptively check for Duplicate SKU to prevent IntegrityError
    if product_in.sku:
        from datetime import datetime, timezone, timedelta
        existing_result = await db.execute(
            select(Product)
            .options(selectinload(Product.category), selectinload(Product.stock_entries))
            .where(
                Product.company_id == company.id, 
                Product.sku == product_in.sku.strip()
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            # If it was created within the last 60 seconds, it's a ghost-save from a
            # previous response failure — return it as a success instead of blocking.
            cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
            created_at = existing.created_at
            if created_at.tzinfo is None:
                from datetime import timezone as tz
                created_at = created_at.replace(tzinfo=tz.utc)
            if created_at >= cutoff:
                existing._current_stock_override = Decimal("0.0")
                return existing
            # Otherwise it's a genuine duplicate — block it.
            raise HTTPException(
                status_code=400, 
                detail=f"Item Code (SKU) '{product_in.sku}' is already used by another product. Please enter a different code."
            )
            
    try:
        new_product = Product(
            **product_in.model_dump(),
            company_id=company.id,
            created_by=current_user.id
        )
        if new_product.sku:
            new_product.sku = new_product.sku.strip()
            
        db.add(new_product)
        await db.commit()
        
        # Re-fetch with all relationships eagerly loaded
        # This prevents MissingGreenlet errors during response serialization
        result = await db.execute(
            select(Product)
            .options(
                selectinload(Product.category),
                selectinload(Product.stock_entries),
            )
            .where(Product.id == new_product.id)
        )
        loaded_product = result.scalar_one()
        loaded_product._current_stock_override = Decimal("0.0")
        return loaded_product
    except IntegrityError as e:
        await db.rollback()
        error_detail = str(e.orig) if hasattr(e, 'orig') else str(e)
        print(f"INTEGRITY ERROR PAYLOAD: {product_in.model_dump()}")
        print(f"INTEGRITY ERROR DETAIL: {error_detail}")
        raise HTTPException(
            status_code=400, 
            detail=f"Database Constraint Error: {error_detail}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Industrial Process Failure: {str(e)}"
        )

@router.get("/products/{product_id}", response_model=ProductSchema)
async def get_product(
    product_id: UUID, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.stock_entries),
            selectinload(Product.category)
        )
        .filter(Product.id == product_id, Product.company_id == company.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.put("/products/{product_id}", response_model=ProductSchema)
async def update_product_route(
    product_id: UUID, 
    product_in: ProductUpdate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.stock_entries),
            selectinload(Product.category)
        )
        .where(Product.id == product_id, Product.company_id == company.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_in.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        # Clean data: Convert empty strings to None for optional fields
        final_value = value if value != "" else None
        if hasattr(product, key):
            setattr(product, key, final_value)
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Update failed: {str(e)}")
    
    # Re-fetch to ensure all relationships are loaded for the response model
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.stock_entries)
        )
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    return product

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_route(
    product_id: UUID, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Product)
        .filter(Product.id == product_id, Product.company_id == company.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    try:
        await db.delete(product)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Integrity Breach: This asset has active stock history or dependent ledger entries. Termination aborted. Please deactivate the node instead."
        )
    return None

# --- Categories ---
@router.get("/categories", response_model=List[CategorySchema])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(ProductCategory)
        .where(ProductCategory.company_id == company.id)
    )
    return result.scalars().all()

@router.post("/categories", response_model=CategorySchema)
async def create_category(
    category_in: ProductCategoryCreate, 
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    new_cat = ProductCategory(**category_in.model_dump(), company_id=company.id)
    db.add(new_cat)
    await db.commit()
    await db.refresh(new_cat)
    return new_cat

# --- Stock Ledger & Adjustments ---
@router.get("/products/{product_id}/ledger", response_model=List[StockEntrySchema])
async def get_product_ledger_route(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    # Verify product ownership
    prod_check = await db.execute(select(Product.id).filter(Product.id == product_id, Product.company_id == company.id))
    if not prod_check.scalar():
        raise HTTPException(status_code=404, detail="Product not found in this registry.")
    
    result = await db.execute(
        select(StockEntry)
        .where(StockEntry.product_id == product_id, StockEntry.company_id == company.id)
        .order_by(StockEntry.created_at.desc())
    )
    return result.scalars().all()

@router.post("/products/{product_id}/adjust", response_model=StockEntrySchema)
async def adjust_stock_route(
    product_id: UUID,
    adjustment: StockEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company: Company = Depends(get_current_company)
):
    # Verify product ownership
    prod_check = await db.execute(select(Product.id).filter(Product.id == product_id, Product.company_id == company.id))
    if not prod_check.scalar():
        raise HTTPException(status_code=404, detail="Target asset not found.")

    new_entry = StockEntry(
        **adjustment.model_dump(),
        company_id=company.id,
        created_by=current_user.id
    )
    db.add(new_entry)
    await db.commit()
    await db.refresh(new_entry)
    return new_entry


# --- Batches ---
def enrich_batch_details(batch: Batch, computed_stock: Decimal = Decimal("0.0")) -> Batch:
    from datetime import date, timedelta
    batch.current_stock = computed_stock
    today = date.today()
    if batch.expiry_date:
        if batch.expiry_date < today:
            batch.expiry_status = "expired"
        elif today <= batch.expiry_date <= today + timedelta(days=30):
            batch.expiry_status = "expiring_soon"
        else:
            batch.expiry_status = "active"
    else:
        batch.expiry_status = "active"
    return batch

@router.get("/products/{product_id}/batches", response_model=List[BatchSchema])
async def list_product_batches(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    print(f"DEBUG: list_product_batches called for product_id={product_id}, company_id={company.id}")
    # Verify product ownership
    prod_check = await db.execute(
        select(Product.id).filter(Product.id == product_id, Product.company_id == company.id)
    )
    product_exists = prod_check.scalar()
    print(f"DEBUG: product_exists result for list: {product_exists}")
    if not product_exists:
        raise HTTPException(status_code=404, detail="Product not found in this registry.")

    # Fetch batches and aggregate stock entries for each batch
    # pyrefly: ignore [missing-import]
    from sqlalchemy import func
    stock_sub = (
        select(
            StockEntry.batch_id,
            func.sum(StockEntry.quantity).label("computed_stock")
        )
        .where(StockEntry.company_id == company.id, StockEntry.product_id == product_id)
        .group_by(StockEntry.batch_id)
        .subquery()
    )

    result = await db.execute(
        select(Batch, stock_sub.c.computed_stock)
        .outerjoin(stock_sub, Batch.id == stock_sub.c.batch_id)
        .where(Batch.company_id == company.id, Batch.product_id == product_id)
        .order_by(Batch.batch_number)
    )
    
    rows = result.all()
    batches_with_stock = []
    for batch, computed_stock in rows:
        enrich_batch_details(batch, computed_stock or Decimal("0.0"))
        batches_with_stock.append(batch)
        
    return batches_with_stock

@router.post("/products/{product_id}/batches", response_model=BatchSchema, status_code=status.HTTP_201_CREATED)
async def create_batch(
    product_id: UUID,
    batch_in: BatchCreate,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    print(f"DEBUG: create_batch called for product_id={product_id}, company_id={company.id}")
    # Verify product ownership
    prod_check = await db.execute(
        select(Product.id).filter(Product.id == product_id, Product.company_id == company.id)
    )
    product_exists = prod_check.scalar()
    print(f"DEBUG: product_exists result for create: {product_exists}")
    if not product_exists:
        raise HTTPException(status_code=404, detail="Product not found in this registry.")

    # Check if batch_number already exists for this product under this company
    existing_result = await db.execute(
        select(Batch).where(
            Batch.company_id == company.id,
            Batch.product_id == product_id,
            Batch.batch_number == batch_in.batch_number.strip()
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Batch number '{batch_in.batch_number}' already exists for this product."
        )

    try:
        new_batch = Batch(
            **batch_in.model_dump(),
            company_id=company.id,
            product_id=product_id
        )
        new_batch.batch_number = new_batch.batch_number.strip()
        db.add(new_batch)
        await db.commit()
        await db.refresh(new_batch)
        enrich_batch_details(new_batch, Decimal("0.0"))
        return new_batch
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create batch: {str(e)}")

@router.put("/batches/{batch_id}", response_model=BatchSchema)
async def update_batch_route(
    batch_id: UUID,
    batch_in: BatchUpdate,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    result = await db.execute(
        select(Batch).where(Batch.id == batch_id, Batch.company_id == company.id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    update_data = batch_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(batch, key):
            setattr(batch, key, value)

    try:
        await db.commit()
        await db.refresh(batch)
        
        # Compute stock for returned batch
        # pyrefly: ignore [missing-import]
        from sqlalchemy import func
        stock_sum = await db.execute(
            select(func.sum(StockEntry.quantity))
            .where(StockEntry.company_id == company.id, StockEntry.batch_id == batch_id)
        )
        stock_qty = stock_sum.scalar() or Decimal("0.0")
        enrich_batch_details(batch, stock_qty)
        return batch
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Update failed: {str(e)}")

