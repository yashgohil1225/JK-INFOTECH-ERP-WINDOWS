import asyncio
import sys
from decimal import Decimal
from datetime import datetime, date
from uuid import UUID
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Import models and schemas
from app.models import Base, Invoice, InvoiceItem, Customer, Product
from app.schemas.sales import Invoice as InvoiceSchema

DATABASE_URL = "postgresql+asyncpg://postgres:jkerp_password_2026@127.0.0.1:5432/jk_erp"

async def main():
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        print("Fetching invoices...")
        try:
            result = await db.execute(
                select(Invoice)
                .options(
                    selectinload(Invoice.items).selectinload(InvoiceItem.product),
                    selectinload(Invoice.customer)
                )
                .where(Invoice.company_id == UUID("b4022c6d-a199-43a7-a513-d804445da583"))
            )
            invoices = result.scalars().all()
            print(f"Successfully fetched {len(invoices)} invoices from DB.")
            
            for idx, inv in enumerate(invoices):
                print(f"\nValidating Invoice {idx+1}/{len(invoices)}: {inv.invoice_number}...")
                try:
                    # Validate against Pydantic schema
                    validated = InvoiceSchema.model_validate(inv)
                    print(f"  ✓ Validated successfully!")
                except Exception as e:
                    print(f"  ✗ VALIDATION FAILED for invoice {inv.invoice_number}!")
                    import traceback
                    traceback.print_exc()
                    
        except Exception as e:
            print("  ✗ DATABASE QUERY FAILED!")
            import traceback
            traceback.print_exc()
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
