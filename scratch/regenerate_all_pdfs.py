import asyncio
import os
import sys
import base64
from datetime import datetime

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from jinja2 import Environment, FileSystemLoader
from app.services.reports import _generate_pdf_async

async def main():
    print("Regenerating all invoice PDFs with header background & restored Ganesha logo...")
    template_dir = os.path.join(backend_dir, "app", "templates")
    env = Environment(loader=FileSystemLoader(template_dir))
    
    def indian_format(val):
        try:
            return f"₹{float(val):,.2f}"
        except Exception:
            return str(val)

    env.filters["indian_format"] = indian_format

    # Load green feather header background image as base64 Data URI
    header_bg_uri = ""
    feather_path = os.path.join(backend_dir, "app", "assets", "green feather .jpeg")
    if os.path.exists(feather_path):
        with open(feather_path, "rb") as f:
            header_bg_uri = f"data:image/jpeg;base64,{base64.b64encode(f.read()).decode('utf-8')}"
        print(f"Loaded green feather header background ({len(header_bg_uri)} bytes Data URI)")

    class Obj:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    mock_company = Obj(
        name="JK INFOTECH ERP",
        office_address_1="123 Industrial Area, Phase 2",
        office_address_2="City, State",
        city="Surat",
        state="Gujarat",
        pin_code="395006",
        gst_number="24AAAAA0000A1Z5",
        pan_number="AAAAA0000A",
        phone="9876543210",
        email="info@jkinfotech.com",
        registered_state="Gujarat",
        station_name="Surat"
    )

    mock_customer = Obj(
        name="Test Customer Pvt Ltd",
        office_address_1="456 Commerce House",
        state="Gujarat",
        gst_number="24BBBBB1111B1Z2",
        phone="9123456789"
    )

    mock_item = Obj(
        product_name="Industrial Product A",
        hsn_sac_code="8471",
        quantity=10,
        unit_price=500.0,
        tax_rate=18.0,
        tax_amount=900.0,
        total_amount=5900.0,
        product=Obj(name="Industrial Product A")
    )

    mock_invoice = Obj(
        invoice_number="JK-INFOTECH/2026-27/0001",
        invoice_date=datetime.now().strftime("%Y-%m-%d"),
        due_date=datetime.now().strftime("%Y-%m-%d"),
        subtotal=5000.0,
        tax_amount=900.0,
        total_amount=5900.0,
        igst_amount=0.0,
        cgst_amount=450.0,
        sgst_amount=450.0,
        round_off_amount=0.0,
        notes="Thank you for your business!",
        terms="Payment due within 15 days.",
        customer=mock_customer,
        items=[mock_item]
    )

    # 1. Theme 1 (Modern - invoice.html)
    t1 = env.get_template("invoice.html")
    html_t1 = t1.render(
        invoice=mock_invoice, company=mock_company, customer=mock_customer,
        items=[mock_item], total_qty=10, cgst_rate=9.0, sgst_rate=9.0, igst_rate=0.0,
        cgst_amount=450.0, sgst_amount=450.0, igst_amount=0.0, round_off=0.0,
        amount_in_words="Rupees Five Thousand Nine Hundred Only", payment_terms_days=15,
        bank_details={}, logo_svg="", background_image_path="", header_background_image_path=header_bg_uri,
        theme="modern", copy_types=["Original Copy"], now=datetime.now(), landscape=False
    )
    pdf1 = await _generate_pdf_async(html_t1)
    p1_path = os.path.join(os.path.dirname(__file__), "invoice_theme1_verified.pdf")
    with open(p1_path, "wb") as f:
        f.write(pdf1)
    print(f"[SUCCESS] Theme 1 PDF generated: {p1_path} ({len(pdf1)} bytes)")

    # 2. Theme 2 (Classic - invoice_riddhi.html)
    t2 = env.get_template("invoice_riddhi.html")
    html_t2 = t2.render(
        invoice=mock_invoice, company=mock_company, customer=mock_customer,
        items=[mock_item], total_qty=10, cgst_rate=9.0, sgst_rate=9.0, igst_rate=0.0,
        cgst_amount=450.0, sgst_amount=450.0, igst_amount=0.0, round_off=0.0,
        amount_in_words="Rupees Five Thousand Nine Hundred Only", payment_terms_days=15,
        bank_details={}, logo_svg="", background_image_path="", header_background_image_path=header_bg_uri,
        theme="classic", copy_types=["Original Copy"], now=datetime.now(), landscape=False
    )
    pdf2 = await _generate_pdf_async(html_t2)
    p2_path = os.path.join(os.path.dirname(__file__), "invoice_theme2_verified.pdf")
    with open(p2_path, "wb") as f:
        f.write(pdf2)
    print(f"[SUCCESS] Theme 2 PDF generated: {p2_path} ({len(pdf2)} bytes)")

if __name__ == "__main__":
    asyncio.run(main())
