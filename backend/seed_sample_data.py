import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, date, timedelta
from app.database import AsyncSessionLocal
from app.models import (
    Company, User, ProductCategory, Product, Customer, Supplier,
    Invoice, InvoiceItem, PurchaseBill, Account
)
from sqlalchemy import select

async def seed():
    async with AsyncSessionLocal() as db:
        # Get active company
        co_res = await db.execute(select(Company).limit(1))
        company = co_res.scalar_one_or_none()
        if not company:
            print("No company found!")
            return

        print(f"Seeding sample data for company: {company.name} ({company.id})")

        # 1. Categories
        cat1 = ProductCategory(company_id=company.id, name="Industrial Automation", description="Control Panels & Drives")
        cat2 = ProductCategory(company_id=company.id, name="Electrical Components", description="Relays, Switchgear & Breakers")
        cat3 = ProductCategory(company_id=company.id, name="Sensors & Meters", description="Proximity, Flow & Pressure Sensors")
        db.add_all([cat1, cat2, cat3])
        await db.flush()

        # 2. Products
        p1 = Product(company_id=company.id, category_id=cat1.id, name="VFD Drive 7.5kW 3-Phase", sku="VFD-75-3P", hsn_code="85044090", unit="PCS", purchase_price=Decimal("18500.00"), sale_price=Decimal("24500.00"), tax_rate=Decimal("18.00"))
        p2 = Product(company_id=company.id, category_id=cat1.id, name="PLC Controller 24-IO", sku="PLC-24IO-FX", hsn_code="85371000", unit="PCS", purchase_price=Decimal("14200.00"), sale_price=Decimal("19800.00"), tax_rate=Decimal("18.00"))
        p3 = Product(company_id=company.id, category_id=cat2.id, name="MCB 3-Pole 32A C-Curve", sku="MCB-3P-32A", hsn_code="85362000", unit="PCS", purchase_price=Decimal("420.00"), sale_price=Decimal("680.00"), tax_rate=Decimal("18.00"))
        p4 = Product(company_id=company.id, category_id=cat2.id, name="Power Contactors 40A 230V", sku="CTR-40A-230V", hsn_code="85364900", unit="PCS", purchase_price=Decimal("890.00"), sale_price=Decimal("1350.00"), tax_rate=Decimal("18.00"))
        p5 = Product(company_id=company.id, category_id=cat3.id, name="Inductive Proximity Sensor M12", sku="SEN-PROX-M12", hsn_code="90318000", unit="PCS", purchase_price=Decimal("310.00"), sale_price=Decimal("520.00"), tax_rate=Decimal("18.00"))
        db.add_all([p1, p2, p3, p4, p5])
        await db.flush()

        # 3. Customers
        c1 = Customer(company_id=company.id, name="Reliance Industries Ltd", email="procurement@ril.local", phone="9825012345", gst_number="24AAACR5000A1Z9", address="GIDC Estate, Naroda", city="Ahmedabad", state="Gujarat", pincode="382330")
        c2 = Customer(company_id=company.id, name="Tata Motors Automation Ltd", email="purchase@tatamotors.local", phone="9879512346", gst_number="24AAACT1000B1Z5", address="Sanand Industrial Area", city="Sanand", state="Gujarat", pincode="382110")
        c3 = Customer(company_id=company.id, name="L&T Electricals Ltd", email="electricals@lnt.local", phone="9898012347", gst_number="24AAACL2000C1Z1", address="Hazira Complex", city="Surat", state="Gujarat", pincode="394270")
        db.add_all([c1, c2, c3])

        # 4. Suppliers
        s1 = Supplier(company_id=company.id, name="Siemens India Pvt Ltd", email="orders@siemens.local", phone="9824098765", gst_number="24AAACS3000D1Z2")
        s2 = Supplier(company_id=company.id, name="Schneider Electric Ltd", email="supply@schneider.local", phone="9879098764", gst_number="24AAACS4000E1Z8")
        db.add_all([s1, s2])
        await db.flush()

        # 5. Invoices
        inv1 = Invoice(
            company_id=company.id,
            customer_id=c1.id,
            invoice_number="INV-2026-0001",
            invoice_date=date.today() - timedelta(days=10),
            due_date=date.today() + timedelta(days=20),
            status="PAID",
            subtotal=Decimal("49000.00"),
            tax_amount=Decimal("8820.00"),
            cgst_amount=Decimal("4410.00"),
            sgst_amount=Decimal("4410.00"),
            igst_amount=Decimal("0.00"),
            total=Decimal("57820.00"),
            amount_paid=Decimal("57820.00"),
            balance_due=Decimal("0.00"),
            notes="Order #REL-9921 fulfilled successfully."
        )
        db.add(inv1)
        await db.flush()

        item1_1 = InvoiceItem(invoice_id=inv1.id, product_id=p1.id, hsn_code=p1.hsn_code, quantity=Decimal("2"), unit_price=Decimal("24500.00"), total=Decimal("49000.00"), tax_rate=Decimal("18.00"), tax_amount=Decimal("8820.00"))
        db.add(item1_1)

        # Invoice 2
        inv2 = Invoice(
            company_id=company.id,
            customer_id=c2.id,
            invoice_number="INV-2026-0002",
            invoice_date=date.today() - timedelta(days=3),
            due_date=date.today() + timedelta(days=27),
            status="UNPAID",
            subtotal=Decimal("53100.00"),
            tax_amount=Decimal("9558.00"),
            cgst_amount=Decimal("4779.00"),
            sgst_amount=Decimal("4779.00"),
            igst_amount=Decimal("0.00"),
            total=Decimal("62658.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("62658.00"),
            notes="Payment due within 30 days."
        )
        db.add(inv2)
        await db.flush()

        item2_1 = InvoiceItem(invoice_id=inv2.id, product_id=p2.id, hsn_code=p2.hsn_code, quantity=Decimal("2"), unit_price=Decimal("19800.00"), total=Decimal("39600.00"), tax_rate=Decimal("18.00"), tax_amount=Decimal("7128.00"))
        item2_2 = InvoiceItem(invoice_id=inv2.id, product_id=p4.id, hsn_code=p4.hsn_code, quantity=Decimal("10"), unit_price=Decimal("1350.00"), total=Decimal("13500.00"), tax_rate=Decimal("18.00"), tax_amount=Decimal("2430.00"))
        db.add_all([item2_1, item2_2])

        # Invoice 3
        inv3 = Invoice(
            company_id=company.id,
            customer_id=c3.id,
            invoice_number="INV-2026-0003",
            invoice_date=date.today() - timedelta(days=1),
            due_date=date.today() + timedelta(days=15),
            status="PARTIAL",
            subtotal=Decimal("26000.00"),
            tax_amount=Decimal("4680.00"),
            cgst_amount=Decimal("2340.00"),
            sgst_amount=Decimal("2340.00"),
            igst_amount=Decimal("0.00"),
            total=Decimal("30680.00"),
            amount_paid=Decimal("15000.00"),
            balance_due=Decimal("15680.00"),
            notes="Advance 15,000 received."
        )
        db.add(inv3)
        await db.flush()

        item3_1 = InvoiceItem(invoice_id=inv3.id, product_id=p5.id, hsn_code=p5.hsn_code, quantity=Decimal("50"), unit_price=Decimal("520.00"), total=Decimal("26000.00"), tax_rate=Decimal("18.00"), tax_amount=Decimal("4680.00"))
        db.add(item3_1)

        # 6. Purchase Bills
        pb1 = PurchaseBill(
            company_id=company.id,
            supplier_id=s1.id,
            bill_number="BILL-2026-0101",
            bill_date=date.today() - timedelta(days=15),
            due_date=date.today() + timedelta(days=15),
            status="PAID",
            subtotal=Decimal("142000.00"),
            tax_amount=Decimal("25560.00"),
            total=Decimal("167560.00"),
            amount_paid=Decimal("167560.00"),
            balance_due=Decimal("0.00")
        )
        db.add(pb1)

        await db.commit()
        print("★ Sample Data Successfully Seeded! Products, Customers, Suppliers, Invoices and Bills created.")

if __name__ == "__main__":
    asyncio.run(seed())
