import asyncio
import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from app.services.reports import _generate_pdf_async, _render_pdf_sync

async def main():
    print("Testing _generate_pdf_async with sample HTML...")
    sample_html = "<html><body><h1>JK INFOTECH ERP - PDF TEST</h1><p>Testing Playwright HTML PDF rendering...</p></body></html>"
    
    try:
        pdf_bytes = await _generate_pdf_async(sample_html)
        print(f"[SUCCESS] _generate_pdf_async returned {len(pdf_bytes)} bytes of PDF data!")
    except Exception as e:
        print(f"[ERROR] _generate_pdf_async failed: {e}")

    print("\nTesting _render_pdf_sync fallback...")
    try:
        out_path = os.path.join(os.path.dirname(__file__), "test_out.pdf")
        _render_pdf_sync(sample_html, out_path)
        if os.path.exists(out_path):
            print(f"[SUCCESS] _render_pdf_sync generated PDF file of size {os.path.getsize(out_path)} bytes!")
            os.remove(out_path)
    except Exception as e:
        print(f"[ERROR] _render_pdf_sync failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
