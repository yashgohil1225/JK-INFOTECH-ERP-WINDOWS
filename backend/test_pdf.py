import asyncio
from app.database import AsyncSessionLocal
from app.models import Invoice
from app.services.reports import ReportService
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Invoice).limit(1))
        inv = res.scalar_one_or_none()
        if not inv:
            print("No invoice found!")
            return
        
        service = ReportService(db, inv.company_id)
        pdf_bytes, matches = await service.generate_invoice_pdf(
            invoice_id=inv.id,
            company_id=inv.company_id,
            theme="modern",
            copy_type="original",
            landscape=False
        )
        with open("test_invoice.pdf", "wb") as f:
            f.write(pdf_bytes)
        print(f"Generated test_invoice.pdf ({len(pdf_bytes)} bytes) successfully!")

if __name__ == "__main__":
    asyncio.run(main())
