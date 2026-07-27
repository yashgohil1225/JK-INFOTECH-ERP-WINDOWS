import asyncio
import time
import uuid
import random
from decimal import Decimal
from datetime import datetime, date, timedelta
from app.database import AsyncSessionLocal
from app.models import (
    Company, User, ProductCategory, Product, Customer, Supplier,
    Invoice, InvoiceItem, PurchaseBill, Account, Payment
)
from sqlalchemy import select, func

async def run_stress_test():
    print("=" * 70)
    print("JK INFOTECH ERP — ENTERPRISE STRESS & BENCHMARK SUITE")
    print("=" * 70)

    start_total_time = time.time()
    
    async with AsyncSessionLocal() as db:
        # 1. Create Dedicated Test Company
        company_name = f"JK Benchmark & Stress Corp ({uuid.uuid4().hex[:6].upper()})"
        print(f"\n[1/6] Creating Dedicated Test Workspace: {company_name}...")
        test_company = Company(
            name=company_name,
            email="benchmark@jkinfotech.com",
            phone="9876543210",
            gst_number="24AAACJ9999Z1Z9",
            office_address_1="Unit 101, Enterprise Tech Park, GIDC Sanand",
            station_name="Ahmedabad",
            registered_state="Gujarat",
            pincode="382110",
            is_gst_applicable=True,
            default_tax_rate=Decimal("18.00")
        )
        db.add(test_company)
        await db.commit()
        await db.refresh(test_company)
        print(f"   ✓ Company Created — ID: {test_company.id}")

        # 2. Bulk Seed Product Categories (10 Categories)
        print("\n[2/6] Seeding 10 Product Categories...")
        cat_names = [
            "Industrial Automation", "Electrical Switchgear", "Sensors & Controls",
            "Pneumatic Cylinders", "Hydraulic Valves", "Cable Accessories",
            "Power Supplies & SMPS", "Robotics Components", "Measuring Instruments", "Safety Light Curtains"
        ]
        categories = []
        for name in cat_names:
            cat = ProductCategory(company_id=test_company.id, name=name, description=f"High performance {name.lower()} components")
            categories.append(cat)
            db.add(cat)
        await db.commit()
        for cat in categories:
            await db.refresh(cat)
        print(f"   ✓ 10 Categories Seeded Successfully.")

        # 3. Bulk Seed Products (500+ Items)
        print("\n[3/6] Seeding 500+ High-Density Inventory Products...")
        products = []
        t0 = time.time()
        for i in range(1, 501):
            cat = categories[i % len(categories)]
            p_name = f"Product Item #{i:04d} - {cat.name[:12]}"
            sku = f"SKU-{cat.name[:3].upper()}-{i:04d}"
            barcode = f"8901234{i:06d}"
            purchase_price = Decimal(str(round(random.uniform(100.0, 15000.0), 2)))
            sale_price = Decimal(str(round(float(purchase_price) * 1.35, 2)))
            
            prod = Product(
                company_id=test_company.id,
                category_id=cat.id,
                name=p_name,
                sku=sku,
                barcode=barcode,
                hsn_code=f"853{random.randint(10, 99)}000",
                unit="PCS",
                purchase_price=purchase_price,
                sale_price=sale_price,
                tax_rate=Decimal("18.00"),
                reorder_level=Decimal("10.00")
            )
            products.append(prod)
            db.add(prod)
        await db.commit()
        for p in products:
            await db.refresh(p)
        t_prod = time.time() - t0
        print(f"   ✓ 500 Products Seeded in {t_prod:.3f}s ({500/t_prod:.1f} items/sec).")

        # 4. Bulk Seed Customers & Suppliers (200+ Parties)
        print("\n[4/6] Seeding 200+ Customers & Suppliers...")
        t0 = time.time()
        customers = []
        suppliers = []
        cities = ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Sanand", "Gandhinagar", "Morbi", "Bharuch"]
        
        for i in range(1, 151):
            c = Customer(
                company_id=test_company.id,
                name=f"Enterprise Client #{i:03d} Pvt Ltd",
                email=f"client{i}@enterprise-corp.local",
                phone=f"9825{i:06d}",
                gst_number=f"24AAAC{i:04d}A1Z{i%9+1}",
                address=f"Phase {i%5+1} GIDC Estate",
                city=random.choice(cities),
                state="Gujarat",
                pincode="380001",
                credit_limit=Decimal("500000.00")
            )
            customers.append(c)
            db.add(c)
            
        for i in range(1, 51):
            s = Supplier(
                company_id=test_company.id,
                name=f"Vendor Supplier #{i:03d} India Ltd",
                email=f"vendor{i}@supplier-net.local",
                phone=f"9879{i:06d}",
                gst_number=f"24AAAS{i:04d}B1Z{i%9+1}",
                address=f"Industrial Zone #{i%4+1}",
                city=random.choice(cities),
                state="Gujarat",
                pincode="380002"
            )
            suppliers.append(s)
            db.add(s)
        await db.commit()
        for c in customers:
            await db.refresh(c)
        for s in suppliers:
            await db.refresh(s)
        t_party = time.time() - t0
        print(f"   ✓ 200 Parties Seeded in {t_party:.3f}s ({200/t_party:.1f} parties/sec).")

        # 5. Bulk Seed 1,000+ Invoices & 4,000+ Items
        print("\n[5/6] Seeding 1,000+ Billing Invoices with 4,000+ Line Items...")
        t0 = time.time()
        invoices_count = 1000
        line_items_total = 0
        
        for i in range(1, invoices_count + 1):
            cust = random.choice(customers)
            inv_date = date.today() - timedelta(days=random.randint(1, 365))
            due_date = inv_date + timedelta(days=30)
            
            # Select 3 to 6 random products for this invoice
            num_items = random.randint(3, 6)
            selected_prods = random.sample(products, num_items)
            
            subtotal = Decimal("0.00")
            tax_total = Decimal("0.00")
            items_to_add = []
            
            for prod in selected_prods:
                qty = Decimal(str(random.randint(1, 10)))
                price = prod.sale_price
                item_total = qty * price
                item_tax = (item_total * prod.tax_rate) / Decimal("100.00")
                
                subtotal += item_total
                tax_total += item_tax
                
                items_to_add.append({
                    "prod": prod,
                    "qty": qty,
                    "price": price,
                    "total": item_total,
                    "tax_rate": prod.tax_rate,
                    "tax_amount": item_tax
                })
            
            cgst = tax_total / Decimal("2.00")
            sgst = tax_total / Decimal("2.00")
            total = subtotal + tax_total
            status = random.choice(["PAID", "UNPAID", "PARTIAL"])
            paid_amt = total if status == "PAID" else (total / Decimal("2.00") if status == "PARTIAL" else Decimal("0.00"))
            bal_due = total - paid_amt
            
            inv = Invoice(
                company_id=test_company.id,
                customer_id=cust.id,
                invoice_number=f"STRESS-INV-{i:05d}",
                invoice_date=inv_date,
                due_date=due_date,
                status=status,
                subtotal=subtotal,
                tax_amount=tax_total,
                cgst_amount=cgst,
                sgst_amount=sgst,
                igst_amount=Decimal("0.00"),
                total=total,
                amount_paid=paid_amt,
                balance_due=bal_due,
                notes=f"Bulk Benchmark Invoice #{i}"
            )
            db.add(inv)
            await db.flush()
            
            for item in items_to_add:
                inv_item = InvoiceItem(
                    invoice_id=inv.id,
                    product_id=item["prod"].id,
                    hsn_code=item["prod"].hsn_code,
                    quantity=item["qty"],
                    unit_price=item["price"],
                    total=item["total"],
                    tax_rate=item["tax_rate"],
                    tax_amount=item["tax_amount"]
                )
                db.add(inv_item)
                line_items_total += 1

            if i % 250 == 0:
                await db.commit()
                print(f"   ... Processed {i}/{invoices_count} invoices ({line_items_total} line items)")

        await db.commit()
        t_inv = time.time() - t0
        print(f"   ✓ {invoices_count} Invoices ({line_items_total} line items) Seeded in {t_inv:.3f}s ({invoices_count/t_inv:.1f} inv/sec).")

        # 6. Run Execution Latency & Database Performance Queries
        print("\n[6/6] Executing Real-Time Database Latency & Benchmark Queries...")
        
        # Test 1: Count Invoices
        t0 = time.time()
        res = await db.execute(select(func.count(Invoice.id)).where(Invoice.company_id == test_company.id))
        count_inv = res.scalar()
        t_count = (time.time() - t0) * 1000.0

        # Test 2: Revenue Aggregation
        t0 = time.time()
        res = await db.execute(select(func.sum(Invoice.total)).where(Invoice.company_id == test_company.id))
        total_rev = res.scalar()
        t_sum = (time.time() - t0) * 1000.0

        # Test 3: Multi-Table Join & Filtering (Top 10 Customers by Revenue)
        t0 = time.time()
        res = await db.execute(
            select(Customer.name, func.sum(Invoice.total).label("total_spent"))
            .join(Invoice, Customer.id == Invoice.customer_id)
            .where(Invoice.company_id == test_company.id)
            .group_by(Customer.id, Customer.name)
            .order_by(func.sum(Invoice.total).desc())
            .limit(10)
        )
        top_custs = res.all()
        t_join = (time.time() - t0) * 1000.0

        # Test 4: Product Text Search Latency
        t0 = time.time()
        res = await db.execute(
            select(Product)
            .where(Product.company_id == test_company.id)
            .where(Product.name.ilike("%Automation%"))
            .limit(50)
        )
        search_res = res.scalars().all()
        t_search = (time.time() - t0) * 1000.0

        total_elapsed = time.time() - start_total_time

        print("=" * 70)
        print("PERFORMANCE BENCHMARK RESULTS")
        print("=" * 70)
        print(f"Company Workspace : {company_name}")
        print(f"Total Products    : {len(products)}")
        print(f"Total Parties     : {len(customers) + len(suppliers)}")
        print(f"Total Invoices    : {count_inv}")
        print(f"Total Line Items  : {line_items_total}")
        print(f"Aggregated Total  : ₹ {float(total_rev or 0):,.2f}")
        print("-" * 70)
        print("QUERY LATENCY (ms):")
        print(f"  • Count Query (1,000+ Invoices)           : {t_count:.2f} ms")
        print(f"  • Revenue Aggregation Sum Query           : {t_sum:.2f} ms")
        print(f"  • Customer Multi-Table Group & Join Query  : {t_join:.2f} ms")
        print(f"  • Full Text Search Query (%Automation%)    : {t_search:.2f} ms")
        print("-" * 70)
        print(f"TOTAL STRESS SUITE EXECUTION TIME: {total_elapsed:.2f} seconds")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_stress_test())
