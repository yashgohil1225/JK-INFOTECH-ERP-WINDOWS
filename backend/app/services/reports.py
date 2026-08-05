# =============================================================
# JK INFOTECH ERP — Report & Document Services
# File : app/services/reports.py
# =============================================================

import uuid
import os
import sys
from decimal import Decimal
from typing import Optional
from datetime import datetime, date
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import selectinload
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from jinja2 import Environment, FileSystemLoader
# pyrefly: ignore [missing-import]
import anyio
import traceback
# pyrefly: ignore [missing-import]
from fastapi import HTTPException
import pandas as pd
import io
import tempfile
from app.models import Invoice, InvoiceItem, Company, Customer, Supplier, AuditLog, PurchaseBill
from html.parser import HTMLParser
import re

class InvoiceSearchParser(HTMLParser):
    def __init__(self, search_query: str):
        super().__init__()
        self.search_query = search_query.lower()
        self.pages = []
        self.current_page_text = []
        self.in_page = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        # Theme 1 uses "invoice-paper", Theme 2 uses "page-container"
        if tag == "div" and ("invoice-paper" in attrs_dict.get("class", "") or "page-container" in attrs_dict.get("class", "")):
            if self.in_page and self.current_page_text:
                self.pages.append(" ".join(self.current_page_text))
                self.current_page_text = []
            self.in_page = True

    def handle_data(self, data):
        if self.in_page:
            self.current_page_text.append(data)

    def handle_endtag(self, tag):
        pass

    def get_matches_per_page(self) -> list:
        if self.in_page and self.current_page_text:
            self.pages.append(" ".join(self.current_page_text))
            self.current_page_text = []
            self.in_page = False
            
        if not self.pages and self.current_page_text:
            self.pages.append(" ".join(self.current_page_text))

        counts = []
        for p_text in self.pages:
            matches = re.findall(re.escape(self.search_query), p_text.lower())
            counts.append(len(matches))
        if not counts:
            counts = [0]
        return counts

class IndustrialExcelWriter:
    """
    Standardized Excel Reporting Engine for JK Infotech ERP.
    Ensures 100% Visual Parity between Excel and PDF Reports.
    Provides Robustness through Safe Data Sanitization.
    """
    def __init__(self, workbook, company_info, report_title, period_info):
        self.workbook = workbook
        self.company = company_info
        self.title = report_title.upper()
        self.period = period_info
        self._init_formats()

    def _init_formats(self):
        # Professional Typography & Colors
        self.fmt_header = self.workbook.add_format({'bold': True, 'font_size': 16, 'font_color': '#2c3e50', 'align': 'center'})
        self.fmt_subheader = self.workbook.add_format({'font_size': 10, 'font_color': '#555555', 'align': 'center'})
        self.fmt_report_title = self.workbook.add_format({'bold': True, 'font_size': 14, 'font_color': '#e67e22', 'align': 'center', 'underline': True})
        
        # Industrial Section Brading
        self.fmt_section_bg = self.workbook.add_format({'bold': True, 'bg_color': '#2c3e50', 'font_color': '#ffffff', 'font_size': 11, 'border': 1, 'align': 'left'})
        
        # Table Styling
        self.fmt_table_header = self.workbook.add_format({'bold': True, 'bg_color': '#eeeeee', 'border': 1, 'align': 'center', 'valign': 'vcenter', 'font_size': 9})
        self.fmt_border = self.workbook.add_format({'border': 1, 'font_size': 9})
        self.fmt_money = self.workbook.add_format({'border': 1, 'num_format': '#,##0.00', 'font_size': 9, 'align': 'right'})
        self.fmt_date = self.workbook.add_format({'border': 1, 'num_format': 'dd-mm-yy', 'font_size': 9, 'align': 'center'})
        self.fmt_bold_border = self.workbook.add_format({'border': 1, 'bold': True, 'font_size': 9})
        self.fmt_total_label = self.workbook.add_format({'bold': True, 'bg_color': '#f8f9fa', 'border': 1, 'font_size': 9})

    def write_standard_header(self, sheet, section_name, count=None, merge_cols=8):
        """Writes the standardized Company Branding and Report Metadata."""
        col_end = chr(ord('A') + merge_cols - 1)
        sheet.merge_range(f'A1:{col_end}1', self.company["name"].upper(), self.fmt_header)
        
        addr = f"{self.company.get('address', '')} | GSTIN: {self.company.get('gst_number', '')}"
        sheet.merge_range(f'A2:{col_end}2', addr, self.fmt_subheader)
        
        sheet.merge_range(f'A4:{col_end}4', self.title, self.fmt_report_title)
        
        period_text = f"Return Period: {self.period['start']} to {self.period['end']}"
        gen_text = f"Generated On: {datetime.now().strftime('%d-%m-%Y %H:%M')}"
        sheet.write('A6', period_text, self.workbook.add_format({'bold': True, 'font_size': 10}))
        sheet.write(f'{col_end}6', gen_text, self.workbook.add_format({'align': 'right', 'font_size': 9}))
        
        count_str = f" | Total Records: {count}" if count is not None else ""
        sheet.merge_range(f'A8:{col_end}8', f"{section_name}{count_str}", self.fmt_section_bg)

    @staticmethod
    def safe_float(val):
        """Robustly converts any value (Decimal, None, String) to float."""
        try:
            if val is None: return 0.0
            return float(val)
        except (ValueError, TypeError):
            return 0.0

    def set_column_widths(self, sheet, widths: list):
        """Helper to set multiple column widths."""
        for i, width in enumerate(widths):
            sheet.set_column(i, i, width)


# =============================================================
# PDF Generation — Persistent Browser Singleton
# =============================================================
# Chromium is launched ONCE (on first PDF request) and kept alive.
# Each request just opens a new Page (microseconds) instead of
# launching a new browser (~2-3 seconds). Thread-safe via a lock.
# =============================================================

import threading as _threading
import queue as _queue

_playwright_lock = _threading.Lock()
_playwright_browsers_path = ""
_cached_logo_svg = None
_cached_header_bg = None

# =============================================================
# Single dedicated Playwright daemon thread
# Playwright Sync API must always run on the SAME thread that
# created the browser. anyio's thread pool recycles threads, so
# we use one permanent daemon thread with a job queue instead.
# =============================================================

_pw_job_queue: "_queue.Queue[tuple]" = _queue.Queue()
_pw_thread_started = False
_pw_thread_lock = _threading.Lock()


def _playwright_worker():
    """
    Runs forever on a single daemon thread.
    Receives (fn, result_holder, event) tuples and executes them
    in the same thread that owns the Playwright browser.
    """
    import asyncio
    try:
        asyncio.set_event_loop(None)
    except Exception:
        pass

    pw_instance = None
    pw_browser = None

    browsers_path = _resolve_browsers_path()
    if browsers_path:
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = browsers_path

    # pyrefly: ignore [missing-import]
    from playwright.sync_api import sync_playwright

    while True:
        job = _pw_job_queue.get()
        if job is None:
            break

        html_content, pdf_path, landscape, search_query, result_holder, done_event = job

        try:
            # (Re)launch browser if not alive
            if pw_browser is None or not pw_browser.is_connected():
                try:
                    if pw_browser is not None:
                        pw_browser.close()
                except Exception:
                    pass
                try:
                    if pw_instance is not None:
                        pw_instance.__exit__(None, None, None)
                except Exception:
                    pass
                pw_instance = sync_playwright().start()
                launch_args = [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-extensions",
                ]
                try:
                    pw_browser = pw_instance.chromium.launch(headless=True, args=launch_args)
                except Exception as launch_err:
                    print(f"JK ERP: Sync Playwright Chromium launch failed ({launch_err}). Trying direct MS Edge EXE...")
                    _edge_profile_dir = os.path.join(tempfile.gettempdir(), "jk_pdf_edge_profile")
                    os.makedirs(_edge_profile_dir, exist_ok=True)

                    # Priority 1: Direct MS Edge executable (most reliable on client PCs)
                    edge_paths = [
                        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
                        os.path.expandvars(r"%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe"),
                        os.path.expandvars(r"%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe"),
                    ]
                    found_edge = next((exe for exe in edge_paths if exe and os.path.exists(exe)), None)
                    if found_edge:
                        try:
                            edge_args = launch_args + [f"--user-data-dir={_edge_profile_dir}"]
                            pw_browser = pw_instance.chromium.launch(executable_path=found_edge, headless=True, args=edge_args)
                            print(f"JK ERP: Sync PDF engine launched via direct MS Edge at: {found_edge}")
                        except Exception as e_edge:
                            print(f"JK ERP: Direct MS Edge EXE launch failed ({e_edge}). Trying MS Edge channel...")

                    # Priority 2: MS Edge channel
                    if pw_browser is None or not pw_browser.is_connected():
                        try:
                            pw_browser = pw_instance.chromium.launch(channel="msedge", headless=True, args=launch_args)
                        except Exception as e2:
                            print(f"JK ERP: MS Edge channel launch failed ({e2}). Trying Chrome channel...")

                    # Priority 3: Chrome channel
                    if pw_browser is None or not pw_browser.is_connected():
                        try:
                            pw_browser = pw_instance.chromium.launch(channel="chrome", headless=True, args=launch_args)
                        except Exception as e3:
                            print(f"JK ERP: Chrome channel launch failed ({e3}). Trying direct Chrome EXE...")

                    # Priority 4: Direct Chrome executable
                    if pw_browser is None or not pw_browser.is_connected():
                        chrome_paths = [
                            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
                        ]
                        found_chrome = next((exe for exe in chrome_paths if exe and os.path.exists(exe)), None)
                        if found_chrome:
                            chrome_args = launch_args + [f"--user-data-dir={_edge_profile_dir}"]
                            pw_browser = pw_instance.chromium.launch(executable_path=found_chrome, headless=True, args=chrome_args)
                        else:
                            raise launch_err

            page = pw_browser.new_page()
            try:
                # For landscape: use 1400px wide viewport to match A4 landscape printable area
                # For portrait: use 900px wide viewport to match A4 portrait
                vp_w = 1400 if landscape else 900
                vp_h = 900 if landscape else 1400
                page.set_viewport_size({"width": vp_w, "height": vp_h})
                # Use load/domcontentloaded to prevent networkidle timeouts on offline/slow connections
                try:
                    page.set_content(html_content, wait_until="load", timeout=12000)
                except Exception:
                    page.set_content(html_content, wait_until="domcontentloaded", timeout=12000)
                if search_query:
                    highlight_script = f"""
                    () => {{
                        const search = "{search_query}".replace(/[-/\\^$*+?.()|[\\]{{}}]/g, '\\$&');
                        if (!search) return;
                        const regex = new RegExp("(" + search + ")", "gi");
                        function walk(node) {{
                            if (node.nodeType === 3) {{
                                const matches = node.nodeValue.match(regex);
                                if (matches) {{
                                    const span = document.createElement("span");
                                    span.innerHTML = node.nodeValue.replace(regex, '<mark style="background-color: #FACC15; color: #000000; font-weight: bold; padding: 1px 2px; border-radius: 2px;">$1</mark>');
                                    node.parentNode.replaceChild(span, node);
                                }}
                            }} else if (node.nodeType === 1 && node.nodeName !== "SCRIPT" && node.nodeName !== "STYLE") {{
                                for (let i = node.childNodes.length - 1; i >= 0; i--) {{
                                    walk(node.childNodes[i]);
                                }}
                            }}
                        }}
                        walk(document.body);
                    }}
                    """
                    page.evaluate(highlight_script)
                pdf_kwargs = {
                    "path": pdf_path,
                    "print_background": True,
                    "margin": {"top": "0", "right": "0", "bottom": "0", "left": "0"},
                    "scale": 1.0,
                    "prefer_css_page_size": True,
                    "landscape": landscape,
                }
                page.pdf(**pdf_kwargs)
                result_holder["error"] = None
            finally:
                page.close()
        except Exception as e:
            result_holder["error"] = e
        finally:
            done_event.set()


def _ensure_pw_thread():
    global _pw_thread_started
    with _pw_thread_lock:
        if not _pw_thread_started:
            t = _threading.Thread(target=_playwright_worker, daemon=True, name="playwright-pdf-worker")
            t.start()
            _pw_thread_started = True


def _resolve_browsers_path() -> str:
    """Resolve where Playwright/Chromium is installed."""
    import sys
    is_frozen = getattr(sys, 'frozen', False)

    if is_frozen:
        base = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        embedded_ms = os.path.join(base, "ms-playwright")
        if os.path.isdir(embedded_ms):
            return embedded_ms
        embedded = os.path.join(base, "playwright", "driver", "package", ".local-chromium")
        if os.path.isdir(embedded):
            return os.path.join(base, "playwright", "driver", "package")

    local_appdata = os.environ.get("LOCALAPPDATA")
    user_profile = os.environ.get("USERPROFILE")
    if local_appdata:
        return os.path.join(local_appdata, "ms-playwright")
    elif user_profile:
        return os.path.join(user_profile, "AppData", "Local", "ms-playwright")
    return ""


def _render_pdf_sync(html_content: str, pdf_path: str, landscape: bool = False, search_query: Optional[str] = None) -> None:
    """
    Sends a PDF render job to the single permanent Playwright thread and waits for completion.
    This guarantees Playwright always runs on the same thread that owns the browser.
    """
    _ensure_pw_thread()
    result_holder: dict = {"error": None}
    done_event = _threading.Event()
    _pw_job_queue.put((html_content, pdf_path, landscape, search_query, result_holder, done_event))
    done_event.wait()
    if result_holder["error"] is not None:
        raise result_holder["error"]


def _auto_install_chromium_if_missing():
    try:
        browsers_path = _resolve_browsers_path()
        if browsers_path and os.path.exists(browsers_path) and os.listdir(browsers_path):
            return
        from playwright._impl._driver import compute_driver_executable
        driver_exec, env = compute_driver_executable()
        env["PLAYWRIGHT_BROWSERS_PATH"] = browsers_path or os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright")
        import subprocess
        subprocess.run([str(driver_exec), "install", "chromium"], env=env, capture_output=True, timeout=120)
    except Exception as e:
        print(f"JK ERP: Auto-install chromium notice: {e}")


async def _generate_pdf_async(html_content: str, landscape: bool = False, search_query: Optional[str] = None) -> bytes:
    """
    Generate a PDF from HTML using Async Playwright.
    Compatible with FastAPI's asyncio event loop on Windows/Linux.
    Uses robust 5-stage browser resolution:
      1. Standard Playwright Chromium (dev/downloaded)
      2. Direct MS Edge EXE path (most reliable on client PCs)
      3. MS Edge Playwright channel
      4. Chrome Playwright channel
      5. Direct Chrome EXE path
    """
    browsers_path = _resolve_browsers_path()
    if browsers_path:
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = browsers_path

    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        launch_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
        ]
        browser = None
        
        # Reusable temp profile directory to avoid creating hundreds of temp dirs
        _edge_profile_dir = os.path.join(tempfile.gettempdir(), "jk_pdf_edge_profile")
        os.makedirs(_edge_profile_dir, exist_ok=True)

        # Attempt 1: Standard Playwright bundled/downloaded Chromium
        try:
            browser = await p.chromium.launch(headless=True, args=launch_args)
        except Exception as e1:
            print(f"JK ERP: Standard Playwright Chromium launch notice ({e1}). Trying direct MS Edge EXE...")
            _auto_install_chromium_if_missing()

            # Attempt 2: Direct MS Edge executable path (highest reliability on Windows 10/11 client PCs)
            edge_paths = [
                r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
                os.path.expandvars(r"%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe"),
                os.path.expandvars(r"%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe"),
            ]
            found_edge = next((exe for exe in edge_paths if exe and os.path.exists(exe)), None)
            if found_edge:
                try:
                    edge_args = launch_args + [f"--user-data-dir={_edge_profile_dir}"]
                    browser = await p.chromium.launch(executable_path=found_edge, headless=True, args=edge_args)
                    print(f"JK ERP: PDF engine launched via direct MS Edge at: {found_edge}")
                except Exception as e_edge:
                    print(f"JK ERP: Direct MS Edge EXE launch failed ({e_edge}). Trying MS Edge channel...")

            # Attempt 3: MS Edge Playwright channel
            if browser is None:
                try:
                    browser = await p.chromium.launch(channel="msedge", headless=True, args=launch_args)
                except Exception as e2:
                    print(f"JK ERP: MS Edge channel launch notice ({e2}). Trying Chrome channel...")

            # Attempt 4: System Google Chrome channel
            if browser is None:
                try:
                    browser = await p.chromium.launch(channel="chrome", headless=True, args=launch_args)
                except Exception as e3:
                    print(f"JK ERP: Chrome channel launch notice ({e3}). Trying direct Chrome EXE...")

            # Attempt 5: Direct Chrome executable path
            if browser is None:
                chrome_paths = [
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
                ]
                found_chrome = next((exe for exe in chrome_paths if exe and os.path.exists(exe)), None)
                if found_chrome:
                    chrome_args = launch_args + [f"--user-data-dir={_edge_profile_dir}"]
                    browser = await p.chromium.launch(executable_path=found_chrome, headless=True, args=chrome_args)
                    print(f"JK ERP: PDF engine launched via direct Chrome at: {found_chrome}")
                else:
                    raise e1

        try:
            page = await browser.new_page()
            vp_w = 1400 if landscape else 900
            vp_h = 900 if landscape else 1400
            await page.set_viewport_size({"width": vp_w, "height": vp_h})
            
            try:
                await page.set_content(html_content, wait_until="load", timeout=12000)
            except Exception:
                await page.set_content(html_content, wait_until="domcontentloaded", timeout=12000)

            pdf_bytes = await page.pdf(
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                scale=1.0,
                prefer_css_page_size=True,
                landscape=landscape
            )
            return pdf_bytes
        finally:
            if browser:
                await browser.close()


class ReportService:
    def __init__(self, db: AsyncSession, company_id: uuid.UUID = None, landscape: bool = False, search_query: Optional[str] = None):
        self.db = db
        self.company_id = company_id
        self.landscape = landscape
        self.search_query = search_query
        # Set up Jinja2 environment with PyInstaller sys._MEIPASS multi-path fallback
        base_dir = os.path.dirname(os.path.dirname(__file__))
        meipass_dir = getattr(sys, "_MEIPASS", "")
        template_dirs = [
            os.path.join(base_dir, "templates"),
            os.path.join(meipass_dir, "app", "templates") if meipass_dir else "",
            os.path.join(os.getcwd(), "app", "templates"),
        ]
        template_dirs = [d for d in template_dirs if d and os.path.exists(d)]
        self.jinja_env = Environment(loader=FileSystemLoader(template_dirs))
        self.jinja_env.filters["indian_format"] = self._indian_amount_format
    async def _generate_pdf(self, html_content: str, landscape: bool = False, search_query: Optional[str] = None) -> bytes:
        l_flag = landscape if landscape is not None else self.landscape
        s_query = search_query if search_query is not None else self.search_query
        
        # Calculate search matches in HTML
        self.match_counts = []
        if s_query:
            try:
                parser = InvoiceSearchParser(s_query)
                parser.feed(html_content)
                self.match_counts = parser.get_matches_per_page()
            except Exception as parse_err:
                print(f"Error parsing search matches: {parse_err}")

        try:
            return await _generate_pdf_async(html_content, landscape=l_flag, search_query=s_query)
        except Exception as async_err:
            print(f"JK ERP: Async Playwright failed ({async_err}). Trying Sync Playwright worker fallback...")
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                _render_pdf_sync(html_content, tmp_path, landscape=l_flag, search_query=s_query)
                with open(tmp_path, "rb") as f:
                    pdf_bytes = f.read()
                return pdf_bytes
            finally:
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass

    def _get_company_dict(self, company) -> dict:
        if not company:
            return {
                "name": "Company",
                "address": "",
                "contact": "",
                "email": "",
                "gst_number": "",
                "pan_number": "",
                "state": ""
            }
        addr_parts = [p for p in [company.office_address_1, company.office_address_2, company.city, company.state, company.pin_code] if p]
        address_str = ", ".join(addr_parts) if addr_parts else (company.office_address_1 or "")
        gst = company.gst_number or ""
        pan = company.pan_number or ""
        if not pan and len(gst) >= 12:
            pan = gst[2:12]

        return {
            "name": company.name or "Company",
            "address": address_str,
            "contact": company.phone or "",
            "email": company.email or "",
            "gst_number": gst,
            "pan_number": pan,
            "state": company.registered_state or company.state or ""
        }

    async def get_day_book(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
        """Fetch chronological transaction log for a company within a date range across all accounting modules."""
        from app.models import JournalEntry, JournalEntryLine, Company, Invoice, PurchaseBill, Payment, Customer, Supplier
        from sqlalchemy import select, and_
        from sqlalchemy.orm import selectinload
        from datetime import datetime, date

        # Fetch Company Info (for PDF rendering context)
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = self._get_company_dict(company)

        daybook = []

        # 1. Fetch Manual / System Journal Entries
        query = select(JournalEntry).where(JournalEntry.company_id == self.company_id)
        if start_date and end_date:
            query = query.where(JournalEntry.entry_date.between(start_date, end_date))
        query = query.options(
            selectinload(JournalEntry.lines).selectinload(JournalEntryLine.account)
        ).order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
        
        result = await self.db.execute(query)
        entries = result.scalars().all()

        for entry in entries:
            d_str = entry.entry_date.strftime("%Y-%m-%d") if isinstance(entry.entry_date, (date, datetime)) else str(entry.entry_date)
            daybook.append({
                "id": str(entry.id),
                "entry_number": entry.entry_number,
                "voucher_no": entry.entry_number,
                "entry_date": d_str,
                "date": d_str,
                "description": entry.description or "Journal Entry",
                "narration": entry.description or "Journal Entry",
                "reference_type": entry.reference_type or "Journal",
                "total_debit": float(entry.total_debit or 0.0),
                "total_credit": float(entry.total_credit or 0.0),
                "debit": float(entry.total_debit or 0.0),
                "credit": float(entry.total_credit or 0.0),
                "lines": [
                    {
                        "account_name": line.account.name if line.account else "Account",
                        "account_type": line.account.account_type if line.account else "GENERAL",
                        "debit": float(line.debit or 0.0),
                        "credit": float(line.credit or 0.0),
                        "description": line.description or ""
                    }
                    for line in entry.lines
                ]
            })

        # 2. Fetch Sales Invoices
        inv_query = select(Invoice).options(selectinload(Invoice.customer)).where(
            Invoice.company_id == self.company_id,
            Invoice.status != "CANCELLED"
        )
        if start_date and end_date:
            inv_query = inv_query.where(Invoice.invoice_date.between(start_date, end_date))
        inv_res = await self.db.execute(inv_query)
        invoices = inv_res.scalars().all()

        for inv in invoices:
            cust_name = inv.customer.name if inv.customer else "Customer"
            d_str = inv.invoice_date.strftime("%Y-%m-%d") if isinstance(inv.invoice_date, (date, datetime)) else str(inv.invoice_date)
            subt = float(inv.subtotal or inv.total or 0.0)
            tax_val = float(inv.tax_amount or 0.0)
            tot_val = float(inv.total or 0.0)

            lines = [
                {
                    "account_name": cust_name,
                    "account_type": "ASSET",
                    "debit": tot_val,
                    "credit": 0.0,
                    "description": f"Customer Receivable ({inv.invoice_number})"
                },
                {
                    "account_name": "Sales Account",
                    "account_type": "INCOME",
                    "debit": 0.0,
                    "credit": subt,
                    "description": "Sales Revenue"
                }
            ]
            if tax_val > 0:
                lines.append({
                    "account_name": "GST Output Tax",
                    "account_type": "LIABILITY",
                    "debit": 0.0,
                    "credit": tax_val,
                    "description": "Output GST"
                })

            daybook.append({
                "id": str(inv.id),
                "entry_number": inv.invoice_number,
                "voucher_no": inv.invoice_number,
                "entry_date": d_str,
                "date": d_str,
                "description": f"Sales Invoice to {cust_name}",
                "narration": f"Sales Invoice to {cust_name}",
                "reference_type": "Sales Invoice",
                "total_debit": tot_val,
                "total_credit": tot_val,
                "debit": tot_val,
                "credit": tot_val,
                "lines": lines
            })

        # 3. Fetch Purchase Bills
        bill_query = select(PurchaseBill).options(selectinload(PurchaseBill.supplier)).where(
            PurchaseBill.company_id == self.company_id,
            PurchaseBill.status != "CANCELLED"
        )
        if start_date and end_date:
            bill_query = bill_query.where(PurchaseBill.bill_date.between(start_date, end_date))
        bill_res = await self.db.execute(bill_query)
        bills = bill_res.scalars().all()

        for bill in bills:
            sup_name = bill.supplier.name if bill.supplier else "Supplier"
            d_str = bill.bill_date.strftime("%Y-%m-%d") if isinstance(bill.bill_date, (date, datetime)) else str(bill.bill_date)
            subt = float(bill.subtotal or bill.total or 0.0)
            tax_val = float(bill.tax_amount or 0.0)
            tot_val = float(bill.total or 0.0)

            lines = [
                {
                    "account_name": "Purchase Account",
                    "account_type": "EXPENSE",
                    "debit": subt,
                    "credit": 0.0,
                    "description": f"Purchase Expense ({bill.bill_number})"
                }
            ]
            if tax_val > 0:
                lines.append({
                    "account_name": "GST Input Tax Credit",
                    "account_type": "ASSET",
                    "debit": tax_val,
                    "credit": 0.0,
                    "description": "Input GST"
                })
            lines.append({
                "account_name": sup_name,
                "account_type": "LIABILITY",
                "debit": 0.0,
                "credit": tot_val,
                "description": "Supplier Payable"
            })

            daybook.append({
                "id": str(bill.id),
                "entry_number": bill.bill_number,
                "voucher_no": bill.bill_number,
                "entry_date": d_str,
                "date": d_str,
                "description": f"Purchase Bill from {sup_name}",
                "narration": f"Purchase Bill from {sup_name}",
                "reference_type": "Purchase Bill",
                "total_debit": tot_val,
                "total_credit": tot_val,
                "debit": tot_val,
                "credit": tot_val,
                "lines": lines
            })

        # 4. Fetch Payments / Receipts
        pay_query = select(Payment).where(Payment.company_id == self.company_id)
        if start_date and end_date:
            pay_query = pay_query.where(Payment.payment_date.between(datetime.combine(start_date, datetime.min.time()), datetime.combine(end_date, datetime.max.time())))
        pay_res = await self.db.execute(pay_query)
        payments = pay_res.scalars().all()

        for pay in payments:
            d_obj = pay.payment_date.date() if isinstance(pay.payment_date, datetime) else pay.payment_date
            d_str = d_obj.strftime("%Y-%m-%d") if isinstance(d_obj, (date, datetime)) else str(d_obj)
            amt = float(pay.amount or 0.0)
            v_no = pay.reference_number or f"PAY-{str(pay.id)[:8]}"
            is_rcpt = pay.payment_type.upper() == "RECEIPT"

            lines = [
                {
                    "account_name": f"Bank / Cash ({pay.payment_method})",
                    "account_type": "BANK",
                    "debit": amt if is_rcpt else 0.0,
                    "credit": 0.0 if is_rcpt else amt,
                    "description": pay.notes or "Cash/Bank Account"
                },
                {
                    "account_name": "Party Account",
                    "account_type": "PARTY",
                    "debit": 0.0 if is_rcpt else amt,
                    "credit": amt if is_rcpt else 0.0,
                    "description": pay.reference_type or "Party Settlement"
                }
            ]

            daybook.append({
                "id": str(pay.id),
                "entry_number": v_no,
                "voucher_no": v_no,
                "entry_date": d_str,
                "date": d_str,
                "description": pay.notes or f"Payment ({pay.payment_type}) via {pay.payment_method}",
                "narration": pay.notes or f"Payment ({pay.payment_type}) via {pay.payment_method}",
                "reference_type": f"Payment ({pay.payment_type})",
                "total_debit": amt,
                "total_credit": amt,
                "debit": amt,
                "credit": amt,
                "lines": lines
            })

        # Sort chronologically by entry_date descending
        daybook.sort(key=lambda x: x["entry_date"], reverse=True)

        return {
            "companyInfo": comp_info,
            "period": {"startDate": str(start_date) if start_date else "", "endDate": str(end_date) if end_date else ""},
            "entries": daybook
        }

    async def generate_day_book_pdf(self, start_date: date, end_date: date) -> bytes:
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        
        data = await self.get_day_book(start_date, end_date)
        
        template = self.jinja_env.get_template("day_book.html")
        html_out = template.render(
            db_data_json=json.dumps(jsonable_encoder(data)),
            landscape=self.landscape
        )
        
        try:
            # pyrefly: ignore [missing-import]
            import anyio
            pdf_bytes = await self._generate_pdf(html_out)
            return pdf_bytes
        except Exception as e:
            # pyrefly: ignore [missing-import]
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(e)}")

    async def generate_day_book_excel(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional Tally-style Day Book chronological journal in Excel."""
        data = await self.get_day_book(start_date, end_date)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, data["companyInfo"], "DAY BOOK: TRANSACTION JOURNAL", {"start": start_date.strftime("%Y-%m-%d"), "end": end_date.strftime("%Y-%m-%d")})
            sheet = writer.book.add_worksheet('Day Book')
            
            ex.write_standard_header(sheet, "Chronological List of Ledger and Journal Transactions", len(data["entries"]), 5)
            
            headers = ["Date", "Voucher No.", "Particulars/Accounts", "Voucher Type", "Debit (DR)", "Credit (CR)"]
            for col, text in enumerate(headers):
                sheet.write(8, col, text, ex.fmt_table_header)
                
            row = 9
            total_dr = 0.0
            total_cr = 0.0
            
            for entry in data["entries"]:
                # Primary row with voucher details
                sheet.write(row, 0, entry["date"], ex.fmt_date)
                sheet.write(row, 1, entry["voucher_no"], ex.fmt_bold_border)
                sheet.write(row, 2, entry["narration"] or "Journal Entry", ex.fmt_bold_border)
                sheet.write(row, 3, "Journal", ex.fmt_border)
                
                # Write individual credit/debit lines
                for line in entry["lines"]:
                    row += 1
                    sheet.write(row, 2, f"  To {line['account_name']}" if line['credit'] > 0 else f"  {line['account_name']}", ex.fmt_border)
                    dr_val = ex.safe_float(line["debit"])
                    cr_val = ex.safe_float(line["credit"])
                    sheet.write(row, 4, dr_val if dr_val > 0 else "-", ex.fmt_money)
                    sheet.write(row, 5, cr_val if cr_val > 0 else "-", ex.fmt_money)
                    total_dr += dr_val
                    total_cr += cr_val
                row += 1
            
            # Totals
            sheet.write(row, 2, "TOTAL VOUCHER SUMMARY RS.:", ex.fmt_total_label)
            sheet.write(row, 4, total_dr, ex.fmt_money_bold)
            sheet.write(row, 5, total_cr, ex.fmt_money_bold)
            
            ex.set_column_widths(sheet, [12, 15, 35, 12, 18, 18])
            
        return output.getvalue()

    async def get_profit_loss(self, start_date: date, end_date: date) -> dict:
        """Calculate Profit & Loss statement for a period."""
        from app.models import Account, JournalEntryLine, JournalEntry, StockEntry, Product, Company
        # pyrefly: ignore [missing-import]
        from sqlalchemy import func
        import traceback

        # Fetch Company Info
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "address": company.office_address_1 if company else "",
            "contact": company.phone if company else "",
            "email": company.email if company else "",
            "gst_number": company.gst_number if company and company.gst_number else ""
        }
        
        # 1. Opening & Closing Stock calculations
        # Opening: all stock movement before start_date
        os_stmt = select(
            Product.category_id,
            func.sum(StockEntry.quantity * Product.purchase_price)
        ).select_from(StockEntry).join(Product).where(
            StockEntry.company_id == self.company_id,
            StockEntry.created_at < start_date
        ).group_by(Product.category_id)
        
        os_res = await self.db.execute(os_stmt)
        opening_stock_items = []
        os_total = Decimal("0.00")
        for category_id, val in os_res.fetchall():
            if val and val > 0:
                amount = Decimal(str(val))
                opening_stock_items.append({"name": "Category Stock", "amount": amount})
                os_total += amount
                
        if not opening_stock_items:
            # simple fallback sum if categories are messy
            os_stmt_fallback = select(func.sum(StockEntry.quantity * Product.purchase_price)).select_from(StockEntry).join(Product).where(
                StockEntry.company_id == self.company_id, StockEntry.created_at < start_date
            )
            fallback_val = (await self.db.execute(os_stmt_fallback)).scalar()
            if fallback_val and fallback_val > 0:
                v = Decimal(str(fallback_val))
                opening_stock_items.append({"name": "Inventory Stock", "amount": v})
                os_total = v
                
        # Closing: all stock movement up to end_date
        cs_stmt = select(
            func.sum(StockEntry.quantity * Product.purchase_price)
        ).select_from(StockEntry).join(Product).where(
            StockEntry.company_id == self.company_id,
            StockEntry.created_at <= end_date
        )
        cs_res = await self.db.execute(cs_stmt)
        cs_val = cs_res.scalar()
        closing_stock_items = []
        cs_total = Decimal("0.00")
        if cs_val and cs_val > 0:
            cs_total = Decimal(str(cs_val))
            closing_stock_items.append({"name": "Closing Stock", "amount": cs_total})

        # 2. Financial Accounts
        stmt = select(Account).where(
            Account.company_id == self.company_id,
            Account.account_type.in_(["INCOME", "EXPENSE"])
        )
        res = await self.db.execute(stmt)
        accounts = res.scalars().all()

        lines_stmt = select(
            JournalEntryLine.account_id,
            func.sum(JournalEntryLine.debit).label("total_debit"),
            func.sum(JournalEntryLine.credit).label("total_credit")
        ).join(JournalEntry).where(
            JournalEntry.company_id == self.company_id,
            JournalEntry.entry_date.between(start_date, end_date),
            JournalEntry.is_posted == True
        ).group_by(JournalEntryLine.account_id)
        
        lines_res = await self.db.execute(lines_stmt)
        lines_data = {row.account_id: (row.total_debit, row.total_credit) for row in lines_res.all()}

        purchases = []
        purchases_tot = Decimal("0.00")
        sales = []
        sales_tot = Decimal("0.00")
        direct_exp = []
        direct_exp_tot = Decimal("0.00")
        indirect_exp = []
        indirect_exp_tot = Decimal("0.00")
        direct_inc = []
        direct_inc_tot = Decimal("0.00")
        indirect_inc = []
        indirect_inc_tot = Decimal("0.00")

        # Heuristic rules to classify accounts if robust subtypes aren't fully filled
        for acc in accounts:
            debit, credit = lines_data.get(acc.id, (Decimal("0.00"), Decimal("0.00")))
            subtype = (acc.account_subtype or "").upper()
            name_up = acc.name.upper()
            
            if acc.account_type == "INCOME":
                amount = credit - debit
                if amount != 0:
                    item = {"name": acc.name, "amount": abs(amount)}
                    if "SALE" in name_up or subtype == "SALES":
                        if amount > 0: sales.append(item); sales_tot += amount
                        else: sales.append(item); sales_tot -= abs(amount) # sales return?
                    elif "DIRECT" in subtype or "DIRECT" in name_up:
                        if amount > 0: direct_inc.append(item); direct_inc_tot += amount
                    else:
                        if amount > 0: indirect_inc.append(item); indirect_inc_tot += amount
            else:
                amount = debit - credit
                if amount != 0:
                    item = {"name": acc.name, "amount": abs(amount)}
                    if "PURCHASE" in name_up or subtype == "PURCHASES":
                        if amount > 0: purchases.append(item); purchases_tot += amount
                        else: purchases.append(item); purchases_tot -= abs(amount)
                    elif "DIRECT" in subtype or "WAGE" in name_up or "FREIGHT" in name_up or "FACTORY" in name_up or "CARRIAGE" in name_up:
                        if amount > 0: direct_exp.append(item); direct_exp_tot += amount
                    else:
                        if amount > 0: indirect_exp.append(item); indirect_exp_tot += amount

        # Fallback if Sales/Purchases are empty, extract from Invoices and PurchaseBills
        if sales_tot == 0:
            from app.models import Invoice, PurchaseBill
            inv_res = await self.db.execute(select(func.sum(Invoice.subtotal - Invoice.discount_amount)).where(Invoice.company_id == self.company_id, Invoice.invoice_date.between(start_date, end_date), Invoice.status != 'CANCELLED'))
            inv_v = inv_res.scalar()
            if inv_v: 
                v = Decimal(str(inv_v))
                sales_tot += v
                sales.append({"name": "Sales Account (Computed)", "amount": v})
        
        if purchases_tot == 0:
            from app.models import PurchaseBill
            pb_res = await self.db.execute(select(func.sum(PurchaseBill.subtotal - PurchaseBill.discount_amount)).where(PurchaseBill.company_id == self.company_id, PurchaseBill.bill_date.between(start_date, end_date), PurchaseBill.status != 'CANCELLED'))
            pb_v = pb_res.scalar()
            if pb_v: 
                v = Decimal(str(pb_v))
                purchases_tot += v
                purchases.append({"name": "Purchase Account (Computed)", "amount": v})

        # Calculations
        trading_debit_sum = os_total + purchases_tot + direct_exp_tot
        trading_credit_sum = cs_total + sales_tot + direct_inc_tot
        
        gross_profit = Decimal("0.00")
        gross_loss = Decimal("0.00")
        
        if trading_credit_sum > trading_debit_sum:
            gross_profit = trading_credit_sum - trading_debit_sum
        else:
            gross_loss = trading_debit_sum - trading_credit_sum
            
        trading_total = max(trading_debit_sum, trading_credit_sum)

        pl_debit_sum = indirect_exp_tot + gross_loss
        pl_credit_sum = indirect_inc_tot + gross_profit
        
        net_profit = Decimal("0.00")
        net_loss = Decimal("0.00")
        
        if pl_credit_sum > pl_debit_sum:
            net_profit = pl_credit_sum - pl_debit_sum
        else:
            net_loss = pl_debit_sum - pl_credit_sum
            
        pl_total = max(pl_debit_sum, pl_credit_sum)

        return {
            "success": True,
            "data": {
                "companyInfo": comp_info,
                "period": {"startDate": str(start_date), "endDate": str(end_date)},
                "tradingAccount": {
                    "debitSide": {
                        "openingStock": {"items": opening_stock_items, "total": os_total},
                        "purchases": {"items": purchases, "total": purchases_tot},
                        "directExpenses": {"items": direct_exp, "total": direct_exp_tot},
                        "grossProfit": gross_profit,
                        "total": trading_total
                    },
                    "creditSide": {
                        "closingStock": {"items": closing_stock_items, "total": cs_total},
                        "sales": {"items": sales, "total": sales_tot},
                        "grossLoss": gross_loss,
                        "total": trading_total
                    }
                },
                "profitLossAccount": {
                    "debitSide": {
                        "grossLoss": gross_loss,
                        "indirectExpenses": {"items": indirect_exp, "total": indirect_exp_tot},
                        "netProfit": net_profit,
                        "total": pl_total
                    },
                    "creditSide": {
                        "grossProfit": gross_profit,
                        "indirectIncomes": {"items": indirect_inc, "total": indirect_inc_tot},
                        "netLoss": net_loss,
                        "total": pl_total
                    }
                }
            }
        }
    
    async def generate_profit_loss_pdf(self, start_date: date, end_date: date) -> bytes:
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        data = await self.get_profit_loss(start_date, end_date)
        import json
        
        template = self.jinja_env.get_template("profit_loss.html")
        html_out = template.render(
            pl_data_json=json.dumps(jsonable_encoder(data["data"]))
        )
        
        try:
            # pyrefly: ignore [missing-import]
            import anyio
            pdf_bytes = await self._generate_pdf(html_out)
            return pdf_bytes
        except Exception as e:
            # pyrefly: ignore [missing-import]
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(e)}")

    async def generate_profit_loss_excel(self, start_date: date, end_date: date) -> bytes:
        import pandas as pd
        import io
        from app.models import Company
        
        comp_stmt = select(Company).where(Company.id == self.company_id)
        comp_result = await self.db.execute(comp_stmt)
        company = comp_result.scalar_one_or_none()
        
        comp_info = {
            "name": company.name if company else "Company",
            "address": company.office_address_1 if company else "",
            "gst_number": company.gst_number if company and company.gst_number else "Not Registered"
        }
        
        pl_resp = await self.get_profit_loss(start_date, end_date)
        pl_data = pl_resp["data"]
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, comp_info, "PROFIT & LOSS ACCOUNT", {"start": start_date.strftime('%Y-%m-%d'), "end": end_date.strftime('%Y-%m-%d')})
            sheet = writer.book.add_worksheet('Profit & Loss')
            
            ex.fmt_money_bold = writer.book.add_format({'border': 1, 'bold': True, 'num_format': '#,##0.00', 'font_size': 9, 'align': 'right'})
            
            ex.write_standard_header(sheet, f"FOR THE PERIOD {start_date.strftime('%d-%m-%Y')} TO {end_date.strftime('%d-%m-%Y')}", None, 4)
            
            # --- TRADING ACCOUNT ---
            sheet.merge_range('A9:D9', 'TRADING ACCOUNT', ex.fmt_section_bg)
            headers = ["Particulars (Dr)", "Amount (Rs)", "Particulars (Cr)", "Amount (Rs)"]
            for col, text in enumerate(headers):
                sheet.write(9, col, text, ex.fmt_table_header)
                
            row = 10
            trading_debit = pl_data["tradingAccount"]["debitSide"]
            trading_credit = pl_data["tradingAccount"]["creditSide"]
            
            d_row = row
            if trading_debit["openingStock"]["total"] > 0 or len(trading_debit["openingStock"]["items"]) > 0:
                sheet.write(d_row, 0, "Opening Stock", ex.fmt_bold_border)
                sheet.write(d_row, 1, ex.safe_float(trading_debit["openingStock"]["total"]), ex.fmt_money_bold)
                d_row += 1
                for item in trading_debit["openingStock"]["items"]:
                    sheet.write(d_row, 0, "  " + item["name"], ex.fmt_border)
                    sheet.write(d_row, 1, ex.safe_float(item["amount"]), ex.fmt_money)
                    d_row += 1
            if trading_debit["purchases"]["total"] > 0 or len(trading_debit["purchases"]["items"]) > 0:
                sheet.write(d_row, 0, "Purchases", ex.fmt_bold_border)
                sheet.write(d_row, 1, ex.safe_float(trading_debit["purchases"]["total"]), ex.fmt_money_bold)
                d_row += 1
                for item in trading_debit["purchases"]["items"]:
                    sheet.write(d_row, 0, "  " + item["name"], ex.fmt_border)
                    sheet.write(d_row, 1, ex.safe_float(item["amount"]), ex.fmt_money)
                    d_row += 1
            if trading_debit["directExpenses"]["total"] > 0 or len(trading_debit["directExpenses"]["items"]) > 0:
                sheet.write(d_row, 0, "Direct Expenses", ex.fmt_bold_border)
                sheet.write(d_row, 1, ex.safe_float(trading_debit["directExpenses"]["total"]), ex.fmt_money_bold)
                d_row += 1
                for item in trading_debit["directExpenses"]["items"]:
                    sheet.write(d_row, 0, "  " + item["name"], ex.fmt_border)
                    sheet.write(d_row, 1, ex.safe_float(item["amount"]), ex.fmt_money)
                    d_row += 1
            if trading_debit["grossProfit"] > 0:
                sheet.write(d_row, 0, "Gross Profit c/o", ex.fmt_bold_border)
                sheet.write(d_row, 1, ex.safe_float(trading_debit["grossProfit"]), ex.fmt_money_bold)
                d_row += 1
                
            c_row = row
            if trading_credit["sales"]["total"] > 0 or len(trading_credit["sales"]["items"]) > 0:
                sheet.write(c_row, 2, "Sales", ex.fmt_bold_border)
                sheet.write(c_row, 3, ex.safe_float(trading_credit["sales"]["total"]), ex.fmt_money_bold)
                c_row += 1
                for item in trading_credit["sales"]["items"]:
                    sheet.write(c_row, 2, "  " + item["name"], ex.fmt_border)
                    sheet.write(c_row, 3, ex.safe_float(item["amount"]), ex.fmt_money)
                    c_row += 1
            if trading_credit["closingStock"]["total"] > 0 or len(trading_credit["closingStock"]["items"]) > 0:
                sheet.write(c_row, 2, "Closing Stock", ex.fmt_bold_border)
                sheet.write(c_row, 3, ex.safe_float(trading_credit["closingStock"]["total"]), ex.fmt_money_bold)
                c_row += 1
                for item in trading_credit["closingStock"]["items"]:
                    sheet.write(c_row, 2, "  " + item["name"], ex.fmt_border)
                    sheet.write(c_row, 3, ex.safe_float(item["amount"]), ex.fmt_money)
                    c_row += 1
            if trading_credit["grossLoss"] > 0:
                sheet.write(c_row, 2, "Gross Loss c/o", ex.fmt_bold_border)
                sheet.write(c_row, 3, ex.safe_float(trading_credit["grossLoss"]), ex.fmt_money_bold)
                c_row += 1
                
            max_row = max(d_row, c_row)
            for r in range(row, max_row):
                if r >= d_row:
                    sheet.write(r, 0, "", ex.fmt_border)
                    sheet.write(r, 1, "", ex.fmt_border)
                if r >= c_row:
                    sheet.write(r, 2, "", ex.fmt_border)
                    sheet.write(r, 3, "", ex.fmt_border)
                    
            sheet.write(max_row, 0, "Total", ex.fmt_total_label)
            sheet.write(max_row, 1, ex.safe_float(trading_debit["total"]), ex.fmt_money_bold)
            sheet.write(max_row, 2, "Total", ex.fmt_total_label)
            sheet.write(max_row, 3, ex.safe_float(trading_credit["total"]), ex.fmt_money_bold)
            
            row = max_row + 2
            
            # --- PROFIT & LOSS ACCOUNT ---
            sheet.merge_range(f'A{row+1}:D{row+1}', 'PROFIT & LOSS ACCOUNT', ex.fmt_section_bg)
            for col, text in enumerate(headers):
                sheet.write(row+1, col, text, ex.fmt_table_header)
                
            row += 2
            pl_debit = pl_data["profitLossAccount"]["debitSide"]
            pl_credit = pl_data["profitLossAccount"]["creditSide"]
            
            d_row = row
            if pl_debit["grossLoss"] > 0:
                sheet.write(d_row, 0, "Gross Loss b/f", ex.fmt_bold_border)
                sheet.write(d_row, 1, ex.safe_float(pl_debit["grossLoss"]), ex.fmt_money_bold)
                d_row += 1
            if pl_debit["indirectExpenses"]["total"] > 0 or len(pl_debit["indirectExpenses"]["items"]) > 0:
                sheet.write(d_row, 0, "Indirect Expenses", ex.fmt_bold_border)
                sheet.write(d_row, 1, ex.safe_float(pl_debit["indirectExpenses"]["total"]), ex.fmt_money_bold)
                d_row += 1
                for item in pl_debit["indirectExpenses"]["items"]:
                    sheet.write(d_row, 0, "  " + item["name"], ex.fmt_border)
                    sheet.write(d_row, 1, ex.safe_float(item["amount"]), ex.fmt_money)
                    d_row += 1
            if pl_debit["netProfit"] > 0:
                sheet.write(d_row, 0, "Net Profit", ex.fmt_bold_border)
                sheet.write(d_row, 1, ex.safe_float(pl_debit["netProfit"]), ex.fmt_money_bold)
                d_row += 1
                
            c_row = row
            if pl_credit["grossProfit"] > 0:
                sheet.write(c_row, 2, "Gross Profit b/f", ex.fmt_bold_border)
                sheet.write(c_row, 3, ex.safe_float(pl_credit["grossProfit"]), ex.fmt_money_bold)
                c_row += 1
            if pl_credit["indirectIncomes"]["total"] > 0 or len(pl_credit["indirectIncomes"]["items"]) > 0:
                sheet.write(c_row, 2, "Indirect Incomes", ex.fmt_bold_border)
                sheet.write(c_row, 3, ex.safe_float(pl_credit["indirectIncomes"]["total"]), ex.fmt_money_bold)
                c_row += 1
                for item in pl_credit["indirectIncomes"]["items"]:
                    sheet.write(c_row, 2, "  " + item["name"], ex.fmt_border)
                    sheet.write(c_row, 3, ex.safe_float(item["amount"]), ex.fmt_money)
                    c_row += 1
            if pl_credit["netLoss"] > 0:
                sheet.write(c_row, 2, "Net Loss", ex.fmt_bold_border)
                sheet.write(c_row, 3, ex.safe_float(pl_credit["netLoss"]), ex.fmt_money_bold)
                c_row += 1
                
            max_row = max(d_row, c_row)
            for r in range(row, max_row):
                if r >= d_row:
                    sheet.write(r, 0, "", ex.fmt_border)
                    sheet.write(r, 1, "", ex.fmt_border)
                if r >= c_row:
                    sheet.write(r, 2, "", ex.fmt_border)
                    sheet.write(r, 3, "", ex.fmt_border)
                    
            sheet.write(max_row, 0, "Total", ex.fmt_total_label)
            sheet.write(max_row, 1, ex.safe_float(pl_debit["total"]), ex.fmt_money_bold)
            sheet.write(max_row, 2, "Total", ex.fmt_total_label)
            sheet.write(max_row, 3, ex.safe_float(pl_credit["total"]), ex.fmt_money_bold)
            
            ex.set_column_widths(sheet, [40, 20, 40, 20])
            
        return output.getvalue()

    async def get_balance_sheet(self, as_of: date) -> dict:
        """Calculate Balance Sheet as of a specific date."""
        from app.models import Account, JournalEntryLine, JournalEntry
        # pyrefly: ignore [missing-import]
        from sqlalchemy import func

        # 1. Fetch all Balance Sheet accounts
        stmt = select(Account).where(
            Account.company_id == self.company_id,
            Account.account_type.in_(["ASSET", "LIABILITY", "EQUITY"])
        )
        res = await self.db.execute(stmt)
        accounts = res.scalars().all()

        # 2. Get balances as of date
        lines_stmt = select(
            JournalEntryLine.account_id,
            func.sum(JournalEntryLine.debit).label("total_debit"),
            func.sum(JournalEntryLine.credit).label("total_credit")
        ).join(JournalEntry).where(
            JournalEntry.company_id == self.company_id,
            JournalEntry.entry_date <= as_of
        ).group_by(JournalEntryLine.account_id)
        
        lines_res = await self.db.execute(lines_stmt)
        lines_data = {row.account_id: (row.total_debit, row.total_credit) for row in lines_res.all()}

        assets = []
        liabilities = []
        equity = []
        total_assets = Decimal("0.00")
        total_liabilities = Decimal("0.00")
        total_equity = Decimal("0.00")

        for acc in accounts:
            debit, credit = lines_data.get(acc.id, (Decimal("0.00"), Decimal("0.00")))
            if acc.account_type == "ASSET":
                amount = acc.opening_balance + debit - credit
                assets.append({"account_name": acc.name, "amount": amount, "subtype": acc.account_subtype})
                total_assets += amount
            elif acc.account_type == "LIABILITY":
                amount = acc.opening_balance + credit - debit
                liabilities.append({"account_name": acc.name, "amount": amount, "subtype": acc.account_subtype})
                total_liabilities += amount
            else:
                amount = acc.opening_balance + credit - debit
                equity.append({"account_name": acc.name, "amount": amount, "subtype": acc.account_subtype})
                total_equity += amount

        # Include net profit in equity (retained earnings logic simplified)
        pl_resp = await self.get_profit_loss(date(as_of.year, 4, 1), as_of) # assuming fiscal year starts April 1st
        net_profit = pl_resp["data"]["profitLossAccount"]["debitSide"]["netProfit"] - pl_resp["data"]["profitLossAccount"]["creditSide"]["netLoss"]
        total_equity += net_profit

        return {
            "as_of": as_of,
            "assets": assets,
            "total_assets": total_assets,
            "liabilities": liabilities,
            "total_liabilities": total_liabilities,
            "equity": equity,
            "net_profit_accumulated": net_profit,
            "total_equity": total_equity,
            "is_balanced": total_assets == (total_liabilities + total_equity)
        }

    async def generate_balance_sheet_excel(self, start_date: date, end_date: date) -> bytes:
        from app.models import Company
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select
        import pandas as pd
        import io
        
        comp_stmt = select(Company).where(Company.id == self.company_id)
        comp_result = await self.db.execute(comp_stmt)
        company = comp_result.scalar_one_or_none()
        
        comp_info = {
            "name": company.name if company else "Company",
            "address": company.office_address_1 if company else "",
            "gst_number": company.gst_number if company and company.gst_number else "Not Registered"
        }
        
        bs_data = await self.get_balance_sheet(end_date)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, comp_info, "BALANCE SHEET", {"start": start_date.strftime('%Y-%m-%d'), "end": end_date.strftime('%Y-%m-%d')})
            sheet = writer.book.add_worksheet('Balance Sheet')
            
            ex.fmt_money_bold = writer.book.add_format({'border': 1, 'bold': True, 'num_format': '#,##0.00', 'font_size': 9, 'align': 'right'})
            
            ex.write_standard_header(sheet, f"FINANCIAL POSITION AS OF {end_date.strftime('%d-%m-%Y')}", None, 4)
            
            headers = ["Liabilities & Equity", "Amount (Rs)", "Assets", "Amount (Rs)"]
            for col, text in enumerate(headers):
                sheet.write(8, col, text, ex.fmt_table_header)
                
            row = 9
            max_row = row
            
            # Write Liabilities
            l_row = row
            for liab in bs_data["liabilities"]:
                sheet.write(l_row, 0, liab["account_name"], ex.fmt_border)
                sheet.write(l_row, 1, ex.safe_float(liab["amount"]), ex.fmt_money)
                l_row += 1
                
            for eq in bs_data["equity"]:
                sheet.write(l_row, 0, eq["account_name"], ex.fmt_border)
                sheet.write(l_row, 1, ex.safe_float(eq["amount"]), ex.fmt_money)
                l_row += 1
                
            if bs_data["net_profit_accumulated"] != 0:
                sheet.write(l_row, 0, "Retained Earnings (P&L)", ex.fmt_border)
                sheet.write(l_row, 1, ex.safe_float(bs_data["net_profit_accumulated"]), ex.fmt_money)
                l_row += 1
                
            # Write Assets
            a_row = row
            for ast in bs_data["assets"]:
                sheet.write(a_row, 2, ast["account_name"], ex.fmt_border)
                sheet.write(a_row, 3, ex.safe_float(ast["amount"]), ex.fmt_money)
                a_row += 1
                
            max_row = max(l_row, a_row)
            
            # Fill empty cells with borders
            for r in range(row, max_row):
                if r >= l_row:
                    sheet.write(r, 0, "", ex.fmt_border)
                    sheet.write(r, 1, "", ex.fmt_border)
                if r >= a_row:
                    sheet.write(r, 2, "", ex.fmt_border)
                    sheet.write(r, 3, "", ex.fmt_border)
                    
            sheet.write(max_row, 0, "Total Liabilities & Equity", ex.fmt_total_label)
            sheet.write(max_row, 1, ex.safe_float(bs_data["total_liabilities"] + bs_data["total_equity"]), ex.fmt_money_bold)
            sheet.write(max_row, 2, "Total Assets", ex.fmt_total_label)
            sheet.write(max_row, 3, ex.safe_float(bs_data["total_assets"]), ex.fmt_money_bold)
            
            ex.set_column_widths(sheet, [40, 20, 40, 20])
            
        return output.getvalue()

    async def generate_balance_sheet_pdf(self, start_date: date, end_date: date) -> bytes:
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        from app.models import Company
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select
        import json
        
        comp_stmt = select(Company).where(Company.id == self.company_id)
        comp_result = await self.db.execute(comp_stmt)
        company = comp_result.scalar_one_or_none()
        
        comp_info = {
            "name": company.name if company else "Company",
            "address": company.office_address_1 if company else "",
            "contact": company.phone if company else "",
            "email": company.email if company else "",
            "gst_number": company.gst_number if company and company.gst_number else "Not Registered"
        }
        
        # Balance Sheet is typically 'As of end_date'
        bs_data = await self.get_balance_sheet(end_date)
        
        # Group Liabilities (Sources of Funds)
        capital_account = {"items": [], "total": Decimal("0.00")}
        loans_liability = {"items": [], "total": Decimal("0.00")}
        current_liabilities = {"items": [], "total": Decimal("0.00")}
        profit_loss_ac = {"items": [], "total": Decimal("0.00")}
        
        for e in bs_data["equity"]:
            capital_account["items"].append({"name": e["account_name"], "amount": e["amount"]})
            capital_account["total"] += e["amount"]
        
        # Net Profit directly into P&L A/c instead of Capital
        if bs_data["net_profit_accumulated"] != 0:
            profit_loss_ac["items"].append({"name": "Current Period", "amount": bs_data["net_profit_accumulated"]})
            profit_loss_ac["total"] += bs_data["net_profit_accumulated"]
        
        for l in bs_data["liabilities"]:
            name_lower = l["account_name"].lower()
            if "loan" in name_lower or "borrow" in name_lower:
                loans_liability["items"].append({"name": l["account_name"], "amount": l["amount"]})
                loans_liability["total"] += l["amount"]
            else:
                current_liabilities["items"].append({"name": l["account_name"], "amount": l["amount"]})
                current_liabilities["total"] += l["amount"]
                
        # Group Assets (Application of Funds)
        fixed_assets = {"items": [], "total": Decimal("0.00")}
        current_assets = {"items": [], "total": Decimal("0.00")}
        
        for a in bs_data["assets"]:
            name_lower = a["account_name"].lower()
            subtype = (a.get("subtype") or "").lower()
            if "fixed" in subtype or "building" in name_lower or "machinery" in name_lower or "computer" in name_lower or "furniture" in name_lower:
                fixed_assets["items"].append({"name": a["account_name"], "amount": a["amount"]})
                fixed_assets["total"] += a["amount"]
            else:
                current_assets["items"].append({"name": a["account_name"], "amount": a["amount"]})
                current_assets["total"] += a["amount"]

        pl_payload = {
            "companyInfo": comp_info,
            "period": {"startDate": str(start_date), "endDate": str(end_date)},
            "sourcesOfFunds": {
                "capitalAccount": capital_account,
                "loansLiability": loans_liability,
                "currentLiabilities": current_liabilities,
                "profitLossAc": profit_loss_ac,
                "total": capital_account["total"] + loans_liability["total"] + current_liabilities["total"] + profit_loss_ac["total"]
            },
            "applicationOfFunds": {
                "fixedAssets": fixed_assets,
                "currentAssets": current_assets,
                "total": fixed_assets["total"] + current_assets["total"]
            }
        }

        template = self.jinja_env.get_template("balance_sheet.html")
        html_out = template.render(
            bs_data_json=json.dumps(jsonable_encoder(pl_payload))
        )
        
        try:
            # pyrefly: ignore [missing-import]
            import anyio
            pdf_bytes = await self._generate_pdf(html_out)
            return pdf_bytes
        except Exception as e:
            # pyrefly: ignore [missing-import]
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(e)}")

    async def get_cash_flow(self, start_date: date, end_date: date) -> dict:
        """Calculate Cash Flow Statement using Indirect Method."""
        from app.models import Account, JournalEntryLine, JournalEntry
        # pyrefly: ignore [missing-import]
        from sqlalchemy import func, select
        
        # 1. Get Net Profit for the period
        pl_resp = await self.get_profit_loss(start_date, end_date)
        net_profit = pl_resp["data"]["profitLossAccount"]["debitSide"]["netProfit"] - pl_resp["data"]["profitLossAccount"]["creditSide"]["netLoss"]
        
        # 2. Get balances at start and end for all BS accounts
        async def get_balances(as_of: date):
            lines_stmt = select(
                JournalEntryLine.account_id,
                func.sum(JournalEntryLine.debit).label("total_debit"),
                func.sum(JournalEntryLine.credit).label("total_credit")
            ).join(JournalEntry).where(
                JournalEntry.company_id == self.company_id,
                JournalEntry.entry_date <= as_of
            ).group_by(JournalEntryLine.account_id)
            
            res = await self.db.execute(lines_stmt)
            return {row.account_id: (row.total_debit, row.total_credit) for row in res.all()}

        # Opening balance should be strictly before start_date
        # Correction: Cash flow for period usually compares end of current period with end of previous period.
        # So we compare balances at end_date vs start_date - 1 day.
        from datetime import timedelta
        start_balances = await get_balances(start_date - timedelta(days=1))
        end_balances = await get_balances(end_date)
        
        acc_stmt = select(Account).where(Account.company_id == self.company_id)
        acc_res = await self.db.execute(acc_stmt)
        accounts = acc_res.scalars().all()
        
        def calc_bal(acc, balances_dict):
            dr, cr = balances_dict.get(acc.id, (Decimal("0"), Decimal("0")))
            if acc.account_type == "ASSET": return acc.opening_balance + dr - cr
            else: return acc.opening_balance + cr - dr

        # Operating Activities
        adjustments = [] # e.g. Depreciation
        depreciation_total = Decimal("0")
        finance_costs = Decimal("0")
        interest_received = Decimal("0")
        
        # We can look for specific accounts by name/subtype for adjustments
        # (Simplified: looking for 'Depreciation' in account names for now)
        for acc in accounts:
            if acc.account_type == "EXPENSE" and "depreciation" in acc.name.lower():
                # For expenses, we look at the period throughput
                # This is tricky for indirect method. Usually depreciation is an expense account.
                # We fetch total debit for this period for depreciation.
                stmt = select(func.sum(JournalEntryLine.debit)).join(JournalEntry).where(
                    JournalEntry.company_id == self.company_id,
                    JournalEntryLine.account_id == acc.id,
                    JournalEntry.entry_date.between(start_date, end_date)
                )
                r = await self.db.execute(stmt)
                val = r.scalar() or Decimal("0")
                if val != 0:
                    adjustments.append({"name": acc.name, "amount": val})
                    depreciation_total += val

        # Working Capital Changes (Delta = End - Start)
        wc_changes = {
            "inventory": Decimal("0"),
            "receivables": Decimal("0"),
            "advances": Decimal("0"),
            "other_assets": Decimal("0"),
            "payables": Decimal("0"),
            "borrowings_short": Decimal("0"),
            "other_liabilities": Decimal("0")
        }
        
        investing_activities = []
        financing_activities = []
        
        cash_start = Decimal("0")
        cash_end = Decimal("0")

        for acc in accounts:
            s_bal = calc_bal(acc, start_balances)
            e_bal = calc_bal(acc, end_balances)
            delta = e_bal - s_bal
            
            name_lower = acc.name.lower()
            subtype_lower = (acc.account_subtype or "").lower()
            
            # Cash & Equivalents tracking
            if "cash" in name_lower or "bank" in name_lower or "wallet" in name_lower or "upi" in name_lower:
                cash_start += s_bal
                cash_end += e_bal
                continue
            
            if acc.account_type == "ASSET":
                if "inventory" in name_lower or "stock" in name_lower:
                    wc_changes["inventory"] -= delta # Increase in asset = cash outflow
                elif "receivable" in name_lower or "debtor" in name_lower:
                    wc_changes["receivables"] -= delta
                elif "advance" in name_lower or "loan" in name_lower:
                    if "current" in subtype_lower:
                        wc_changes["advances"] -= delta
                    else:
                        investing_activities.append({"name": acc.name, "amount": -delta})
                elif "fixed" in subtype_lower or "asset" in subtype_lower:
                    if delta != 0:
                        investing_activities.append({"name": acc.name, "amount": -delta})
                else:
                    wc_changes["other_assets"] -= delta
            
            elif acc.account_type == "LIABILITY":
                if "payable" in name_lower or "creditor" in name_lower:
                    wc_changes["payables"] += delta # Increase in liability = cash inflow
                elif "borrowing" in name_lower or "loan" in name_lower:
                    if "current" in subtype_lower:
                        wc_changes["borrowings_short"] += delta
                    else:
                        financing_activities.append({"name": acc.name, "amount": delta})
                else:
                    wc_changes["other_liabilities"] += delta
            
            elif acc.account_type == "EQUITY":
                if delta != 0 and "profit" not in name_lower: # Avoid double counting net profit
                    financing_activities.append({"name": acc.name, "amount": delta})

        operating_before_wc = net_profit + depreciation_total + finance_costs - interest_received
        total_wc_change = sum(wc_changes.values())
        net_operating_cash = operating_before_wc + total_wc_change
        
        net_investing_cash = sum(i["amount"] for i in investing_activities)
        net_financing_cash = sum(f["amount"] for f in financing_activities)
        
        net_increase = net_operating_cash + net_investing_cash + net_financing_cash

        return {
            "success": True,
            "data": {
                "companyInfo": pl_resp["data"]["companyInfo"],
                "period": {"startDate": str(start_date), "endDate": str(end_date)},
                "operating": {
                    "netProfit": net_profit,
                    "adjustments": adjustments,
                    "depreciation": depreciation_total,
                    "financeCosts": finance_costs,
                    "interestReceived": interest_received,
                    "operatingProfitBeforeWC": operating_before_wc,
                    "wcChanges": wc_changes,
                    "totalWCChange": total_wc_change,
                    "netCash": net_operating_cash
                },
                "investing": {
                    "items": investing_activities,
                    "netCash": net_investing_cash
                },
                "financing": {
                    "items": financing_activities,
                    "netCash": net_financing_cash
                },
                "netIncrease": net_increase,
                "openingCash": cash_start,
                "closingCash": cash_end,
            }
        }

    async def generate_cash_flow_pdf(self, start_date: date, end_date: date) -> bytes:
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        
        data = await self.get_cash_flow(start_date, end_date)
        
        template = self.jinja_env.get_template("cashflow.html")
        html_out = template.render(
            cf_data_json=json.dumps(jsonable_encoder(data["data"]))
        )
        
        try:
            # pyrefly: ignore [missing-import]
            import anyio
            pdf_bytes = await self._generate_pdf(html_out)
            return pdf_bytes
        except Exception as e:
            # pyrefly: ignore [missing-import]
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(e)}")

    async def generate_cash_flow_excel(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional Indirect Cash Flow Statement Excel sheet."""
        data = await self.get_cash_flow(start_date, end_date)
        cf = data["data"]
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, data["company"], "CASH FLOW STATEMENT (INDIRECT METHOD)", {"start": start_date.strftime("%Y-%m-%d"), "end": end_date.strftime("%Y-%m-%d")})
            sheet = writer.book.add_worksheet('Cash Flow')
            
            ex.write_standard_header(sheet, "Statement of Consolidated Cash Receipts and Payments", 12, 3)
            
            # Formats specific to Cash Flow
            fmt_italic = writer.book.add_format({'italic': True, 'border': 1, 'font_size': 9})
            fmt_money_bold = writer.book.add_format({'bold': True, 'border': 1, 'num_format': '#,##0.00', 'font_size': 9, 'align': 'right'})
            
            headers = ["Particulars / Cash Flow Component", "", "Subtotal Amount", "Net Cash Flow"]
            for col, text in enumerate(headers):
                sheet.write(8, col, text, ex.fmt_table_header)
                
            row = 9
            # 1. Operating Activities
            sheet.merge_range(f'A{row+1}:D{row+1}', "A. CASH FLOW FROM OPERATING ACTIVITIES", ex.fmt_section_bg)
            row += 1
            
            sheet.write(row, 0, "Net Profit Before Tax", ex.fmt_bold_border)
            sheet.write(row, 2, ex.safe_float(cf["operating"]["netProfit"]), ex.fmt_money)
            row += 1
            
            # Operating Adjustments
            sheet.write(row, 0, "Adjustments for Operating Items:", fmt_italic)
            row += 1
            for item in cf["operating"]["items"]:
                sheet.write(row, 0, f"  {item['name']}", ex.fmt_border)
                sheet.write(row, 2, ex.safe_float(item["amount"]), ex.fmt_money)
                row += 1
                
            sheet.write(row, 0, "Net Cash generated from Operating Activities", ex.fmt_total_label)
            sheet.write(row, 3, ex.safe_float(cf["operating"]["total"]), fmt_money_bold)
            row += 2
            
            # 2. Investing Activities
            sheet.merge_range(f'A{row+1}:D{row+1}', "B. CASH FLOW FROM INVESTING ACTIVITIES", ex.fmt_section_bg)
            row += 1
            for item in cf["investing"]["items"]:
                sheet.write(row, 0, f"  {item['name']}", ex.fmt_border)
                sheet.write(row, 2, ex.safe_float(item["amount"]), ex.fmt_money)
                row += 1
            sheet.write(row, 0, "Net Cash used in Investing Activities", ex.fmt_total_label)
            sheet.write(row, 3, ex.safe_float(cf["investing"]["total"]), fmt_money_bold)
            row += 2
            
            # 3. Financing Activities
            sheet.merge_range(f'A{row+1}:D{row+1}', "C. CASH FLOW FROM FINANCING ACTIVITIES", ex.fmt_section_bg)
            row += 1
            for item in cf["financing"]["items"]:
                sheet.write(row, 0, f"  {item['name']}", ex.fmt_border)
                sheet.write(row, 2, ex.safe_float(item["amount"]), ex.fmt_money)
                row += 1
            sheet.write(row, 0, "Net Cash from Financing Activities", ex.fmt_total_label)
            sheet.write(row, 3, ex.safe_float(cf["financing"]["total"]), fmt_money_bold)
            row += 2
            
            # Summary Reconciliation
            sheet.merge_range(f'A{row+1}:D{row+1}', "NET CASH FLOWS RECONCILIATION SUMMARY", ex.fmt_section_bg)
            row += 1
            sheet.write(row, 0, "Net Increase / Decrease in Cash & Cash Equivalents (A + B + C)", ex.fmt_bold_border)
            sheet.write(row, 3, ex.safe_float(cf["netIncrease"]), fmt_money_bold)
            row += 1
            sheet.write(row, 0, "Cash & Cash Equivalents at Beginning of the Period", ex.fmt_bold_border)
            sheet.write(row, 3, ex.safe_float(cf["openingCash"]), fmt_money_bold)
            row += 1
            sheet.write(row, 0, "Cash & Cash Equivalents at End of the Period", ex.fmt_total_label)
            sheet.write(row, 3, ex.safe_float(cf["closingCash"]), fmt_money_bold)
            
            ex.set_column_widths(sheet, [45, 12, 18, 18])
            
        return output.getvalue()

    async def get_party_ledger(self, party_id: uuid.UUID, party_type: str, start_date: date, end_date: date) -> Optional[dict]:
        """Fetch transaction ledger for a specific customer or supplier."""
        from app.models import Customer, Supplier, Invoice, Payment, PurchaseBill, Company
        from sqlalchemy import select, func
        from datetime import datetime, date

        # 1. Fetch Party & Company Info
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else ""
        }

        if party_type == "customer":
            party_stmt = select(Customer).where(Customer.id == party_id, Customer.company_id == self.company_id)
            party_res = await self.db.execute(party_stmt)
            party = party_res.scalar_one_or_none()
            if not party: return None
        else:
            party_stmt = select(Supplier).where(Supplier.id == party_id, Supplier.company_id == self.company_id)
            party_res = await self.db.execute(party_stmt)
            party = party_res.scalar_one_or_none()
            if not party: return None

        # 2. Calculate Opening Balance (Transactions before start_date)
        opening_bal = Decimal("0.00")
        
        if party_type == "customer":
            # Invoices before start_date
            inv_stmt = select(func.sum(Invoice.total)).where(
                Invoice.customer_id == party_id,
                Invoice.company_id == self.company_id,
                Invoice.invoice_date < start_date,
                Invoice.status != "CANCELLED"
            )
            inv_res = await self.db.execute(inv_stmt)
            opening_bal += Decimal(str(inv_res.scalar() or 0))
            
            # Payments before start_date
            pay_stmt = select(func.sum(Payment.amount)).where(
                Payment.party_id == party_id,
                Payment.party_type == "customer",
                Payment.company_id == self.company_id,
                Payment.payment_date < datetime.combine(start_date, datetime.min.time())
            )
            pay_res = await self.db.execute(pay_stmt)
            opening_bal -= Decimal(str(pay_res.scalar() or 0))
        else:
            # Purchase Bills before start_date
            bill_stmt = select(func.sum(PurchaseBill.total)).where(
                PurchaseBill.supplier_id == party_id,
                PurchaseBill.company_id == self.company_id,
                PurchaseBill.bill_date < start_date,
                PurchaseBill.status != "CANCELLED"
            )
            bill_res = await self.db.execute(bill_stmt)
            opening_bal += Decimal(str(bill_res.scalar() or 0))

            # Payments before start_date
            pay_stmt = select(func.sum(Payment.amount)).where(
                Payment.party_id == party_id,
                Payment.party_type == "supplier",
                Payment.company_id == self.company_id,
                Payment.payment_date < datetime.combine(start_date, datetime.min.time())
            )
            pay_res = await self.db.execute(pay_stmt)
            opening_bal -= Decimal(str(pay_res.scalar() or 0))
        
        # 3. Fetch Transactions within period
        transactions = []
        
        if party_type == "customer":
            # Invoices
            inv_stmt = select(Invoice).where(
                Invoice.customer_id == party_id,
                Invoice.company_id == self.company_id,
                Invoice.invoice_date.between(start_date, end_date),
                Invoice.status != "CANCELLED"
            )
            inv_res = await self.db.execute(inv_stmt)
            for inv in inv_res.scalars().all():
                d_val = inv.invoice_date.date() if isinstance(inv.invoice_date, datetime) else inv.invoice_date
                transactions.append({
                    "date": d_val,
                    "entry_date": str(d_val),
                    "ref": inv.invoice_number,
                    "voucher_no": inv.invoice_number,
                    "description": f"Sales Invoice - {inv.invoice_number}",
                    "narration": f"Sales Invoice - {inv.invoice_number}",
                    "debit": float(inv.total or 0.0),
                    "credit": 0.0,
                    "type": "INVOICE",
                    "reference_type": "Sales Invoice"
                })
                
            # Payments
            pay_stmt = select(Payment).where(
                Payment.party_id == party_id,
                Payment.party_type == "customer",
                Payment.company_id == self.company_id,
                Payment.payment_date.between(
                    datetime.combine(start_date, datetime.min.time()),
                    datetime.combine(end_date, datetime.max.time())
                )
            )
            pay_res = await self.db.execute(pay_stmt)
            for pay in pay_res.scalars().all():
                d_val = pay.payment_date.date() if isinstance(pay.payment_date, datetime) else pay.payment_date
                v_no = pay.reference_number or f"PAY-{str(pay.id)[:8]}"
                transactions.append({
                    "date": d_val,
                    "entry_date": str(d_val),
                    "ref": v_no,
                    "voucher_no": v_no,
                    "description": pay.notes or f"Payment Received - {pay.payment_method}",
                    "narration": pay.notes or f"Payment Received - {pay.payment_method}",
                    "debit": 0.0,
                    "credit": float(pay.amount or 0.0),
                    "type": "PAYMENT",
                    "reference_type": "Payment Receipt"
                })
        else:
            # Purchase Bills
            bill_stmt = select(PurchaseBill).where(
                PurchaseBill.supplier_id == party_id,
                PurchaseBill.company_id == self.company_id,
                PurchaseBill.bill_date.between(start_date, end_date),
                PurchaseBill.status != "CANCELLED"
            )
            bill_res = await self.db.execute(bill_stmt)
            for bill in bill_res.scalars().all():
                d_val = bill.bill_date.date() if isinstance(bill.bill_date, datetime) else bill.bill_date
                transactions.append({
                    "date": d_val,
                    "entry_date": str(d_val),
                    "ref": bill.bill_number,
                    "voucher_no": bill.bill_number,
                    "description": f"Purchase Bill - {bill.bill_number}",
                    "narration": f"Purchase Bill - {bill.bill_number}",
                    "debit": 0.0,
                    "credit": float(bill.total or 0.0),
                    "type": "BILL",
                    "reference_type": "Purchase Bill"
                })

            # Payments
            pay_stmt = select(Payment).where(
                Payment.party_id == party_id,
                Payment.party_type == "supplier",
                Payment.company_id == self.company_id,
                Payment.payment_date.between(
                    datetime.combine(start_date, datetime.min.time()),
                    datetime.combine(end_date, datetime.max.time())
                )
            )
            pay_res = await self.db.execute(pay_stmt)
            for pay in pay_res.scalars().all():
                d_val = pay.payment_date.date() if isinstance(pay.payment_date, datetime) else pay.payment_date
                v_no = pay.reference_number or f"PAY-{str(pay.id)[:8]}"
                transactions.append({
                    "date": d_val,
                    "entry_date": str(d_val),
                    "ref": v_no,
                    "voucher_no": v_no,
                    "description": pay.notes or f"Payment Made - {pay.payment_method}",
                    "narration": pay.notes or f"Payment Made - {pay.payment_method}",
                    "debit": float(pay.amount or 0.0),
                    "credit": 0.0,
                    "type": "PAYMENT",
                    "reference_type": "Payment Voucher"
                })

        # 4. Sort and calculate running balance
        transactions.sort(key=lambda x: x["date"])
        
        running_bal = float(opening_bal)
        for t in transactions:
            if party_type == "customer":
                running_bal += (t["debit"] - t["credit"])
            else:
                running_bal += (t["credit"] - t["debit"])
            t["balance"] = running_bal
            t["running_balance"] = running_bal
            t["date"] = str(t["date"])
            
        return {
            "company": comp_info,
            "party_name": party.name,
            "period": {"start": str(start_date), "end": str(end_date)},
            "opening_balance": float(opening_bal),
            "closing_balance": running_bal,
            "transactions": transactions
        }

    async def get_audit_logs(self, limit: int = 100) -> list:
        """Returns recent audit logs for the company."""
        # pyrefly: ignore [missing-import]
        from sqlalchemy import desc
        stmt = (
            select(AuditLog)
            .where(AuditLog.company_id == self.company_id)
            .options(selectinload(AuditLog.user))
            .order_by(desc(AuditLog.created_at))
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def generate_invoice_html(
        self, 
        invoice_id: uuid.UUID, 
        company_id: uuid.UUID, 
        theme: Optional[str] = None,
        copy_type: Optional[str] = "original",
        landscape: bool = False
    ) -> str:
        """
        Generates the raw HTML content of a tax invoice.
        """
        # pyrefly: ignore [missing-import]
        from num2words import num2words
        from decimal import ROUND_HALF_UP

        # 1. Fetch complete invoice data
        stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.customer)
            )
            .where(Invoice.id == invoice_id, Invoice.company_id == company_id)
        )
        result = await self.db.execute(stmt)
        invoice = result.scalar_one_or_none()
        
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found.")

        # 2. Fetch Company details
        comp_stmt = select(Company).where(Company.id == company_id)
        comp_result = await self.db.execute(comp_stmt)
        company = comp_result.scalar_one()

        # Determine Copy Types based on request
        if copy_type == "duplicate":
            copy_types = ["Duplicate Copy"]
        elif copy_type == "triplicate":
            copy_types = ["Triplicate Copy"]
        elif copy_type == "both":
            copy_types = ["Original Copy", "Duplicate Copy"]
        elif copy_type == "all":
            copy_types = ["Original Copy", "Duplicate Copy", "Triplicate Copy"]
        else:
            copy_types = ["Original Copy"]

        # 3. Prepare data for template
        items = invoice.items
        total_qty = sum(float(item.quantity) for item in items)
        
        # Load Ganesha Logo SVG from frontend assets
        logo_svg = ""
        try:
            assets_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
            paths_to_try = [
                os.path.normpath(os.path.join(assets_dir, "ganesha.svg")),
                os.path.normpath(os.path.join(assets_dir, "logo.svg")),
                os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "assets", "ganesha.svg")),
                os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "assets", "logo.svg")),
                os.path.normpath(os.path.join(os.getcwd(), "..", "frontend", "src", "assets", "ganesha.svg")),
                os.path.normpath(os.path.join(os.getcwd(), "..", "frontend", "src", "assets", "logo.svg")),
                os.path.normpath(os.path.join(os.getcwd(), "frontend", "src", "assets", "ganesha.svg")),
                os.path.normpath(os.path.join(os.getcwd(), "frontend", "src", "assets", "logo.svg"))
            ]
            
            logo_path = ""
            for p in paths_to_try:
                if os.path.exists(p):
                    logo_path = p
                    break
            
            if logo_path:
                with open(logo_path, "r", encoding="utf-8") as f:
                    svg_content = f.read()
                    if "<svg" in svg_content and "width=" not in svg_content:
                        svg_content = svg_content.replace("<svg", '<svg width="100%" height="100%"', 1)
                    logo_svg = svg_content
            else:
                print(f"ERROR: Logo not found. CWD: {os.getcwd()}, Tried: {paths_to_try}")
        except Exception as e:
            print(f"Error loading logo SVG: {e}")
        
        background_image_path = ""
        header_background_image_path = ""
        try:
            assets_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
            header_bg_paths_to_try = [
                os.path.normpath(os.path.join(assets_dir, "green feather .jpeg")),
                os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "assets", "green feather .jpeg")),
                os.path.normpath(os.path.join(os.getcwd(), "..", "frontend", "src", "assets", "green feather .jpeg")),
                os.path.normpath(os.path.join(os.getcwd(), "frontend", "src", "assets", "green feather .jpeg"))
            ]
            
            for p in header_bg_paths_to_try:
                if os.path.exists(p):
                    import base64
                    with open(p, "rb") as f:
                        b64_data = base64.b64encode(f.read()).decode('utf-8')
                        header_background_image_path = f"data:image/jpeg;base64,{b64_data}"
                    break
            
            if not header_background_image_path:
                print(f"WARNING: Invoice Header Background (green feather) not found. Tried: {header_bg_paths_to_try}")
        except Exception as e:
            print(f"Error resolving header background path: {e}")
        
        # 4. Financial Calculations & Tax Splits
        subtotal = Decimal(str(invoice.subtotal))
        tax_amount = Decimal(str(invoice.tax_amount))
        
        igst_amount = Decimal(str(getattr(invoice, 'igst_amount', 0) or 0))
        cgst_amount = Decimal(str(getattr(invoice, 'cgst_amount', 0) or 0))
        sgst_amount = Decimal(str(getattr(invoice, 'sgst_amount', 0) or 0))

        if cgst_amount == 0 and sgst_amount == 0 and igst_amount == 0 and tax_amount > 0:
            is_local = True
            customer = getattr(invoice, 'customer', None)
            if customer and customer.state and company.registered_state:
                is_local = (customer.state.strip().lower() == company.registered_state.strip().lower())
            
            if is_local:
                cgst_amount = tax_amount / Decimal("2.0")
                sgst_amount = tax_amount / Decimal("2.0")
            else:
                igst_amount = tax_amount

        total_tax_rate = Decimal("0")
        if items and items[0].tax_rate:
            total_tax_rate = Decimal(str(items[0].tax_rate))
        
        cgst_rate = total_tax_rate / Decimal("2.0") if igst_amount == 0 else Decimal("0.0")
        sgst_rate = total_tax_rate / Decimal("2.0") if igst_amount == 0 else Decimal("0.0")
        igst_rate = total_tax_rate if igst_amount > 0 else Decimal("0.0")

        round_off = getattr(invoice, 'round_off_amount', Decimal("0.0")) or Decimal("0.0")
        total_rounded = subtotal + tax_amount + round_off

        amount_in_words = ""
        try:
            words = num2words(int(total_rounded), lang='en_IN').title()
            amount_in_words = f"Rupees {words} Only"
        except Exception:
            amount_in_words = self.indian_number_to_words(int(total_rounded))

        payment_terms_days = 0
        if invoice.due_date and invoice.invoice_date:
            delta = invoice.due_date - invoice.invoice_date
            payment_terms_days = delta.days

        comp_bank = f"Bank: {company.bank_name or ''}\nA/c: {company.account_no or ''}\nIFSC: {company.ifsc_code or ''}" if company.bank_name else None
        bank_details = (getattr(invoice, 'bank_details', None) or comp_bank or "Bank Details Not Configured")

        # 5. Render HTML (Theme 2 Classic ERP Invoice standard)
        template = self.jinja_env.get_template("invoice_riddhi.html")
        html_out = template.render(
            invoice=invoice,
            company=company,
            customer=invoice.customer,
            items=items,
            total_qty=total_qty,
            cgst_rate=cgst_rate,
            sgst_rate=sgst_rate,
            igst_rate=igst_rate,
            cgst_amount=cgst_amount,
            sgst_amount=sgst_amount,
            igst_amount=igst_amount,
            round_off=round_off,
            amount_in_words=amount_in_words,
            payment_terms_days=payment_terms_days,
            bank_details=bank_details,
            logo_svg=logo_svg,
            background_image_path=background_image_path,
            header_background_image_path=header_background_image_path,
            theme=theme,
            copy_types=copy_types,
            now=datetime.now(),
            landscape=landscape
        )
        return html_out

    async def generate_invoice_pdf(
        self, 
        invoice_id: uuid.UUID, 
        company_id: uuid.UUID, 
        theme: Optional[str] = None,
        copy_type: Optional[str] = "original",
        landscape: bool = False,
        search_query: Optional[str] = None
    ) -> tuple:
        """
        Generates a professional tax invoice PDF using Playwright (Chromium).
        This ensures industrial-grade layout fidelity on Windows/Linux.
        """
        # pyrefly: ignore [missing-import]
        from num2words import num2words
        from decimal import ROUND_HALF_UP

        # 1. Fetch complete invoice data
        stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.customer)
            )
            .where(Invoice.id == invoice_id, Invoice.company_id == company_id)
        )
        result = await self.db.execute(stmt)
        invoice = result.scalar_one_or_none()
        
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found.")

        # 2. Fetch Company details
        comp_stmt = select(Company).where(Company.id == company_id)
        comp_result = await self.db.execute(comp_stmt)
        company = comp_result.scalar_one()

        # Determine Copy Types based on request
        if copy_type == "duplicate":
            copy_types = ["Duplicate Copy"]
        elif copy_type == "triplicate":
            copy_types = ["Triplicate Copy"]
        elif copy_type == "both":
            copy_types = ["Original Copy", "Duplicate Copy"]
        elif copy_type == "all":
            copy_types = ["Original Copy", "Duplicate Copy", "Triplicate Copy"]
        else:
            copy_types = ["Original Copy"]

        # 3. Prepare data for template
        items = invoice.items
        total_qty = sum(float(item.quantity) for item in items)
        
        # Load Ganesha Logo SVG from frontend assets
        global _cached_logo_svg
        logo_svg = ""
        if _cached_logo_svg:
            logo_svg = _cached_logo_svg
        else:
            try:
                # Backend is in: backend/app/services/reports.py
                # Target is in: frontend/src/assets/logo.svg
                
                assets_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
                paths_to_try = [
                    # 1. Bundled assets (both dev and packaged)
                    os.path.normpath(os.path.join(assets_dir, "ganesha.svg")),
                    os.path.normpath(os.path.join(assets_dir, "logo.svg")),
                    # 2. Relative to this file
                    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "assets", "ganesha.svg")),
                    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "assets", "logo.svg")),
                    # 3. Relative to CWD (assuming run from backend/)
                    os.path.normpath(os.path.join(os.getcwd(), "..", "frontend", "src", "assets", "ganesha.svg")),
                    os.path.normpath(os.path.join(os.getcwd(), "..", "frontend", "src", "assets", "logo.svg")),
                    # 4. Direct if CWD is project root
                    os.path.normpath(os.path.join(os.getcwd(), "frontend", "src", "assets", "ganesha.svg")),
                    os.path.normpath(os.path.join(os.getcwd(), "frontend", "src", "assets", "logo.svg"))
                ]
                
                logo_path = ""
                for p in paths_to_try:
                    if os.path.exists(p):
                        logo_path = p
                        break
                
                if logo_path:
                    with open(logo_path, "r", encoding="utf-8") as f:
                        svg_content = f.read()
                        if "<svg" in svg_content and "width=" not in svg_content:
                            svg_content = svg_content.replace("<svg", '<svg width="100%" height="100%"', 1)
                        logo_svg = svg_content
                        _cached_logo_svg = logo_svg
                else:
                    print(f"ERROR: Logo not found. CWD: {os.getcwd()}, Tried: {paths_to_try}")
            except Exception as e:
                print(f"Error loading logo SVG: {e}")
        
        # Invoice Background SVG is no longer needed/used
        background_image_path = ""
        
        # Load Invoice Header Background (green feather) from frontend assets
        global _cached_header_bg
        header_background_image_path = ""
        if _cached_header_bg:
            header_background_image_path = _cached_header_bg
        else:
            try:
                assets_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
                header_bg_paths_to_try = [
                    # 1. Bundled assets
                    os.path.normpath(os.path.join(assets_dir, "green feather .jpeg")),
                    # 2. Relative to this file
                    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "assets", "green feather .jpeg")),
                    # 2. Relative to this file
                    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "assets", "green feather .jpeg")),
                    # 3. Relative to CWD (assuming run from backend/)
                    os.path.normpath(os.path.join(os.getcwd(), "..", "frontend", "src", "assets", "green feather .jpeg")),
                    # 4. Direct if CWD is project root
                    os.path.normpath(os.path.join(os.getcwd(), "frontend", "src", "assets", "green feather .jpeg"))
                ]
                
                for p in header_bg_paths_to_try:
                    if os.path.exists(p):
                        import base64
                        with open(p, "rb") as f:
                            b64_data = base64.b64encode(f.read()).decode('utf-8')
                            header_background_image_path = f"data:image/jpeg;base64,{b64_data}"
                            _cached_header_bg = header_background_image_path
                        break
                
                if not header_background_image_path:
                    print(f"WARNING: Invoice Header Background (green feather) not found. Tried: {header_bg_paths_to_try}")
            except Exception as e:
                print(f"Error resolving header background path: {e}")
        
        # 4. Financial Calculations & Tax Splits
        subtotal = Decimal(str(invoice.subtotal))
        tax_amount = Decimal(str(invoice.tax_amount))
        
        # Determine tax rates based on stored amounts
        # If IGST is present, it's an interstate transaction
        igst_amount = Decimal(str(getattr(invoice, 'igst_amount', 0) or 0))
        cgst_amount = Decimal(str(getattr(invoice, 'cgst_amount', 0) or 0))
        sgst_amount = Decimal(str(getattr(invoice, 'sgst_amount', 0) or 0))

        # Dynamic fallback calculation if amounts are zero in DB but tax_amount is present
        if cgst_amount == 0 and sgst_amount == 0 and igst_amount == 0 and tax_amount > 0:
            is_local = True
            customer = getattr(invoice, 'customer', None)
            if customer and customer.state and company.registered_state:
                is_local = (customer.state.strip().lower() == company.registered_state.strip().lower())
            
            if is_local:
                cgst_amount = tax_amount / Decimal("2.0")
                sgst_amount = tax_amount / Decimal("2.0")
            else:
                igst_amount = tax_amount

        # Reconstruct rates for display
        total_tax_rate = Decimal("0")
        if items and items[0].tax_rate:
            total_tax_rate = Decimal(str(items[0].tax_rate))
        
        cgst_rate = total_tax_rate / Decimal("2.0") if igst_amount == 0 else Decimal("0.0")
        sgst_rate = total_tax_rate / Decimal("2.0") if igst_amount == 0 else Decimal("0.0")
        igst_rate = total_tax_rate if igst_amount > 0 else Decimal("0.0")

        round_off = getattr(invoice, 'round_off_amount', Decimal("0.0")) or Decimal("0.0")
        total_rounded = subtotal + tax_amount + round_off

        # Amount in words (Indian format)
        amount_in_words = ""
        try:
            words = num2words(int(total_rounded), lang='en_IN').title()
            amount_in_words = f"Rupees {words} Only"
        except Exception:
            amount_in_words = self.indian_number_to_words(int(total_rounded))

        # 5. Render HTML & Generate PDF with Unstoppable Master Fail-Safe
        # Bank Details derivation (must be defined before template.render())
        comp_bank = f"Bank: {company.bank_name or ''}\nA/c: {company.account_no or ''}\nIFSC: {company.ifsc_code or ''}" if company.bank_name else None
        bank_details = (getattr(invoice, 'bank_details', None) or comp_bank or "Bank Details Not Configured")

        try:
            # Payment Term Derivation
            payment_terms_days = 0
            if getattr(invoice, 'due_date', None) and getattr(invoice, 'invoice_date', None):
                try:
                    d_due = invoice.due_date if hasattr(invoice.due_date, 'year') else datetime.strptime(str(invoice.due_date)[:10], "%Y-%m-%d").date()
                    d_inv = invoice.invoice_date if hasattr(invoice.invoice_date, 'year') else datetime.strptime(str(invoice.invoice_date)[:10], "%Y-%m-%d").date()
                    payment_terms_days = (d_due - d_inv).days
                except Exception:
                    payment_terms_days = 0

            # Render HTML (Theme 2 Classic ERP Invoice standard)
            template = self.jinja_env.get_template("invoice_riddhi.html")
                
            html_out = template.render(
                invoice=invoice,
                company=company,
                customer=invoice.customer,
                items=items,
                total_qty=total_qty,
                cgst_rate=cgst_rate,
                sgst_rate=sgst_rate,
                igst_rate=igst_rate,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                igst_amount=igst_amount,
                round_off=round_off,
                amount_in_words=amount_in_words,
                payment_terms_days=payment_terms_days,
                bank_details=bank_details,
                logo_svg=logo_svg,
                background_image_path=background_image_path,
                header_background_image_path=header_background_image_path,
                theme=theme,
                copy_types=copy_types,
                now=datetime.now(),
                landscape=landscape
            )
            
            # Count search matches page-by-page using fast in-memory HTMLParser
            match_counts = []
            if search_query:
                try:
                    parser = InvoiceSearchParser(search_query)
                    parser.feed(html_out)
                    match_counts = parser.get_matches_per_page()
                except Exception as parse_err:
                    print(f"Error parsing invoice search matches: {parse_err}")

            pdf_bytes = await self._generate_pdf(html_out, landscape=landscape, search_query=search_query)
            return pdf_bytes, match_counts
        except Exception as err:
            print(f"JK ERP: Invoice PDF rendering error ({err})")
            raise HTTPException(status_code=500, detail=f"Invoice PDF Generation Error: {str(err)}")

    async def generate_purchase_bill_excel(self, bill_id: uuid.UUID, company_id: uuid.UUID) -> bytes:
        """
        Generates a professional Excel version of the purchase bill.
        """
        # pyrefly: ignore [missing-import]
        import xlsxwriter
        from app.models import PurchaseBill, Supplier, Company, PurchaseOrder, PurchaseOrderItem
        
        stmt = (
            select(PurchaseBill)
            .options(
                selectinload(PurchaseBill.supplier),
                selectinload(PurchaseBill.purchase_order).selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product)
            )
            .where(PurchaseBill.id == bill_id, PurchaseBill.company_id == company_id)
        )
        result = await self.db.execute(stmt)
        bill = result.scalar_one_or_none()
        
        comp_stmt = select(Company).where(Company.id == company_id)
        comp_result = await self.db.execute(comp_stmt)
        company = comp_result.scalar_one()

        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        comp_info = {"name": company.name, "address": company.office_address_1, "gst_number": company.gst_number}
        ex = IndustrialExcelWriter(workbook, comp_info, "PURCHASE BILL", {"start": bill.bill_date, "end": bill.bill_date})
        sheet = workbook.add_worksheet('Bill')
        
        ex.write_standard_header(sheet, f"Bill No: {bill.bill_number}", None, 8)
        
        row = 10
        sheet.write(row, 0, "SUPPLIER:", ex.fmt_section_bg)
        sheet.write(row + 1, 0, bill.supplier.name, ex.fmt_bold_border)
        sheet.write(row + 2, 0, bill.supplier.address or "", ex.fmt_border)
        sheet.write(row + 3, 0, f"GSTIN: {bill.supplier.gst_number or ''}", ex.fmt_border)
        
        sheet.write(row, 5, "DATE:", ex.fmt_section_bg)
        sheet.write(row + 1, 5, str(bill.bill_date), ex.fmt_border)
        
        headers = ["Sr.", "Description", "Qty", "Rate", "Tax %", "Amount"]
        start_row = 15
        for col_num, header in enumerate(headers):
            sheet.write(start_row, col_num, header, ex.fmt_table_header)
            
        curr_row = start_row + 1
        bill_items = bill.purchase_order.items if (bill.purchase_order and bill.purchase_order.items) else []
        for idx, item in enumerate(bill_items):
            sheet.write(curr_row, 0, idx + 1, ex.fmt_border)
            desc = item.product.name if getattr(item, 'product', None) else getattr(item, 'description', 'N/A')
            sheet.write(curr_row, 1, desc, ex.fmt_border)
            sheet.write(curr_row, 2, float(item.quantity), ex.fmt_border)
            sheet.write(curr_row, 3, float(item.unit_price), ex.fmt_money)
            sheet.write(curr_row, 4, float(item.tax_rate), ex.fmt_border)
            sheet.write(curr_row, 5, float(item.total), ex.fmt_money)
            curr_row += 1
            
        curr_row += 1
        sheet.write(curr_row, 4, "GRAND TOTAL", ex.fmt_section_bg)
        sheet.write(curr_row, 5, float(bill.total), ex.fmt_money)
        
        ex.set_column_widths(sheet, [5, 40, 10, 15, 10, 15])
        workbook.close()
        return output.getvalue()


    async def generate_invoice_excel(self, invoice_id: uuid.UUID, company_id: uuid.UUID) -> bytes:
        """
        Generates a professional Excel version of the invoice.
        Uses the IndustrialExcelWriter for consistent branding.
        """
        # pyrefly: ignore [missing-import]
        import xlsxwriter
        from app.models import Invoice, InvoiceItem, Company
        
        # 1. Fetch data
        stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.customer)
            )
            .where(Invoice.id == invoice_id, Invoice.company_id == company_id)
        )
        result = await self.db.execute(stmt)
        invoice = result.scalar_one_or_none()
        
        comp_stmt = select(Company).where(Company.id == company_id)
        comp_result = await self.db.execute(comp_stmt)
        company = comp_result.scalar_one()

        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        comp_info = {
            "name": company.name,
            "address": f"{company.office_address_1 or ''} {company.office_address_2 or ''}",
            "gst_number": company.gst_number
        }
        
        ex = IndustrialExcelWriter(workbook, comp_info, "TAX INVOICE", {"start": invoice.invoice_date, "end": invoice.invoice_date})
        sheet = workbook.add_worksheet('Invoice')
        
        # Header
        ex.write_standard_header(sheet, f"Invoice No: {invoice.invoice_number}", None, 8)
        
        # Customer Info
        row = 10
        sheet.write(row, 0, "BILL TO:", ex.fmt_section_bg)
        sheet.write(row + 1, 0, invoice.customer.name, ex.fmt_bold_border)
        sheet.write(row + 2, 0, invoice.customer.address or "", ex.fmt_border)
        sheet.write(row + 3, 0, f"GSTIN: {invoice.customer.gst_number or ''}", ex.fmt_border)
        
        # Invoice Meta
        sheet.write(row, 5, "DATE:", ex.fmt_section_bg)
        sheet.write(row + 1, 5, str(invoice.invoice_date), ex.fmt_border)
        sheet.write(row + 2, 5, "PLACE OF SUPPLY:", ex.fmt_section_bg)
        sheet.write(row + 3, 5, invoice.place_of_supply or "", ex.fmt_border)
        
        # Items Table
        headers = ["Sr.", "Description", "HSN/SAC", "Qty", "Unit", "Rate", "Tax %", "Amount"]
        start_row = 15
        for col_num, header in enumerate(headers):
            sheet.write(start_row, col_num, header, ex.fmt_table_header)
            
        curr_row = start_row + 1
        for idx, item in enumerate(invoice.items):
            sheet.write(curr_row, 0, idx + 1, ex.fmt_border)
            sheet.write(curr_row, 1, item.product.name, ex.fmt_border)
            sheet.write(curr_row, 2, item.hsn_code or "", ex.fmt_border)
            sheet.write(curr_row, 3, float(item.quantity), ex.fmt_border)
            sheet.write(curr_row, 4, item.product.unit or "PCS", ex.fmt_border)
            sheet.write(curr_row, 5, float(item.unit_price), ex.fmt_money)
            sheet.write(curr_row, 6, float(item.tax_rate), ex.fmt_border)
            sheet.write(curr_row, 7, float(item.quantity * item.unit_price), ex.fmt_money)
            curr_row += 1
            
        # Totals
        curr_row += 1
        sheet.write(curr_row, 6, "Subtotal", ex.fmt_total_label)
        sheet.write(curr_row, 7, float(invoice.subtotal), ex.fmt_money)
        sheet.write(curr_row + 1, 6, "Tax Amount", ex.fmt_total_label)
        sheet.write(curr_row + 1, 7, float(invoice.tax_amount), ex.fmt_money)
        sheet.write(curr_row + 2, 6, "GRAND TOTAL", ex.fmt_section_bg)
        sheet.write(curr_row + 2, 7, float(invoice.total), ex.fmt_money)
        
        # Bank Details
        curr_row += 2
        sheet.write(curr_row, 0, "BANK DETAILS:", ex.fmt_section_bg)
        sheet.write(curr_row + 1, 0, f"Bank: {company.bank_name}", ex.fmt_border)
        sheet.write(curr_row + 2, 0, f"A/c: {company.account_no}", ex.fmt_border)
        sheet.write(curr_row + 3, 0, f"IFSC: {company.ifsc_code}", ex.fmt_border)
        
        ex.set_column_widths(sheet, [5, 40, 15, 10, 10, 15, 10, 15])
        
        workbook.close()
        return output.getvalue()


    async def generate_purchase_bill_pdf(self, bill_id: uuid.UUID, company_id: uuid.UUID, theme: str = "theme1") -> bytes:
        """
        Generates a professional Purchase Bill / Voucher PDF using Playwright.
        Theme 1: Modern Executive Industrial Standard
        Theme 2: Classic ERP Purchase Voucher
        """
        # pyrefly: ignore [missing-import]
        from num2words import num2words
        from decimal import ROUND_HALF_UP
        from app.models import PurchaseBill, PurchaseOrder, PurchaseOrderItem, PurchaseBillItem

        # 1. Fetch complete bill data
        stmt = (
            select(PurchaseBill)
            .options(
                selectinload(PurchaseBill.supplier),
                selectinload(PurchaseBill.items).selectinload(PurchaseBillItem.product),
                selectinload(PurchaseBill.purchase_order).selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product)
            )
            .where(PurchaseBill.id == bill_id, PurchaseBill.company_id == company_id)
        )
        result = await self.db.execute(stmt)
        bill = result.scalar_one_or_none()
        
        if not bill:
            raise ValueError(f"Purchase Bill {bill_id} not found.")

        # 2. Fetch Company details
        comp_stmt = select(Company).where(Company.id == company_id)
        comp_result = await self.db.execute(comp_stmt)
        company = comp_result.scalar_one()

        # 3. Prepare data for template
        items = bill.items if bill.items else (bill.purchase_order.items if (bill.purchase_order and bill.purchase_order.items) else [])
        total_qty = sum(float(item.quantity) for item in items)
        
        # Load Logo (Industrial Discovery)
        logo_svg = ""
        try:
            assets_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
            paths_to_try = [
                # 1. Bundled assets
                os.path.normpath(os.path.join(assets_dir, "logo.svg")),
                os.path.normpath(os.path.join(assets_dir, "ganesha.svg")),
                # 2. Relative to this file
                os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "assets", "logo.svg")),
                os.path.normpath(os.path.join(os.getcwd(), "..", "frontend", "src", "assets", "logo.svg")),
                os.path.normpath(os.path.join(os.getcwd(), "frontend", "src", "assets", "logo.svg"))
            ]
            logo_path = ""
            for p in paths_to_try:
                if os.path.exists(p):
                    logo_path = p
                    break
            
            if logo_path:
                with open(logo_path, "r", encoding="utf-8") as f:
                    svg_content = f.read()
                    if "<svg" in svg_content and "width=" not in svg_content:
                        svg_content = svg_content.replace("<svg", '<svg width="100%" height="100%"', 1)
                    logo_svg = svg_content
        except Exception: pass

        # 4. Financial Calculations
        subtotal = Decimal(str(bill.subtotal))
        tax_amount = Decimal(str(bill.tax_amount))
        
        cgst_amount = Decimal(str(getattr(bill, 'cgst_amount', 0) or 0))
        sgst_amount = Decimal(str(getattr(bill, 'sgst_amount', 0) or 0))
        igst_amount = Decimal(str(getattr(bill, 'igst_amount', 0) or 0))

        # Dynamic fallback calculation if amounts are zero in DB but tax_amount is present
        if cgst_amount == 0 and sgst_amount == 0 and igst_amount == 0 and tax_amount > 0:
            is_local = True
            supplier = getattr(bill, 'supplier', None)
            if supplier and supplier.state and company.registered_state:
                is_local = (supplier.state.strip().lower() == company.registered_state.strip().lower())
            
            if is_local:
                cgst_amount = tax_amount / Decimal("2.0")
                sgst_amount = tax_amount / Decimal("2.0")
            else:
                igst_amount = tax_amount

        total_exact = subtotal + tax_amount
        total_rounded = total_exact.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        round_off = total_rounded - total_exact

        amount_in_words = ""
        try:
            words = num2words(int(total_rounded), lang='en_IN').title()
            amount_in_words = f"Rupees {words} Only"
        except:
            amount_in_words = self.indian_number_to_words(int(total_rounded))

        # 5. Render HTML (Select Theme template)
        template_name = "purchase_bill_theme1.html" if theme == "theme1" else "purchase_bill.html"
        template = self.jinja_env.get_template(template_name)
        html_out = template.render(
            bill=bill,
            company=company,
            supplier=bill.supplier,
            items=items,
            total_qty=total_qty,
            cgst_amount=cgst_amount,
            sgst_amount=sgst_amount,
            igst_amount=igst_amount,
            round_off=round_off,
            amount_in_words=amount_in_words,
            logo_svg=logo_svg,
        )

        return await self._generate_pdf(html_out)

    async def get_credit_note_register(self, start_date: date, end_date: date) -> dict:
        """Fetch all credit notes for a specific period."""
        from app.models import CreditNote, Customer, Company
        stmt = (
            select(CreditNote)
            .options(selectinload(CreditNote.customer))
            .where(
                CreditNote.company_id == self.company_id,
                CreditNote.note_date.between(start_date, end_date),
                CreditNote.status != "CANCELLED"
            )
            .order_by(CreditNote.note_date.desc())
        )
        res = await self.db.execute(stmt)
        notes = res.scalars().all()
        
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {"name": company.name if company else "Company", "address": company.office_address_1 if company else "", "gst_number": company.gst_number if company else ""}

        return {
            "company": comp_info,
            "period": {"start": start_date.strftime("%d-%b-%Y"), "end": end_date.strftime("%d-%b-%Y")},
            "notes": [
                {
                    "date": n.note_date,
                    "note_no": n.note_number,
                    "customer": n.customer.name,
                    "gstin": n.customer.gst_number or "URP",
                    "taxable": n.subtotal,
                    "igst": n.igst_amount,
                    "cgst": n.cgst_amount,
                    "sgst": n.sgst_amount,
                    "total": n.total,
                    "status": n.status
                } for n in notes
            ]
        }

    async def get_debit_note_register(self, start_date: date, end_date: date) -> dict:
        """Fetch all debit notes for a specific period."""
        from app.models import DebitNote, Supplier, Company
        stmt = (
            select(DebitNote)
            .options(selectinload(DebitNote.supplier))
            .where(
                DebitNote.company_id == self.company_id,
                DebitNote.note_date.between(start_date, end_date),
                DebitNote.status != "CANCELLED"
            )
            .order_by(DebitNote.note_date.desc())
        )
        res = await self.db.execute(stmt)
        notes = res.scalars().all()
        
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {"name": company.name if company else "Company", "address": company.office_address_1 if company else "", "gst_number": company.gst_number if company else ""}

        return {
            "company": comp_info,
            "period": {"start": start_date.strftime("%d-%b-%Y"), "end": end_date.strftime("%d-%b-%Y")},
            "notes": [
                {
                    "date": n.note_date,
                    "note_no": n.note_number,
                    "supplier": n.supplier.name,
                    "gstin": n.supplier.gst_number or "URP",
                    "taxable": n.subtotal,
                    "igst": n.igst_amount,
                    "cgst": n.cgst_amount,
                    "sgst": n.sgst_amount,
                    "total": n.total,
                    "status": n.status
                } for n in notes
            ]
        }

        return {
            "company": comp_info,
            "period": {"start": start_date.strftime("%d-%b-%Y"), "end": end_date.strftime("%d-%b-%Y")},
            "notes": [
                {
                    "date": n.note_date,
                    "note_no": n.note_number,
                    "supplier": n.supplier.name,
                    "gstin": n.supplier.gst_number or "URP",
                    "taxable": n.subtotal,
                    "igst": n.igst_amount,
                    "cgst": n.cgst_amount,
                    "sgst": n.sgst_amount,
                    "total": n.total,
                    "status": n.status
                } for n in notes
            ]
        }

    async def generate_credit_note_register_pdf(self, start_date: date, end_date: date) -> bytes:
        """Generate a PDF of the Credit Note Register."""
        data = await self.get_credit_note_register(start_date, end_date)
        template = self.jinja_env.get_template("cdn_register.html")
        html_out = template.render(
            title="Credit Note Register",
            company=data["company"],
            period=data["period"],
            notes=data["notes"],
            type="Credit",
            now=datetime.now(),
            landscape=self.landscape
        )
        return await self._generate_pdf(html_out)

    async def generate_debit_note_register_pdf(self, start_date: date, end_date: date) -> bytes:
        """Generate a PDF of the Debit Note Register."""
        data = await self.get_debit_note_register(start_date, end_date)
        template = self.jinja_env.get_template("cdn_register.html")
        html_out = template.render(
            title="Debit Note Register",
            company=data["company"],
            period=data["period"],
            notes=data["notes"],
            type="Debit",
            now=datetime.now(),
            landscape=self.landscape
        )
    async def generate_credit_note_pdf(self, note_id: uuid.UUID, company_id: uuid.UUID) -> tuple:
        """
        Generates a professional Credit Note Return Slip PDF using Playwright with ReportLab fail-safe fallback.
        """
        from num2words import num2words
        from app.models import CreditNote, CreditNoteItem, Company
        from sqlalchemy.orm import selectinload

        stmt = (
            select(CreditNote)
            .options(
                selectinload(CreditNote.items).selectinload(CreditNoteItem.product),
                selectinload(CreditNote.customer),
                selectinload(CreditNote.invoice)
            )
            .where(CreditNote.id == note_id, CreditNote.company_id == company_id)
        )
        res = await self.db.execute(stmt)
        note = res.scalar_one_or_none()
        if not note:
            raise ValueError(f"Credit Note {note_id} not found.")

        comp_stmt = select(Company).where(Company.id == company_id)
        comp_res = await self.db.execute(comp_stmt)
        company = comp_res.scalar_one()

        subtotal = float(note.subtotal or 0)
        tax_amount = float(note.tax_amount or 0)
        cgst_amount = tax_amount / 2
        sgst_amount = tax_amount / 2
        total_amount = float(note.total or 0)

        try:
            words = num2words(total_amount, lang='en_IN').title() + " Only"
        except Exception:
            words = f"Rupees {total_amount:.2f} Only"

        items = note.items or []

        try:
            template = self.jinja_env.get_template("return_voucher.html")
            html_out = template.render(
                note_type_title="CREDIT NOTE VOUCHER",
                note=note,
                company=company,
                party=note.customer,
                party_label="CUSTOMER",
                ref_doc_number=note.invoice.invoice_number if note.invoice else None,
                return_mode=getattr(note, "return_mode", "GOODS_RETURN"),
                items=items,
                subtotal=subtotal,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                total_amount=total_amount,
                amount_in_words=words
            )
            pdf_bytes = await self._generate_pdf(html_out)
            return pdf_bytes, note.note_number
        except Exception as err:
            print(f"Playwright PDF generation failed for Credit Note {note_id}, falling back to ReportLab: {err}")
            pdf_bytes = self._generate_reportlab_return_voucher_pdf(
                note_type_title="CREDIT NOTE VOUCHER",
                note_number=note.note_number,
                note_date=note.note_date.strftime('%d-%b-%Y') if note.note_date else '',
                company=company,
                party_name=note.customer.name if note.customer else 'Customer',
                party_gstin=note.customer.gst_number if note.customer else 'Unregistered',
                party_phone=note.customer.phone if note.customer else '',
                ref_doc_number=note.invoice.invoice_number if note.invoice else '',
                reason=note.reason or '',
                items=[{
                    "product_name": i.product.name if i.product else "Item",
                    "quantity": float(i.quantity),
                    "unit_price": float(i.unit_price),
                    "tax_rate": float(i.tax_rate),
                    "total": float(i.total)
                } for i in items],
                subtotal=subtotal,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                total=total_amount,
                amount_in_words=words
            )
            return pdf_bytes, note.note_number

    async def generate_debit_note_pdf(self, note_id: uuid.UUID, company_id: uuid.UUID) -> tuple:
        """
        Generates a professional Debit Note Return Slip PDF using Playwright with ReportLab fail-safe fallback.
        """
        from num2words import num2words
        from app.models import DebitNote, DebitNoteItem, Company
        from sqlalchemy.orm import selectinload

        stmt = (
            select(DebitNote)
            .options(
                selectinload(DebitNote.items).selectinload(DebitNoteItem.product),
                selectinload(DebitNote.supplier),
                selectinload(DebitNote.bill)
            )
            .where(DebitNote.id == note_id, DebitNote.company_id == company_id)
        )
        res = await self.db.execute(stmt)
        note = res.scalar_one_or_none()
        if not note:
            raise ValueError(f"Debit Note {note_id} not found.")

        comp_stmt = select(Company).where(Company.id == company_id)
        comp_res = await self.db.execute(comp_stmt)
        company = comp_res.scalar_one()

        subtotal = float(note.subtotal or 0)
        tax_amount = float(note.tax_amount or 0)
        cgst_amount = tax_amount / 2
        sgst_amount = tax_amount / 2
        total_amount = float(note.total or 0)

        try:
            words = num2words(total_amount, lang='en_IN').title() + " Only"
        except Exception:
            words = f"Rupees {total_amount:.2f} Only"

        items = note.items or []

        try:
            template = self.jinja_env.get_template("return_voucher.html")
            html_out = template.render(
                note_type_title="DEBIT NOTE VOUCHER",
                note=note,
                company=company,
                party=note.supplier,
                party_label="SUPPLIER / VENDOR",
                ref_doc_number=note.bill.bill_number if note.bill else None,
                return_mode=getattr(note, "return_mode", "GOODS_RETURN"),
                items=items,
                subtotal=subtotal,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                total_amount=total_amount,
                amount_in_words=words
            )
            pdf_bytes = await self._generate_pdf(html_out)
            return pdf_bytes, note.note_number
        except Exception as err:
            print(f"Playwright PDF generation failed for Debit Note {note_id}, falling back to ReportLab: {err}")
            pdf_bytes = self._generate_reportlab_return_voucher_pdf(
                note_type_title="DEBIT NOTE VOUCHER",
                note_number=note.note_number,
                note_date=note.note_date.strftime('%d-%b-%Y') if note.note_date else '',
                company=company,
                party_name=note.supplier.name if note.supplier else 'Supplier',
                party_gstin=note.supplier.gst_number if note.supplier else 'Unregistered',
                party_phone=note.supplier.phone if note.supplier else '',
                ref_doc_number=note.bill.bill_number if note.bill else '',
                reason=note.reason or '',
                items=[{
                    "product_name": i.product.name if i.product else "Item",
                    "quantity": float(i.quantity),
                    "unit_price": float(i.unit_price),
                    "tax_rate": float(i.tax_rate),
                    "total": float(i.total)
                } for i in items],
                subtotal=subtotal,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                total=total_amount,
                amount_in_words=words
            )
            return pdf_bytes, note.note_number

    def _generate_reportlab_return_voucher_pdf(
        self,
        note_type_title: str,
        note_number: str,
        note_date: str,
        company: any,
        party_name: str,
        party_gstin: str,
        party_phone: str,
        ref_doc_number: str,
        reason: str,
        items: list,
        subtotal: float,
        cgst_amount: float,
        sgst_amount: float,
        total: float,
        amount_in_words: str
    ) -> bytes:
        import io
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(name='TitleStyle', fontName='Helvetica-Bold', fontSize=18, textColor=colors.HexColor('#0284c7'))
        header_style = ParagraphStyle(name='HeaderStyle', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#0f172a'))
        body_style = ParagraphStyle(name='BodyStyle', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#334155'))

        elements.append(Paragraph(f"{company.name} - {note_type_title}", title_style))
        elements.append(Paragraph(f"Voucher No: {note_number} | Date: {note_date} | Ref: {ref_doc_number or 'N/A'}", header_style))
        elements.append(Spacer(1, 12))

        elements.append(Paragraph(f"<b>Party:</b> {party_name} (GSTIN: {party_gstin})", body_style))
        if reason:
            elements.append(Paragraph(f"<b>Reason:</b> {reason}", body_style))
        elements.append(Spacer(1, 12))

        table_data = [["#", "Item Description", "Qty", "Rate (INR)", "GST %", "Total (INR)"]]
        for idx, item in enumerate(items, 1):
            table_data.append([
                str(idx),
                item.get("product_name", "Item"),
                f"{item.get('quantity', 0):.2f}",
                f"{item.get('unit_price', 0):.2f}",
                f"{item.get('tax_rate', 18):.1f}%",
                f"{item.get('total', 0):.2f}"
            ])
        table_data.append(["", "", "", "", "Subtotal:", f"INR {subtotal:.2f}"])
        table_data.append(["", "", "", "", "CGST (50%):", f"INR {cgst_amount:.2f}"])
        table_data.append(["", "", "", "", "SGST (50%):", f"INR {sgst_amount:.2f}"])
        table_data.append(["", "", "", "", "Net Return Value:", f"INR {total:.2f}"])

        t = Table(table_data, colWidths=[25, 200, 45, 75, 55, 95])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0f172a')),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 16))
        elements.append(Paragraph(f"<b>Amount in Words:</b> {amount_in_words}", body_style))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    async def get_account_ledger(self, account_id: uuid.UUID, start_date: date, end_date: date) -> dict:
        """Fetch transaction lines and running balance for a specific account across all accounting modules."""
        from app.models import Account, JournalEntry, JournalEntryLine, Company, Payment, Invoice, PurchaseBill, Customer, Supplier
        from sqlalchemy import select, and_
        from sqlalchemy.orm import selectinload
        from datetime import datetime, date

        # 1. Fetch Account Info
        acc_stmt = select(Account).where(Account.id == account_id, Account.company_id == self.company_id)
        acc_res = await self.db.execute(acc_stmt)
        account = acc_res.scalar_one_or_none()
        if not account:
            return None

        # 2. Fetch Company Info
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else ""
        }

        all_txns = []

        # 3A. Journal Entries
        stmt = (
            select(JournalEntryLine, JournalEntry)
            .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
            .where(
                JournalEntry.company_id == self.company_id,
                JournalEntryLine.account_id == account_id,
                JournalEntry.entry_date.between(start_date, end_date)
            )
            .order_by(JournalEntry.entry_date.asc(), JournalEntry.created_at.asc())
        )
        res = await self.db.execute(stmt)
        lines = res.all()

        for line, entry in lines:
            d_str = entry.entry_date.strftime("%Y-%m-%d") if isinstance(entry.entry_date, (date, datetime)) else str(entry.entry_date)
            all_txns.append({
                "date": d_str,
                "entry_date": d_str,
                "ref": entry.entry_number,
                "voucher_no": entry.entry_number,
                "description": line.description or entry.description or "Journal Entry",
                "narration": line.description or entry.description or "Journal Entry",
                "reference_type": entry.reference_type or "Journal",
                "debit": float(line.debit or 0.0),
                "credit": float(line.credit or 0.0)
            })

        # 3B. Bank / Cash Payments
        acc_type_upper = (account.account_type or "").upper()
        acc_subtype_upper = (account.account_subtype or "").upper()
        acc_name_lower = (account.name or "").lower().strip()

        is_cash_or_bank = (
            acc_type_upper in ["BANK", "CASH"] or 
            acc_subtype_upper in ["BANK", "CASH"] or 
            "cash" in acc_name_lower or 
            "bank" in acc_name_lower
        )

        if is_cash_or_bank:
            pay_stmt = select(Payment).where(
                Payment.company_id == self.company_id,
                Payment.payment_date.between(
                    datetime.combine(start_date, datetime.min.time()),
                    datetime.combine(end_date, datetime.max.time())
                )
            )
            pay_res = await self.db.execute(pay_stmt)
            payments = pay_res.scalars().all()

            for p in payments:
                is_match = False
                if acc_type_upper == "CASH" or "cash" in acc_name_lower:
                    if p.payment_method.upper() == "CASH":
                        is_match = True
                else:
                    if p.bank_account and p.bank_account.lower().strip() == acc_name_lower:
                        is_match = True
                    elif (not p.bank_account or p.bank_account == "None") and p.payment_method.upper() != "CASH":
                        is_match = True

                if is_match:
                    d_obj = p.payment_date.date() if isinstance(p.payment_date, datetime) else p.payment_date
                    d_str = d_obj.strftime("%Y-%m-%d") if isinstance(d_obj, (date, datetime)) else str(d_obj)
                    amt = float(p.amount or 0.0)
                    is_rcpt = p.payment_type.upper() == "RECEIPT"
                    v_no = p.reference_number or f"PAY-{str(p.id)[:8]}"

                    all_txns.append({
                        "date": d_str,
                        "entry_date": d_str,
                        "ref": v_no,
                        "voucher_no": v_no,
                        "description": p.notes or f"Payment ({p.payment_type}) via {p.payment_method}",
                        "narration": p.notes or f"Payment ({p.payment_type}) via {p.payment_method}",
                        "reference_type": f"Payment ({p.payment_type})",
                        "debit": amt if is_rcpt else 0.0,
                        "credit": 0.0 if is_rcpt else amt
                    })

        # 3C. Sales Income Account
        if "sales" in acc_name_lower or acc_type_upper == "INCOME":
            inv_stmt = select(Invoice).options(selectinload(Invoice.customer)).where(
                Invoice.company_id == self.company_id,
                Invoice.invoice_date.between(start_date, end_date),
                Invoice.status != "CANCELLED"
            )
            inv_res = await self.db.execute(inv_stmt)
            invoices = inv_res.scalars().all()

            for inv in invoices:
                d_str = inv.invoice_date.strftime("%Y-%m-%d") if isinstance(inv.invoice_date, (date, datetime)) else str(inv.invoice_date)
                amt = float(inv.subtotal or inv.total or 0.0)
                cust_name = inv.customer.name if inv.customer else "Customer"

                all_txns.append({
                    "date": d_str,
                    "entry_date": d_str,
                    "ref": inv.invoice_number,
                    "voucher_no": inv.invoice_number,
                    "description": f"Sales Invoice — {cust_name}",
                    "narration": f"Sales Invoice — {cust_name}",
                    "reference_type": "Sales Invoice",
                    "debit": 0.0,
                    "credit": amt
                })

        # 3D. Purchase Expense Account
        if "purchase" in acc_name_lower or acc_type_upper == "EXPENSE":
            bill_stmt = select(PurchaseBill).options(selectinload(PurchaseBill.supplier)).where(
                PurchaseBill.company_id == self.company_id,
                PurchaseBill.bill_date.between(start_date, end_date),
                PurchaseBill.status != "CANCELLED"
            )
            bill_res = await self.db.execute(bill_stmt)
            bills = bill_res.scalars().all()

            for bill in bills:
                d_str = bill.bill_date.strftime("%Y-%m-%d") if isinstance(bill.bill_date, (date, datetime)) else str(bill.bill_date)
                amt = float(bill.subtotal or bill.total or 0.0)
                sup_name = bill.supplier.name if bill.supplier else "Supplier"

                all_txns.append({
                    "date": d_str,
                    "entry_date": d_str,
                    "ref": bill.bill_number,
                    "voucher_no": bill.bill_number,
                    "description": f"Purchase Bill — {sup_name}",
                    "narration": f"Purchase Bill — {sup_name}",
                    "reference_type": "Purchase Bill",
                    "debit": amt,
                    "credit": 0.0
                })

        # 4. Sort chronologically & compute running balance
        all_txns.sort(key=lambda x: x["date"])

        is_debit_normal = acc_type_upper in ["ASSET", "EXPENSE", "BANK", "CASH"]
        opening_bal = float(account.opening_balance or 0.0)
        running_balance = opening_bal

        statement_lines = []
        for tx in all_txns:
            dr = tx["debit"]
            cr = tx["credit"]
            movement = (dr - cr) if is_debit_normal else (cr - dr)
            running_balance += movement

            statement_lines.append({
                "date": tx["date"],
                "entry_date": tx["date"],
                "ref": tx["ref"],
                "voucher_no": tx["ref"],
                "description": tx["description"],
                "narration": tx["narration"],
                "reference_type": tx["reference_type"],
                "debit": dr,
                "credit": cr,
                "balance": running_balance,
                "running_balance": running_balance
            })

        return {
            "company": comp_info,
            "account_name": account.name,
            "period": {"start": start_date.strftime("%d-%b-%Y"), "end": end_date.strftime("%d-%b-%Y")},
            "opening_balance": opening_bal,
            "closing_balance": running_balance,
            "transactions": statement_lines
        }

    async def get_outstanding_summary(self) -> dict:
        """
        Aggregates all unpaid amounts from Invoices (Receivables) and Purchase Bills (Payables).
        Provides a summarized view for financial management.
        """
        from app.models import Invoice, PurchaseBill, Customer, Supplier
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select, func, case
        from datetime import date

        today = date.today()

        # 1. Receivables (Customers)
        rec_stmt = (
            select(
                Customer.id,
                Customer.name,
                func.sum(Invoice.balance_due).label("total_due"),
                func.sum(case((Invoice.due_date < today, Invoice.balance_due), else_=0)).label("overdue")
            )
            .join(Invoice, Invoice.customer_id == Customer.id)
            .where(Invoice.company_id == self.company_id, Invoice.status != "CANCELLED", Invoice.balance_due > 0)
            .group_by(Customer.id, Customer.name)
            .order_by(func.sum(Invoice.balance_due).desc())
        )
        rec_res = await self.db.execute(rec_stmt)
        receivables = [
            {
                "party_id": r.id,
                "party_name": r.name,
                "total_due": r.total_due,
                "overdue": r.overdue
            } for r in rec_res.all()
        ]

        # 2. Payables (Suppliers)
        pay_stmt = (
            select(
                Supplier.id,
                Supplier.name,
                func.sum(PurchaseBill.balance_due).label("total_due"),
                func.sum(case((PurchaseBill.due_date < today, PurchaseBill.balance_due), else_=0)).label("overdue")
            )
            .join(PurchaseBill, PurchaseBill.supplier_id == Supplier.id)
            .where(PurchaseBill.company_id == self.company_id, PurchaseBill.status != "CANCELLED", PurchaseBill.balance_due > 0)
            .group_by(Supplier.id, Supplier.name)
            .order_by(func.sum(PurchaseBill.balance_due).desc())
        )
        pay_res = await self.db.execute(pay_stmt)
        payables = [
            {
                "party_id": p.id,
                "party_name": p.name,
                "total_due": p.total_due,
                "overdue": p.overdue
            } for p in pay_res.all()
        ]

        return {
            "receivables": {
                "total": sum(r["total_due"] for r in receivables),
                "overdue": sum(r["overdue"] for r in receivables),
                "parties": receivables
            },
            "payables": {
                "total": sum(p["total_due"] for p in payables),
                "overdue": sum(p["overdue"] for p in payables),
                "parties": payables
            },
            "timestamp": today.strftime("%d-%b-%Y")
        }

    async def generate_outstanding_pdf(self) -> bytes:
        """Generates Outstanding Receivables & Payables Summary PDF."""
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        from app.models import Company

        data = await self.get_outstanding_summary()
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else "",
            "contact": company.phone if company else "",
            "email": company.email if company else ""
        }
        data["companyInfo"] = comp_info
        data["company"] = comp_info

        try:
            template = self.jinja_env.get_template("outstanding_summary.html")
        except Exception:
            template = self.jinja_env.get_template("day_book.html")

        html_out = template.render(
            db_data_json=json.dumps(jsonable_encoder(data)),
            title="Outstanding Summary",
            company=comp_info,
            data=data,
            now=datetime.now()
        )
        return await self._generate_pdf(html_out)

    async def generate_account_ledger_excel(self, account_id: uuid.UUID, start_date: date, end_date: date, auto_open: bool = False) -> bytes:
        """Generates a professional industrial Account Ledger Excel."""
        data = await self.get_account_ledger(account_id, start_date, end_date)
        if not data: return b""

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, data["company"], f"ACCOUNT LEDGER: {data['account_name']}", data["period"])
            sheet = writer.book.add_worksheet('Ledger')
            
            # Start Writing
            ex.write_standard_header(sheet, f"DETAILED TRANSACTIONAL AUDIT — {data['account_name']}", len(data["transactions"]) + 1, 5)
            
            headers = ["Date", "Ref/Voucher", "Particulars/Description", "Debit (DR)", "Credit (CR)", "Running Balance"]
            for col, text in enumerate(headers):
                sheet.write(8, col, text, ex.fmt_table_header)
            
            # Opening Balance
            sheet.write(9, 0, "B/F", ex.fmt_bold_border)
            sheet.write(9, 2, "Opening Balance / Brought Forward State", ex.fmt_italic_border)
            sheet.write(9, 5, ex.safe_float(data["opening_balance"]), ex.fmt_money_bold)
            
            row = 10
            for tx in data["transactions"]:
                sheet.write(row, 0, tx["date"], ex.fmt_date)
                sheet.write(row, 1, tx["ref"], ex.fmt_bold_border)
                sheet.write(row, 2, tx["description"], ex.fmt_border)
                sheet.write(row, 3, ex.safe_float(tx["debit"]), ex.fmt_money)
                sheet.write(row, 4, ex.safe_float(tx["credit"]), ex.fmt_money)
                sheet.write(row, 5, ex.safe_float(tx["balance"]), ex.fmt_money_bold)
                row += 1
                
            # Footer / Closing
            sheet.write(row, 2, "CLOSING RECONCILIATION BALANCE", ex.fmt_table_header)
            sheet.write(row, 5, ex.safe_float(data["closing_balance"]), ex.fmt_money_bold)
            
            ex.set_column_widths(sheet, [15, 20, 50, 18, 18, 22])

        excel_bytes = output.getvalue()
        if auto_open:
            self._save_and_open_excel(excel_bytes, f"Ledger_{data['account_name']}_{start_date}.xlsx")
        return excel_bytes

    async def generate_account_ledger_pdf(self, account_id: uuid.UUID, start_date: date, end_date: date) -> bytes:
        """Generates a professional industrial Account Ledger PDF."""
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json

        data = await self.get_account_ledger(account_id, start_date, end_date)
        if not data: return b""

        template = self.jinja_env.get_template("account_ledger.html")
        html_out = template.render(
            db_data_json=json.dumps(jsonable_encoder(data)),
            title=f"Account Ledger: {data['account_name']}",
            company=data["company"],
            period=data["period"],
            ledger=data,
            now=datetime.now()
        )
        return await self._generate_pdf(html_out)

    def indian_number_to_words(self, number: int) -> str:
        """Simple helper for Indian currency words."""
        units = ("", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen")
        tens = ("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")
        
        def convert_less_than_thousand(n):
            if n == 0: return ""
            if n < 20: return units[n]
            if n < 100: return tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")
            return units[n // 100] + " Hundred" + (" and " + convert_less_than_thousand(n % 100) if n % 100 != 0 else "")

        if number == 0: return "Zero"
        
        res = ""
        if number >= 10000000:
            res += convert_less_than_thousand(number // 10000000) + " Crore "
            number %= 10000000
        if number >= 100000:
            res += convert_less_than_thousand(number // 100000) + " Lakh "
            number %= 100000
        if number >= 1000:
            res += convert_less_than_thousand(number // 1000) + " Thousand "
            number %= 1000
        if number > 0:
            res += convert_less_than_thousand(number)
            
        return res.strip()
    async def generate_balance_confirmation_pdf(self, party_id: uuid.UUID, party_type: str, start_date: date, end_date: date) -> bytes:
        """
        Generates a Tally-style Balance Confirmation (T-Account) PDF.
        """
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select
        from app.models import Company, Customer, Supplier
        
        # 1. Fetch Company & Party Info
        comp_stmt = select(Company).where(Company.id == self.company_id)
        comp_res = await self.db.execute(comp_stmt)
        company = comp_res.scalar_one_or_none()
        
        if party_type == "customer":
            p_stmt = select(Customer).where(Customer.id == party_id)
        else:
            p_stmt = select(Supplier).where(Supplier.id == party_id)
            
        p_res = await self.db.execute(p_stmt)
        party = p_res.scalar_one_or_none()
        
        if not party:
            raise HTTPException(status_code=404, detail="Party not found")
            
        # 2. Get Ledger Data
        ledger_data = await self.get_party_ledger(party_id, party_type, start_date, end_date)
        
        # 3. Process T-Account semi-rows
        left_rows = []  # Debits
        right_rows = [] # Credits
        total_debit = 0.0
        total_credit = 0.0
        
        # opening balance row
        op_bal = float(ledger_data["opening_balance"] or 0.0)
        if op_bal > 0:
            left_rows.append({"date": start_date.strftime("%d-%b-%y"), "desc": "To Opening Balance", "amount": op_bal})
            total_debit += op_bal
        elif op_bal < 0:
            right_rows.append({"date": start_date.strftime("%d-%b-%y"), "desc": "By Opening Balance", "amount": abs(op_bal)})
            total_credit += abs(op_bal)
            
        for tx in ledger_data["transactions"]:
            d_val = tx["date"]
            if isinstance(d_val, str):
                try:
                    d_val = datetime.strptime(d_val, "%Y-%m-%d").date()
                except Exception:
                    pass
            d_fmt = d_val.strftime("%d-%b-%y") if hasattr(d_val, "strftime") else str(d_val)
            dr_amt = float(tx["debit"] or 0.0)
            cr_amt = float(tx["credit"] or 0.0)
            row = {
                "date": d_fmt,
                "desc": tx["description"],
                "amount": dr_amt if dr_amt > 0 else cr_amt
            }
            if dr_amt > 0:
                left_rows.append(row)
                total_debit += dr_amt
            else:
                right_rows.append(row)
                total_credit += cr_amt
                
        # 4. Fill to align (T-Account style)
        max_rows = max(len(left_rows), len(right_rows))
        
        # 5. Render
        template = self.jinja_env.get_template("balance_confirmation.html")
        html_out = template.render(
            company=company,
            party_name=party.name,
            party_address=party.address or "",
            party_gstin=party.gst_number or "",
            report_date=date.today().strftime("%d-%b-%Y"),
            period_start=start_date.strftime("%d-%b-%Y"),
            period_end=end_date.strftime("%d-%b-%Y"),
            left_rows=left_rows,
            right_rows=right_rows,
            max_rows=max_rows,
            total_debit=total_debit,
            total_credit=total_credit
        )
        
        return await self._generate_pdf(html_out)

    def _indian_amount_format(self, value):
        """Formats a number as per Indian Currency format (Lakhs, Crores)"""
        if value is None or value == "": return ""
        try:
            val = float(value)
            s = f"{val:.2f}"
            parts = s.split(".")
            integer_part = parts[0]
            decimal_part = parts[1]
            
            if len(integer_part) <= 3:
                return f"{integer_part}.{decimal_part}"
            
            last_three = integer_part[-3:]
            remaining = integer_part[:-3]
            
            segments = []
            while len(remaining) > 0:
                segments.append(remaining[-2:])
                remaining = remaining[:-2]
            
            formatted_remaining = ",".join(reversed(segments))
            if formatted_remaining:
                return f"{formatted_remaining},{last_three}.{decimal_part}"
            else:
                return f"{last_three}.{decimal_part}"
        except:
            return str(value)

    async def get_gstr1_data(self, start_date: date, end_date: date) -> dict:
        """Fetch and aggregate GSTR1 data for a period."""
        from app.models import Invoice, InvoiceItem, Customer, Company, CreditNote, CreditNoteItem
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select, and_, or_, func
        # pyrefly: ignore [missing-import]
        from sqlalchemy.orm import selectinload

        # 1. Fetch Company Info
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else "",
            "state": company.registered_state if company else "",
            "state_code": company.gst_number[0:2] if company and company.gst_number else ""
        }

        # 2. Fetch Invoices
        inv_stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product), 
                selectinload(Invoice.customer)
            )
            .where(
                Invoice.company_id == self.company_id,
                Invoice.invoice_date.between(start_date, end_date),
                Invoice.status != "CANCELLED"
            )
        )
        inv_res = await self.db.execute(inv_stmt)
        invoices = inv_res.scalars().all()

        # 3. Aggregators
        b2b = []
        b2cl = [] 
        b2cs = {} 
        cdnr = [] # Credit/Debit Notes Registered
        cdnur = [] # Credit/Debit Notes Unregistered
        hsn_summary = {}
        doc_summary = {
            "total_invoices": 0,
            "cancelled_invoices": 0,
            "net_invoices": 0,
            "total_value": Decimal("0.00"),
            "total_tax": Decimal("0.00")
        }

        # Count cancelled invoices
        cancelled_stmt = select(func.count(Invoice.id)).where(
            Invoice.company_id == self.company_id,
            Invoice.invoice_date.between(start_date, end_date),
            Invoice.status == "CANCELLED"
        )
        doc_summary["cancelled_invoices"] = (await self.db.execute(cancelled_stmt)).scalar() or 0

        for inv in invoices:
            doc_summary["total_invoices"] += 1
            doc_summary["total_value"] += inv.total
            doc_summary["total_tax"] += inv.tax_amount
            
            cust = inv.customer
            is_registered = bool(cust.gst_number and len(cust.gst_number) == 15)
            is_interstate = inv.gst_type == "IGST"
            
            # B2B
            if is_registered:
                b2b.append({
                    "gstin": cust.gst_number,
                    "receiver_name": cust.name,
                    "inv_no": inv.invoice_number,
                    "date": inv.invoice_date,
                    "value": inv.total,
                    "pos": f"{cust.state_code}-{cust.state}" if cust.state_code else cust.state,
                    "reverse_charge": "N",
                    "inv_type": "Regular",
                    "rate": inv.items[0].tax_rate if inv.items else 0,
                    "taxable_value": inv.subtotal,
                    "igst": inv.igst_amount,
                    "cgst": inv.cgst_amount,
                    "sgst": inv.sgst_amount,
                    "cess": 0
                })
            else:
                # B2C Large (> 2.5L and Inter-state)
                if is_interstate and inv.total > 250000:
                    b2cl.append({
                        "inv_no": inv.invoice_number,
                        "date": inv.invoice_date,
                        "value": inv.total,
                        "pos": f"{cust.state_code}-{cust.state}" if cust.state_code else cust.state,
                        "rate": inv.items[0].tax_rate if inv.items else 0,
                        "taxable_value": inv.subtotal,
                        "igst": inv.igst_amount,
                        "cess": 0
                    })
                else:
                    # B2C Small
                    pos = f"{cust.state_code}-{cust.state}" if cust.state_code else (cust.state or "Other")
                    rate = float(inv.items[0].tax_rate) if inv.items else 0.0
                    key = (pos, rate)
                    if key not in b2cs:
                        b2cs[key] = {"pos": pos, "rate": rate, "taxable_value": Decimal("0"), "igst": Decimal("0"), "cgst": Decimal("0"), "sgst": Decimal("0"), "cess": Decimal("0")}
                    
                    b2cs[key]["taxable_value"] += inv.subtotal
                    b2cs[key]["igst"] += inv.igst_amount
                    b2cs[key]["cgst"] += inv.cgst_amount
                    b2cs[key]["sgst"] += inv.sgst_amount

            # HSN Summary
            for item in inv.items:
                hsn = item.hsn_code or "NA"
                if hsn not in hsn_summary:
                    hsn_summary[hsn] = {
                        "hsn": hsn,
                        "description": item.product.name,
                        "uom": item.product.unit or "NOS",
                        "qty": 0,
                        "value": Decimal("0"),
                        "taxable_value": Decimal("0"),
                        "igst": Decimal("0"),
                        "cgst": Decimal("0"),
                        "sgst": Decimal("0"),
                        "cess": Decimal("0")
                    }
                hsn_summary[hsn]["qty"] += float(item.quantity)
                hsn_summary[hsn]["taxable_value"] += (item.quantity * item.unit_price)
                if is_interstate:
                    hsn_summary[hsn]["igst"] += item.tax_amount
                else:
                    hsn_summary[hsn]["cgst"] += item.tax_amount / 2
                    hsn_summary[hsn]["sgst"] += item.tax_amount / 2
                hsn_summary[hsn]["value"] += (item.quantity * item.unit_price) + item.tax_amount

        # 4. Fetch Credit Notes for Returns
        cn_stmt = (
            select(CreditNote)
            .options(selectinload(CreditNote.customer))
            .where(
                CreditNote.company_id == self.company_id,
                CreditNote.note_date.between(start_date, end_date),
                CreditNote.status != "CANCELLED"
            )
        )
        cn_res = await self.db.execute(cn_stmt)
        for cn in cn_res.scalars().all():
            cust = cn.customer
            is_registered = bool(cust.gst_number and len(cust.gst_number) == 15)
            
            note_data = {
                "gstin": cust.gst_number or "URP",
                "receiver_name": cust.name,
                "note_no": cn.note_number,
                "note_date": cn.note_date,
                "note_type": "C", # Credit Note
                "place_of_supply": f"{cust.state_code}-{cust.state}" if cust.state_code else cust.state,
                "value": cn.total,
                "rate": 0, # Aggregate if multiple rates, usually simplified
                "taxable_value": cn.subtotal,
                "igst": cn.igst_amount,
                "cgst": cn.cgst_amount,
                "sgst": cn.sgst_amount,
                "cess": 0,
                "pre_gst": "N"
            }
            if is_registered:
                cdnr.append(note_data)
            else:
                cdnur.append(note_data)

        doc_summary["net_invoices"] = doc_summary["total_invoices"] - doc_summary["cancelled_invoices"]

        return {
            "company": comp_info,
            "period": {"start": start_date.strftime("%d-%b-%Y"), "end": end_date.strftime("%d-%b-%Y")},
            "b2b": b2b,
            "b2cl": b2cl,
            "b2cs": list(b2cs.values()),
            "cdnr": cdnr,
            "cdnur": cdnur,
            "hsn": list(hsn_summary.values()),
            "doc_summary": doc_summary
        }

    async def get_gstr3b_data(self, start_date: date, end_date: date) -> dict:
        """Fetch consolidated GSTR-3B data (Outward and Inward Supplies) for tax return analysis."""
        from app.models import Company, Invoice, PurchaseBill
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select, func

        # Fetch Company info
        company = await self.db.get(Company, self.company_id)
        comp_info = {
            "name": company.name if company else "N/A",
            "gst_number": company.gst_number if company else "",
            "address": company.office_address_1 if company else "",
            "city": company.station_name if company else ""
        }

        # Outward supplies
        sales_stmt = select(
            func.sum(Invoice.subtotal).label("taxable_value"),
            func.sum(Invoice.igst_amount).label("igst"),
            func.sum(Invoice.cgst_amount).label("cgst"),
            func.sum(Invoice.sgst_amount).label("sgst"),
            func.sum(Invoice.tax_amount).label("total_tax")
        ).where(
            Invoice.company_id == self.company_id,
            Invoice.invoice_date.between(start_date, end_date),
            Invoice.status != "CANCELLED"
        )
        sales_res = await self.db.execute(sales_stmt)
        sales_row = sales_res.first()
        
        # Inward supplies (ITC)
        purch_stmt = select(
            func.sum(PurchaseBill.subtotal).label("taxable_value"),
            func.sum(PurchaseBill.igst_amount).label("igst"),
            func.sum(PurchaseBill.cgst_amount).label("cgst"),
            func.sum(PurchaseBill.sgst_amount).label("sgst"),
            func.sum(PurchaseBill.tax_amount).label("itc_available")
        ).where(
            PurchaseBill.company_id == self.company_id,
            PurchaseBill.bill_date.between(start_date, end_date),
            PurchaseBill.status != "CANCELLED"
        )
        purch_res = await self.db.execute(purch_stmt)
        purch_row = purch_res.first()
        
        s_val = float(sales_row.taxable_value or 0.0) if sales_row else 0.0
        s_igst = float(sales_row.igst or 0.0) if sales_row else 0.0
        s_cgst = float(sales_row.cgst or 0.0) if sales_row else 0.0
        s_sgst = float(sales_row.sgst or 0.0) if sales_row else 0.0
        s_tax = float(sales_row.total_tax or 0.0) if sales_row else 0.0
        
        p_val = float(purch_row.taxable_value or 0.0) if purch_row else 0.0
        p_igst = float(purch_row.igst or 0.0) if purch_row else 0.0
        p_cgst = float(purch_row.cgst or 0.0) if purch_row else 0.0
        p_sgst = float(purch_row.sgst or 0.0) if purch_row else 0.0
        p_itc = float(purch_row.itc_available or 0.0) if purch_row else 0.0
        
        net_payable = s_tax - p_itc
        
        return {
            "company": comp_info,
            "period": {"start": start_date.strftime("%Y-%m-%d"), "end": end_date.strftime("%Y-%m-%d")},
            "outward_supplies": {
                "taxable_value": s_val,
                "igst": s_igst,
                "cgst": s_cgst,
                "sgst": s_sgst,
                "total_tax": s_tax
            },
            "inward_supplies_itc": {
                "taxable_value": p_val,
                "itc_available": p_itc,
                "igst": p_igst,
                "cgst": p_cgst,
                "sgst": p_sgst
            },
            "net_tax_payable": net_payable
        }

    async def generate_gstr3b_pdf(self, start_date: date, end_date: date) -> bytes:
        """Generates an official GSTR-3B Report PDF as per legal Indian GST rules."""
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        
        data = await self.get_gstr3b_data(start_date, end_date)
        
        template = self.jinja_env.get_template("gstr3b.html")
        html_out = template.render(
            gstr3b=data,
            gstr3b_json=json.dumps(jsonable_encoder(data)),
            now=datetime.now(),
            landscape=self.landscape
        )
        
        return await self._generate_pdf(html_out)

    async def generate_gstr3b_excel(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional, legally aligned GSTR-3B Excel sheet."""
        data = await self.get_gstr3b_data(start_date, end_date)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, data["company"], "FORM GSTR-3B: CONSOLIDATED TAX RETURN", data["period"])
            sheet = writer.book.add_worksheet('GSTR-3B')
            
            # Write branding header
            ex.write_standard_header(sheet, "Consolidated Summary of Liabilities and Input Tax Credit (ITC)", 3, 5)
            
            # Table 3.1: Outward Supplies
            sheet.merge_range('A9:F9', "3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge", ex.fmt_section_bg)
            headers = ["Nature of Supplies", "Taxable Value", "Integrated Tax (IGST)", "Central Tax (CGST)", "State Tax (SGST)", "Cess"]
            for col, text in enumerate(headers):
                sheet.write(10, col, text, ex.fmt_table_header)
                
            outward = data["outward_supplies"]
            sheet.write(11, 0, "(a) Outward taxable supplies (other than zero rated, nil rated and exempted)", ex.fmt_bold_border)
            sheet.write(11, 1, ex.safe_float(outward["taxable_value"]), ex.fmt_money)
            sheet.write(11, 2, ex.safe_float(outward["igst"]), ex.fmt_money)
            sheet.write(11, 3, ex.safe_float(outward["cgst"]), ex.fmt_money)
            sheet.write(11, 4, ex.safe_float(outward["sgst"]), ex.fmt_money)
            sheet.write(11, 5, 0.0, ex.fmt_money)
            
            # Table 4: Input Tax Credit
            sheet.merge_range('A14:F14', "4. Details of Eligible Input Tax Credit (ITC)", ex.fmt_section_bg)
            for col, text in enumerate(headers):
                sheet.write(15, col, text, ex.fmt_table_header)
                
            inward = data["inward_supplies_itc"]
            sheet.write(16, 0, "(A) ITC Available (whether in full or part)", ex.fmt_bold_border)
            sheet.write(16, 1, ex.safe_float(inward["taxable_value"]), ex.fmt_money)
            sheet.write(16, 2, ex.safe_float(inward["igst"]), ex.fmt_money)
            sheet.write(16, 3, ex.safe_float(inward["cgst"]), ex.fmt_money)
            sheet.write(16, 4, ex.safe_float(inward["sgst"]), ex.fmt_money)
            sheet.write(16, 5, 0.0, ex.fmt_money)
            
            # Net Tax Payable Section
            sheet.merge_range('A19:F19', "6.1 Payment of Tax (Net Liability Summary)", ex.fmt_section_bg)
            sheet.write(20, 0, "Net Tax Liability / Outstanding Payable", ex.fmt_bold_border)
            sheet.write(20, 1, "Output Tax minus Available ITC", ex.fmt_border)
            sheet.write(20, 2, ex.safe_float(data["net_tax_payable"]), ex.fmt_money_bold)
            sheet.write(20, 3, "Payable" if data["net_tax_payable"] > 0 else "Credit / Carry Forward", ex.fmt_bold_border)
            
            ex.set_column_widths(sheet, [45, 18, 18, 18, 18, 12])
            
        return output.getvalue()


    async def generate_outstanding_pdf(self) -> bytes:
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        from datetime import date
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select
        from app.models import Company
        
        data = await self.get_outstanding_summary()
        company_result = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = company_result.scalar_one_or_none()
        
        report_data = {
            "companyInfo": {
                "name": company.name if company else "Company",
                "address": company.office_address_1 if company else "",
                "gst_number": company.gst_number if company and company.gst_number else "",
                "contact": (company.phone or company.mobile_no or "") if company else "",
                "email": company.email if company else ""
            },
            "timestamp": date.today().strftime("%d %b %Y"),
            "receivables": data["receivables"],
            "payables": data["payables"]
        }
        
        template = self.jinja_env.get_template("outstanding_summary.html")
        html_out = template.render(
            db_data_json=json.dumps(jsonable_encoder(report_data)),
            landscape=self.landscape
        )
        return await self._generate_pdf(html_out)

    async def generate_gstr1_pdf(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional GSTR-1 Report PDF."""
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        
        data = await self.get_gstr1_data(start_date, end_date)
        
        template = self.jinja_env.get_template("gstr1.html")
        html_out = template.render(
            gstr1=data,
            gstr1_json=json.dumps(jsonable_encoder(data)),
            now=datetime.now(),
            landscape=self.landscape
        )
        
        return await self._generate_pdf(html_out)

    async def get_gstr1_summary_data(self, start_date: date, end_date: date) -> dict:
        """Fetch outward summary data grouped month-by-month for GSTR-9 analysis."""
        from app.models import Invoice, CreditNote, DebitNote, InvoiceItem, Product, Company
        # pyrefly: ignore [missing-import]
        from sqlalchemy.orm import selectinload
        from decimal import Decimal

        # Generate list of month keys (e.g. "Apr-26")
        months = []
        curr = start_date.replace(day=1)
        while curr <= end_date:
            months.append(curr.strftime("%b-%y"))
            # advance to next month
            if curr.month == 12:
                curr = curr.replace(year=curr.year + 1, month=1)
            else:
                curr = curr.replace(month=curr.month + 1)

        # Initialize dictionary for each category
        categories = ["B2B", "B2CL", "B2CS", "CDNR_CREDIT", "CDNR_DEBIT", "CDNUR_CREDIT", "CDNUR_DEBIT", "EXP", "AT", "ATADJ", "EXEMP", "NIL", "NON-GST", "HSN"]
        row_names = ["TAXABLE AMOUNT", "INTEGRATED TAX", "CENTRAL GSTTAX", "STATE GST-TAX", "CESS GST-TAX", "TOTAL AMOUNTRS"]
        
        report_structure = {}
        for cat in categories:
            report_structure[cat] = {row: {m: Decimal("0.00") for m in months} for row in row_names}

        # Fetch Invoices
        inv_stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.customer)
            )
            .where(
                Invoice.company_id == self.company_id,
                Invoice.invoice_date.between(start_date, end_date),
                Invoice.status != "CANCELLED"
            )
        )
        inv_res = await self.db.execute(inv_stmt)
        invoices = inv_res.scalars().all()

        # Fetch Credit Notes
        cn_stmt = (
            select(CreditNote)
            .options(selectinload(CreditNote.customer))
            .where(
                CreditNote.company_id == self.company_id,
                CreditNote.note_date.between(start_date, end_date),
                CreditNote.status != "CANCELLED"
            )
        )
        cn_res = await self.db.execute(cn_stmt)
        credit_notes = cn_res.scalars().all()

        # Fetch Debit Notes
        dn_stmt = (
            select(DebitNote)
            .options(selectinload(DebitNote.supplier))
            .where(
                DebitNote.company_id == self.company_id,
                DebitNote.note_date.between(start_date, end_date),
                DebitNote.status != "CANCELLED"
            )
        )
        dn_res = await self.db.execute(dn_stmt)
        debit_notes = dn_res.scalars().all()

        for inv in invoices:
            month_key = inv.invoice_date.strftime("%b-%y")
            if month_key not in months:
                continue
                
            cust = inv.customer
            is_registered = bool(cust.gst_number and len(cust.gst_number) == 15)
            is_interstate = inv.gst_type == "IGST"
            
            if is_registered:
                cat = "B2B"
            elif is_interstate and inv.total > 250000:
                cat = "B2CL"
            else:
                cat = "B2CS"
                
            report_structure[cat]["TAXABLE AMOUNT"][month_key] += inv.subtotal
            report_structure[cat]["INTEGRATED TAX"][month_key] += inv.igst_amount
            report_structure[cat]["CENTRAL GSTTAX"][month_key] += inv.cgst_amount
            report_structure[cat]["STATE GST-TAX"][month_key] += inv.sgst_amount
            report_structure[cat]["CESS GST-TAX"][month_key] += Decimal("0.00")
            report_structure[cat]["TOTAL AMOUNTRS"][month_key] += inv.total
            
            # HSN
            report_structure["HSN"]["TAXABLE AMOUNT"][month_key] += inv.subtotal
            report_structure["HSN"]["INTEGRATED TAX"][month_key] += inv.igst_amount
            report_structure["HSN"]["CENTRAL GSTTAX"][month_key] += inv.cgst_amount
            report_structure["HSN"]["STATE GST-TAX"][month_key] += inv.sgst_amount
            report_structure["HSN"]["CESS GST-TAX"][month_key] += Decimal("0.00")
            report_structure["HSN"]["TOTAL AMOUNTRS"][month_key] += inv.total

        for cn in credit_notes:
            month_key = cn.note_date.strftime("%b-%y")
            if month_key not in months:
                continue
                
            cust = cn.customer
            is_registered = bool(cust.gst_number and len(cust.gst_number) == 15)
            cat = "CDNR_CREDIT" if is_registered else "CDNUR_CREDIT"
            
            report_structure[cat]["TAXABLE AMOUNT"][month_key] += cn.subtotal
            report_structure[cat]["INTEGRATED TAX"][month_key] += cn.igst_amount
            report_structure[cat]["CENTRAL GSTTAX"][month_key] += cn.cgst_amount
            report_structure[cat]["STATE GST-TAX"][month_key] += cn.sgst_amount
            report_structure[cat]["CESS GST-TAX"][month_key] += Decimal("0.00")
            report_structure[cat]["TOTAL AMOUNTRS"][month_key] += cn.total

        for dn in debit_notes:
            month_key = dn.note_date.strftime("%b-%y")
            if month_key not in months:
                continue
                
            supp = dn.supplier
            is_registered = bool(supp.gst_number and len(supp.gst_number) == 15)
            cat = "CDNR_DEBIT" if is_registered else "CDNUR_DEBIT"
            
            report_structure[cat]["TAXABLE AMOUNT"][month_key] += dn.subtotal
            report_structure[cat]["INTEGRATED TAX"][month_key] += dn.igst_amount
            report_structure[cat]["CENTRAL GSTTAX"][month_key] += dn.cgst_amount
            report_structure[cat]["STATE GST-TAX"][month_key] += dn.sgst_amount
            report_structure[cat]["CESS GST-TAX"][month_key] += Decimal("0.00")
            report_structure[cat]["TOTAL AMOUNTRS"][month_key] += dn.total

        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else "",
            "state": company.registered_state if company else "",
            "state_code": company.gst_number[0:2] if company and company.gst_number else ""
        }

        serialized_data = {}
        for cat, rows in report_structure.items():
            serialized_data[cat] = {}
            for row, vals in rows.items():
                serialized_data[cat][row] = {}
                row_total = Decimal("0.00")
                for m in months:
                    val = vals[m]
                    row_total += val
                    serialized_data[cat][row][m] = float(val)
                serialized_data[cat][row]["TOTAL"] = float(row_total)

        return {
            "company": comp_info,
            "period": {"start": start_date.strftime("%d-%b-%Y"), "end": end_date.strftime("%d-%b-%Y")},
            "months": months,
            "data": serialized_data
        }

    async def generate_gstr1_summary_pdf(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional GSTR-1 Summary Report PDF."""
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        
        data = await self.get_gstr1_summary_data(start_date, end_date)
        
        template = self.jinja_env.get_template("gstr1_summary.html")
        html_out = template.render(
            report=data,
            report_json=json.dumps(jsonable_encoder(data)),
            now=datetime.now(),
            landscape=self.landscape
        )
        
        return await self._generate_pdf(html_out)

    async def generate_gstr1_summary_excel(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional GSTR-1 Summary monthly spreadsheet (GSTR-9 format)."""
        data = await self.get_gstr1_summary_data(start_date, end_date)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, data["company"], "GSTR-1 SUMMARY MATRIX (FOR GSTR-9)", data["period"])
            
            category_map = {
                "B2B": "B2B",
                "B2CL": "B2CL",
                "B2CS": "B2CS",
                "CDNR_CREDIT": "CDNR Credit",
                "CDNR_DEBIT": "CDNR Debit",
                "CDNUR_CREDIT": "CDNUR Credit",
                "CDNUR_DEBIT": "CDNUR Debit",
                "HSN": "HSN Summary"
            }
            
            row_labels = ["TAXABLE AMOUNT", "INTEGRATED TAX", "CENTRAL GSTTAX", "STATE GST-TAX", "CESS GST-TAX", "TOTAL AMOUNTRS"]
            
            for key, tab_name in category_map.items():
                cat_data = data["data"].get(key)
                if not cat_data: continue
                
                sheet = writer.book.add_worksheet(tab_name[:31])
                ex.write_standard_header(sheet, f"Outward Supply Analysis Matrix: {tab_name}", len(data["months"]), len(data["months"]) + 1)
                
                sheet.write(8, 0, "GST TAX-TYPE HEAD", ex.fmt_table_header)
                for col_idx, m_name in enumerate(data["months"]):
                    sheet.write(8, col_idx + 1, m_name, ex.fmt_table_header)
                sheet.write(8, len(data["months"]) + 1, "TOTAL AMOUNT", ex.fmt_table_header)
                
                row = 9
                for label in row_labels:
                    row_val_data = cat_data.get(label, {})
                    is_total = (label == "TOTAL AMOUNTRS")
                    
                    sheet.write(row, 0, label, ex.fmt_total_label if is_total else ex.fmt_bold_border)
                    for col_idx, m_name in enumerate(data["months"]):
                        val = ex.safe_float(row_val_data.get(m_name, 0.0))
                        sheet.write(row, col_idx + 1, val, ex.fmt_money_bold if is_total else ex.fmt_money)
                    
                    total_val = ex.safe_float(row_val_data.get("TOTAL", 0.0))
                    sheet.write(row, len(data["months"]) + 1, total_val, ex.fmt_money_bold if is_total else ex.fmt_money)
                    row += 1
                
                col_widths = [20] + [12] * len(data["months"]) + [15]
                ex.set_column_widths(sheet, col_widths)
                
        return output.getvalue()

    async def generate_gstr1_excel(self, start_date: date, end_date: date, auto_open: bool = False) -> bytes:
        """
        Generates a professional, stylized GSTR-1 report in Excel format.
        Matches the "Industrial Symmetry" aesthetic of the ERP system.
        """
        data = await self.get_gstr1_data(start_date, end_date)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, data["company"], "GSTR-1 REPORT (OUTWARD SUPPLIES)", data["period"])
            
            # 1. B2B Sheet
            sheet_b2b = writer.book.add_worksheet('B2B')
            ex.write_standard_header(sheet_b2b, "1. Outward Supplies to Registered Taxable Person (B2B)", len(data["b2b"]), 8)
            headers = ["GSTIN", "Receiver Name", "Invoice No.", "Date", "Taxable Value", "Integrated Tax", "Central/State Tax", "Total Value"]
            for col_num, header in enumerate(headers):
                sheet_b2b.write(8, col_num, header, ex.fmt_table_header)
            
            row = 9
            for inv in data["b2b"]:
                sheet_b2b.write(row, 0, inv.get("customer_gstin", "URP"), ex.fmt_bold_border)
                sheet_b2b.write(row, 1, inv.get("customer_name", "N/A"), ex.fmt_border)
                sheet_b2b.write(row, 2, inv.get("invoice_no", "-"), ex.fmt_border)
                sheet_b2b.write(row, 3, inv.get("invoice_date"), ex.fmt_date)
                sheet_b2b.write(row, 4, ex.safe_float(inv.get("taxable_value")), ex.fmt_money)
                sheet_b2b.write(row, 5, ex.safe_float(inv.get("igst")), ex.fmt_money)
                sheet_b2b.write(row, 6, ex.safe_float(inv.get("cgst", 0) + inv.get("sgst", 0)), ex.fmt_money)
                sheet_b2b.write(row, 7, ex.safe_float(inv.get("total_invoice_value")), ex.fmt_money)
                row += 1
            ex.set_column_widths(sheet_b2b, [20, 25, 15, 12, 15, 15, 15, 15])

            # 2. B2C Sheet
            sheet_b2c = writer.book.add_worksheet('B2C (Others)')
            ex.write_standard_header(sheet_b2c, "2. Outward Supplies to Unregistered Persons (B2C)", len(data["b2cl"]) + len(data["b2cs"]), 8)
            headers_b2c = ["Type", "Customer/Place", "Invoice No.", "Date", "Taxable Value", "IGST", "CGST", "SGST"]
            for col_num, header in enumerate(headers_b2c):
                sheet_b2c.write(8, col_num, header, ex.fmt_table_header)
            
            row = 9
            for inv in data["b2cl"]:
                sheet_b2c.write(row, 0, "B2C Large", ex.fmt_border)
                sheet_b2c.write(row, 1, inv.get("customer_name"), ex.fmt_border)
                sheet_b2c.write(row, 2, inv.get("invoice_no"), ex.fmt_border)
                sheet_b2c.write(row, 3, inv.get("invoice_date"), ex.fmt_date)
                sheet_b2c.write(row, 4, ex.safe_float(inv.get("taxable_value")), ex.fmt_money)
                sheet_b2c.write(row, 5, ex.safe_float(inv.get("igst")), ex.fmt_money)
                sheet_b2c.write(row, 6, ex.safe_float(inv.get("cgst")), ex.fmt_money)
                sheet_b2c.write(row, 7, ex.safe_float(inv.get("sgst")), ex.fmt_money)
                row += 1
            for inv in data["b2cs"]:
                sheet_b2c.write(row, 0, "B2C Small", ex.fmt_border)
                sheet_b2c.write(row, 1, inv.get("pos"), ex.fmt_border)
                sheet_b2c.write(row, 2, "-", ex.fmt_border)
                sheet_b2c.write(row, 3, "-", ex.fmt_border)
                sheet_b2c.write(row, 4, ex.safe_float(inv.get("taxable_value")), ex.fmt_money)
                sheet_b2c.write(row, 5, ex.safe_float(inv.get("igst")), ex.fmt_money)
                sheet_b2c.write(row, 6, ex.safe_float(inv.get("cgst")), ex.fmt_money)
                sheet_b2c.write(row, 7, ex.safe_float(inv.get("sgst")), ex.fmt_money)
                row += 1
            ex.set_column_widths(sheet_b2c, [15, 25, 15, 12, 15, 15, 15, 15])

            # 3. CDN Sheet
            sheet_cdn = writer.book.add_worksheet('Returns (CDN)')
            ex.write_standard_header(sheet_cdn, "3. Credit/Debit Notes (Returns)", len(data["cdnr"]) + len(data["cdnur"]), 7)
            headers_cdn = ["GSTIN", "Receiver Name", "Note No.", "Date", "Note Type", "Taxable Value", "Tax Amt"]
            for col_num, header in enumerate(headers_cdn):
                sheet_cdn.write(8, col_num, header, ex.fmt_table_header)
            
            row = 9
            for note in data["cdnr"] + data["cdnur"]:
                sheet_cdn.write(row, 0, note.get("gstin", "URP"), ex.fmt_bold_border)
                sheet_cdn.write(row, 1, note.get("receiver_name", "N/A"), ex.fmt_border)
                sheet_cdn.write(row, 2, note.get("note_no", "-"), ex.fmt_border)
                sheet_cdn.write(row, 3, note.get("note_date"), ex.fmt_date)
                sheet_cdn.write(row, 4, "Credit Note" if note.get("note_type") == "C" else "Debit Note", ex.fmt_border)
                sheet_cdn.write(row, 5, ex.safe_float(note.get("taxable_value")), ex.fmt_money)
                sheet_cdn.write(row, 6, ex.safe_float(ex.safe_float(note.get("igst")) + ex.safe_float(note.get("cgst")) + ex.safe_float(note.get("sgst"))), ex.fmt_money)
                row += 1
            ex.set_column_widths(sheet_cdn, [20, 25, 15, 12, 15, 15, 15])

            # 4. HSN Sheet
            sheet_hsn = writer.book.add_worksheet('HSN Summary')
            ex.write_standard_header(sheet_hsn, "4. HSN Summary of Outward Supplies", len(data["hsn"]), 6)
            headers_hsn = ["HSN Code", "Description", "UOM", "Qty", "Taxable Value", "Total Value"]
            for col_num, header in enumerate(headers_hsn):
                sheet_hsn.write(8, col_num, header, ex.fmt_table_header)
            
            row = 9
            for item in data["hsn"]:
                sheet_hsn.write(row, 0, item.get("hsn", "NA"), ex.fmt_bold_border)
                sheet_hsn.write(row, 1, item.get("description", "N/A"), ex.fmt_border)
                sheet_hsn.write(row, 2, item.get("uom", "NOS"), ex.fmt_border)
                sheet_hsn.write(row, 3, ex.safe_float(item.get("qty")), ex.fmt_border)
                sheet_hsn.write(row, 4, ex.safe_float(item.get("taxable_value")), ex.fmt_money)
                sheet_hsn.write(row, 5, ex.safe_float(item.get("value")), ex.fmt_money)
                row += 1
            ex.set_column_widths(sheet_hsn, [15, 30, 10, 12, 15, 15])

            # 5. Doc Summary Sheet
            sheet_sum = writer.book.add_worksheet('Doc Summary')
            ex.write_standard_header(sheet_sum, "5. Outward Supplies Document Summary", None, 2)
            headers_sum = ["Metric", "Value"]
            for col_num, header in enumerate(headers_sum):
                sheet_sum.write(8, col_num, header, ex.fmt_table_header)
            
            ds = data.get("doc_summary", {})
            summary_rows = [
                ["Total Invoices", ds.get("total_invoices", 0)],
                ["Cancelled Invoices", ds.get("cancelled_invoices", 0)],
                ["Net Invoices", ds.get("net_invoices", 0)],
                ["Total Taxable Value", ex.safe_float(ds.get("total_taxable"))],
                ["Total IGST", ex.safe_float(ds.get("total_igst"))],
                ["Total CGST", ex.safe_float(ds.get("total_cgst"))],
                ["Total SGST", ex.safe_float(ds.get("total_sgst"))],
                ["Total Tax Liability", ex.safe_float(ds.get("total_tax"))],
                ["Total Invoice Value", ex.safe_float(ds.get("total_value"))]
            ]
            
            row = 9
            for label, val in summary_rows:
                sheet_sum.write(row, 0, label, ex.fmt_bold_border)
                if isinstance(val, (float, Decimal)):
                    sheet_sum.write(row, 1, ex.safe_float(val), ex.fmt_money)
                else:
                    sheet_sum.write(row, 1, val, ex.fmt_border)
                row += 1
            ex.set_column_widths(sheet_sum, [30, 20])

        excel_bytes = output.getvalue()
        
        if auto_open:
            try:
                temp_dir = tempfile.gettempdir()
                filename = f"GSTR1_{start_date}_to_{end_date}.xlsx"
                filepath = os.path.join(temp_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(excel_bytes)
                if os.name == 'nt':
                    os.startfile(filepath)
            except Exception as e:
                print(f"Failed to auto-open Excel: {str(e)}")

        return excel_bytes
        
        if auto_open:
            try:
                temp_dir = tempfile.gettempdir()
                filename = f"GSTR1_{start_date}_to_{end_date}.xlsx"
                filepath = os.path.join(temp_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(excel_bytes)
                if os.name == 'nt':
                    os.startfile(filepath)
            except Exception as e:
                print(f"Failed to auto-open Excel: {str(e)}")

        return excel_bytes

    async def get_gstr2_data(self, start_date: date, end_date: date) -> dict:
        """Fetch and aggregate GSTR2 (Inward Supplies) data for a period."""
        from app.models import PurchaseBill, Supplier, Company, PurchaseBillItem, PurchaseOrder, PurchaseOrderItem, Product
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select, func
        # pyrefly: ignore [missing-import]
        from sqlalchemy.orm import selectinload

        # 1. Fetch Company Info
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else "",
            "state": company.registered_state if company else "",
            "state_code": company.gst_number[0:2] if company and company.gst_number else ""
        }

        # 2. Fetch Purchase Bills
        bill_stmt = (
            select(PurchaseBill)
            .options(
                selectinload(PurchaseBill.supplier),
                selectinload(PurchaseBill.items).selectinload(PurchaseBillItem.product),
                selectinload(PurchaseBill.purchase_order).selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product)
            )
            .where(
                PurchaseBill.company_id == self.company_id,
                PurchaseBill.bill_date.between(start_date, end_date),
                PurchaseBill.status != "CANCELLED"
            )
        )
        bill_res = await self.db.execute(bill_stmt)
        bills = bill_res.scalars().all()

        # 3. Aggregators
        b2b = []
        b2bur = [] # Unregistered
        hsn_summary = {}
        doc_summary = {
            "total_bills": 0,
            "total_taxable": Decimal("0.00"),
            "total_igst": Decimal("0.00"),
            "total_cgst": Decimal("0.00"),
            "total_sgst": Decimal("0.00"),
            "total_tax": Decimal("0.00"),
            "total_value": Decimal("0.00")
        }

        for bill in bills:
            doc_summary["total_bills"] += 1
            doc_summary["total_value"] += (bill.total or Decimal("0"))
            doc_summary["total_taxable"] += (bill.subtotal or Decimal("0"))
            doc_summary["total_tax"] += (bill.tax_amount or Decimal("0"))
            doc_summary["total_igst"] += (bill.igst_amount or Decimal("0"))
            doc_summary["total_cgst"] += (bill.cgst_amount or Decimal("0"))
            doc_summary["total_sgst"] += (bill.sgst_amount or Decimal("0"))
            
            sup = bill.supplier
            is_registered = bool(sup.gst_number and len(sup.gst_number) == 15)
            
            bill_data = {
                "gstin": sup.gst_number or "URP",
                "supplier_name": sup.name,
                "bill_no": bill.bill_number,
                "date": bill.bill_date,
                "value": bill.total or Decimal("0"),
                "taxable_value": bill.subtotal or Decimal("0"),
                "igst": bill.igst_amount or Decimal("0"),
                "cgst": bill.cgst_amount or Decimal("0"),
                "sgst": bill.sgst_amount or Decimal("0"),
                "total_tax": bill.tax_amount or Decimal("0")
            }

            if is_registered:
                b2b.append(bill_data)
            else:
                b2bur.append(bill_data)

            # HSN Summary
            is_interstate = bill.gst_type == "IGST"
            bill_items = getattr(bill, "items", None) or (bill.purchase_order.items if (getattr(bill, "purchase_order", None) and bill.purchase_order.items) else [])
            for item in bill_items:
                hsn = getattr(item, "hsn_code", None) or "NA"
                if hsn not in hsn_summary:
                    hsn_summary[hsn] = {
                        "hsn": hsn,
                        "description": item.product.name if item.product else "N/A",
                        "uom": item.product.unit if item.product else "NOS",
                        "qty": 0.0,
                        "taxable_value": Decimal("0.00"),
                        "igst": Decimal("0.00"),
                        "cgst": Decimal("0.00"),
                        "sgst": Decimal("0.00")
                    }
                hsn_summary[hsn]["qty"] += float(item.quantity)
                hsn_summary[hsn]["taxable_value"] += (item.quantity * item.unit_price)
                if is_interstate:
                    hsn_summary[hsn]["igst"] += item.tax_amount
                else:
                    hsn_summary[hsn]["cgst"] += item.tax_amount / 2
                    hsn_summary[hsn]["sgst"] += item.tax_amount / 2

        # 4. Fetch Debit Notes (Purchase Returns)
        from app.models import DebitNote
        dn_stmt = (
            select(DebitNote)
            .options(selectinload(DebitNote.supplier))
            .where(
                DebitNote.company_id == self.company_id,
                DebitNote.note_date.between(start_date, end_date),
                DebitNote.status != "CANCELLED"
            )
        )
        dn_res = await self.db.execute(dn_stmt)
        dns = dn_res.scalars().all()
        cdn = []

        for dn in dns:
            sup = dn.supplier
            note_data = {
                "gstin": sup.gst_number or "URP",
                "supplier_name": sup.name,
                "note_no": dn.note_number,
                "date": dn.note_date,
                "note_type": "D", # Debit Note
                "value": dn.total or Decimal("0"),
                "taxable_value": dn.subtotal or Decimal("0"),
                "igst": dn.igst_amount or Decimal("0"),
                "cgst": dn.cgst_amount or Decimal("0"),
                "sgst": dn.sgst_amount or Decimal("0"),
                "total_tax": dn.tax_amount or Decimal("0")
            }
            cdn.append(note_data)
            
            # Reduce from HSN Summary (Approximation based on taxable value)
            # In a perfect world, we'd loop through DebitNoteItems
            
        return {
            "company": comp_info,
            "period": {"start": start_date.strftime("%d-%b-%Y"), "end": end_date.strftime("%d-%b-%Y")},
            "b2b": b2b,
            "b2bur": b2bur,
            "cdn": cdn,
            "hsn": list(hsn_summary.values()),
            "doc_summary": doc_summary
        }

    async def generate_gstr2_pdf(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional GSTR-2 Report PDF."""
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        
        data = await self.get_gstr2_data(start_date, end_date)
        
        template = self.jinja_env.get_template("gstr2.html")
        html_out = template.render(
            gstr2=data,
            now=datetime.now(),
            landscape=self.landscape
        )
        
        return await self._generate_pdf(html_out)

    async def get_gstr2_summary_data(self, start_date: date, end_date: date) -> dict:
        """Fetch inward purchase summary data grouped month-by-month for GSTR-9 analysis."""
        from app.models import PurchaseBill, Supplier, Company, DebitNote
        # pyrefly: ignore [missing-import]
        from sqlalchemy import select
        # pyrefly: ignore [missing-import]
        from sqlalchemy.orm import selectinload
        from decimal import Decimal

        # Generate list of month keys (e.g. "Apr-26")
        months = []
        curr = start_date.replace(day=1)
        while curr <= end_date:
            months.append(curr.strftime("%b-%y"))
            # advance to next month
            if curr.month == 12:
                curr = curr.replace(year=curr.year + 1, month=1)
            else:
                curr = curr.replace(month=curr.month + 1)

        # Initialize dictionary for each category
        categories = ["B2B", "B2BUR", "IMPS", "IMPG", "CDNR", "CDNUR", "AT", "ATADJ", "EXEMP", "ITCR", "HSNSUM"]
        row_names = ["TAXABLE AMOUNT", "INTEGRATED TAX", "CENTRAL GSTTAX", "STATE GST-TAX", "CESS GST-TAX", "TOTAL AMOUNTRS"]
        
        report_structure = {}
        for cat in categories:
            report_structure[cat] = {row: {m: Decimal("0.00") for m in months} for row in row_names}

        # Fetch Purchase Bills
        bill_stmt = (
            select(PurchaseBill)
            .options(selectinload(PurchaseBill.supplier))
            .where(
                PurchaseBill.company_id == self.company_id,
                PurchaseBill.bill_date.between(start_date, end_date),
                PurchaseBill.status != "CANCELLED"
            )
        )
        bill_res = await self.db.execute(bill_stmt)
        bills = bill_res.scalars().all()

        # Fetch Debit Notes (Purchase Returns)
        dn_stmt = (
            select(DebitNote)
            .options(selectinload(DebitNote.supplier))
            .where(
                DebitNote.company_id == self.company_id,
                DebitNote.note_date.between(start_date, end_date),
                DebitNote.status != "CANCELLED"
            )
        )
        dn_res = await self.db.execute(dn_stmt)
        dns = dn_res.scalars().all()

        for bill in bills:
            month_key = bill.bill_date.strftime("%b-%y")
            if month_key not in months:
                continue
                
            sup = bill.supplier
            is_registered = bool(sup.gst_number and len(sup.gst_number) == 15)
            
            # Determine Category
            gst_t = getattr(bill, "gst_type", "").upper()
            if "IMPORT_SERVICES" in gst_t or "IMPORT SERVICES" in gst_t:
                cat = "IMPS"
            elif "IMPORT_GOODS" in gst_t or "IMPORT GOODS" in gst_t:
                cat = "IMPG"
            elif is_registered:
                cat = "B2B"
            else:
                cat = "B2BUR"

            report_structure[cat]["TAXABLE AMOUNT"][month_key] += bill.subtotal
            report_structure[cat]["INTEGRATED TAX"][month_key] += bill.igst_amount
            report_structure[cat]["CENTRAL GSTTAX"][month_key] += bill.cgst_amount
            report_structure[cat]["STATE GST-TAX"][month_key] += bill.sgst_amount
            report_structure[cat]["CESS GST-TAX"][month_key] += Decimal("0.00")
            report_structure[cat]["TOTAL AMOUNTRS"][month_key] += bill.total
            
            # Sum into HSNSUM
            report_structure["HSNSUM"]["TAXABLE AMOUNT"][month_key] += bill.subtotal
            report_structure["HSNSUM"]["INTEGRATED TAX"][month_key] += bill.igst_amount
            report_structure["HSNSUM"]["CENTRAL GSTTAX"][month_key] += bill.cgst_amount
            report_structure["HSNSUM"]["STATE GST-TAX"][month_key] += bill.sgst_amount
            report_structure["HSNSUM"]["CESS GST-TAX"][month_key] += Decimal("0.00")
            report_structure["HSNSUM"]["TOTAL AMOUNTRS"][month_key] += bill.total

        for dn in dns:
            # note_date can be datetime, convert to date
            note_date = dn.note_date.date() if isinstance(dn.note_date, datetime) else dn.note_date
            month_key = note_date.strftime("%b-%y")
            if month_key not in months:
                continue
                
            sup = dn.supplier
            is_registered = bool(sup.gst_number and len(sup.gst_number) == 15)
            
            cat = "CDNR" if is_registered else "CDNUR"
            
            report_structure[cat]["TAXABLE AMOUNT"][month_key] += dn.subtotal
            report_structure[cat]["INTEGRATED TAX"][month_key] += dn.igst_amount
            report_structure[cat]["CENTRAL GSTTAX"][month_key] += dn.cgst_amount
            report_structure[cat]["STATE GST-TAX"][month_key] += dn.sgst_amount
            report_structure[cat]["CESS GST-TAX"][month_key] += Decimal("0.00")
            report_structure[cat]["TOTAL AMOUNTRS"][month_key] += dn.total

        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else "",
            "state": company.registered_state if company else "",
            "state_code": company.gst_number[0:2] if company and company.gst_number else ""
        }

        serialized_data = {}
        for cat, rows in report_structure.items():
            serialized_data[cat] = {}
            for row, vals in rows.items():
                serialized_data[cat][row] = {}
                row_total = Decimal("0.00")
                for m in months:
                    val = vals[m]
                    row_total += val
                    serialized_data[cat][row][m] = float(val)
                serialized_data[cat][row]["TOTAL"] = float(row_total)

        return {
            "company": comp_info,
            "period": {"start": start_date.strftime("%d-%b-%Y"), "end": end_date.strftime("%d-%b-%Y")},
            "months": months,
            "data": serialized_data
        }

    async def generate_gstr2_summary_pdf(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional GSTR-2 Summary Report PDF."""
        # pyrefly: ignore [missing-import]
        from fastapi.encoders import jsonable_encoder
        import json
        
        data = await self.get_gstr2_summary_data(start_date, end_date)
        
        template = self.jinja_env.get_template("gstr2_summary.html")
        html_out = template.render(
            report=data,
            report_json=json.dumps(jsonable_encoder(data)),
            now=datetime.now(),
            landscape=self.landscape
        )
        
        return await self._generate_pdf(html_out)

    async def generate_gstr2_summary_excel(self, start_date: date, end_date: date) -> bytes:
        """Generates a professional GSTR-2 Summary monthly spreadsheet (GSTR-9 format)."""
        data = await self.get_gstr2_summary_data(start_date, end_date)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, data["company"], "GSTR-2 SUMMARY MATRIX (FOR GSTR-9 INWARD)", data["period"])
            
            category_map = {
                "B2B": "B2B",
                "B2BUR": "B2BUR",
                "IMPS": "IMPS",
                "IMPG": "IMPG",
                "CDNR": "CDNR",
                "CDNUR": "CDNUR"
            }
            
            row_labels = ["TAXABLE AMOUNT", "INTEGRATED TAX", "CENTRAL GSTTAX", "STATE GST-TAX", "CESS GST-TAX", "TOTAL AMOUNTRS"]
            
            for key, tab_name in category_map.items():
                cat_data = data["data"].get(key)
                if not cat_data: continue
                
                sheet = writer.book.add_worksheet(tab_name[:31])
                ex.write_standard_header(sheet, f"Inward Supply Analysis Matrix: {tab_name}", len(data["months"]), len(data["months"]) + 1)
                
                sheet.write(8, 0, "GST TAX-TYPE HEAD", ex.fmt_table_header)
                for col_idx, m_name in enumerate(data["months"]):
                    sheet.write(8, col_idx + 1, m_name, ex.fmt_table_header)
                sheet.write(8, len(data["months"]) + 1, "TOTAL AMOUNT", ex.fmt_table_header)
                
                row = 9
                for label in row_labels:
                    row_val_data = cat_data.get(label, {})
                    is_total = (label == "TOTAL AMOUNTRS")
                    
                    sheet.write(row, 0, label, ex.fmt_total_label if is_total else ex.fmt_bold_border)
                    for col_idx, m_name in enumerate(data["months"]):
                        val = ex.safe_float(row_val_data.get(m_name, 0.0))
                        sheet.write(row, col_idx + 1, val, ex.fmt_money_bold if is_total else ex.fmt_money)
                    
                    total_val = ex.safe_float(row_val_data.get("TOTAL", 0.0))
                    sheet.write(row, len(data["months"]) + 1, total_val, ex.fmt_money_bold if is_total else ex.fmt_money)
                    row += 1
                
                col_widths = [20] + [12] * len(data["months"]) + [15]
                ex.set_column_widths(sheet, col_widths)
                
        return output.getvalue()

    async def generate_gstr2_excel(self, start_date: date, end_date: date, auto_open: bool = False) -> bytes:
        """
        Generates a professional, stylized GSTR-2 report in Excel format.
        Matches the "Industrial Symmetry" aesthetic of the ERP system.
        """
        data = await self.get_gstr2_data(start_date, end_date)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter', engine_kwargs={'options': {'remove_timezone': True}}) as writer:
            ex = IndustrialExcelWriter(writer.book, data["company"], "GSTR-2 REPORT (INWARD SUPPLIES)", data["period"])
            
            # 1. B2B Sheet
            sheet_b2b = writer.book.add_worksheet('B2B')
            ex.write_standard_header(sheet_b2b, "1. Inward Supplies from Registered Suppliers (B2B)", len(data["b2b"]), 8)
            headers = ["GSTIN", "Supplier Name", "Bill No.", "Date", "Taxable Value", "Integrated Tax", "Central Tax", "State Tax"]
            for col_num, header in enumerate(headers):
                sheet_b2b.write(8, col_num, header, ex.fmt_table_header)
            
            row = 9
            for bill in data["b2b"]:
                sheet_b2b.write(row, 0, bill.get("gstin", "URP"), ex.fmt_bold_border)
                sheet_b2b.write(row, 1, bill.get("supplier_name", "N/A"), ex.fmt_border)
                sheet_b2b.write(row, 2, bill.get("bill_no", "-"), ex.fmt_border)
                sheet_b2b.write(row, 3, bill.get("date"), ex.fmt_date)
                sheet_b2b.write(row, 4, ex.safe_float(bill.get("taxable_value")), ex.fmt_money)
                sheet_b2b.write(row, 5, ex.safe_float(bill.get("igst")), ex.fmt_money)
                sheet_b2b.write(row, 6, ex.safe_float(bill.get("cgst")), ex.fmt_money)
                sheet_b2b.write(row, 7, ex.safe_float(bill.get("sgst")), ex.fmt_money)
                row += 1
            ex.set_column_widths(sheet_b2b, [20, 25, 15, 12, 15, 15, 15, 15])

            # 2. B2BUR Sheet (Unregistered)
            sheet_bur = writer.book.add_worksheet('B2BUR')
            ex.write_standard_header(sheet_bur, "2. Inward Supplies from Unregistered Suppliers (B2BUR)", len(data["b2bur"]), 8)
            for col_num, header in enumerate(headers):
                sheet_bur.write(8, col_num, header, ex.fmt_table_header)
            
            row = 9
            for bill in data["b2bur"]:
                sheet_bur.write(row, 0, "URP", ex.fmt_bold_border)
                sheet_bur.write(row, 1, bill.get("supplier_name", "N/A"), ex.fmt_border)
                sheet_bur.write(row, 2, bill.get("bill_no", "-"), ex.fmt_border)
                sheet_bur.write(row, 3, bill.get("date"), ex.fmt_date)
                sheet_bur.write(row, 4, ex.safe_float(bill.get("taxable_value")), ex.fmt_money)
                sheet_bur.write(row, 5, ex.safe_float(bill.get("igst")), ex.fmt_money)
                sheet_bur.write(row, 6, ex.safe_float(bill.get("cgst")), ex.fmt_money)
                sheet_bur.write(row, 7, ex.safe_float(bill.get("sgst")), ex.fmt_money)
                row += 1
            ex.set_column_widths(sheet_bur, [20, 25, 15, 12, 15, 15, 15, 15])

            # 3. CDN Sheet
            sheet_cdn = writer.book.add_worksheet('Returns (CDN)')
            ex.write_standard_header(sheet_cdn, "3. Credit/Debit Notes (Returns)", len(data["cdn"]), 7)
            headers_cdn = ["GSTIN", "Supplier Name", "Note No.", "Date", "Note Type", "Taxable Value", "Tax Amt"]
            for col_num, header in enumerate(headers_cdn):
                sheet_cdn.write(8, col_num, header, ex.fmt_table_header)
            
            row = 9
            for note in data["cdn"]:
                sheet_cdn.write(row, 0, note.get("gstin", "URP"), ex.fmt_bold_border)
                sheet_cdn.write(row, 1, note.get("supplier_name", "N/A"), ex.fmt_border)
                sheet_cdn.write(row, 2, note.get("note_no", "-"), ex.fmt_border)
                sheet_cdn.write(row, 3, note.get("date"), ex.fmt_date)
                sheet_cdn.write(row, 4, "Debit Note" if note.get("note_type") == "D" else "Credit Note", ex.fmt_border)
                sheet_cdn.write(row, 5, ex.safe_float(note.get("taxable_value")), ex.fmt_money)
                sheet_cdn.write(row, 6, ex.safe_float(note.get("total_tax")), ex.fmt_money)
                row += 1
            ex.set_column_widths(sheet_cdn, [20, 25, 15, 12, 15, 15, 15])

            # 4. HSN Sheet
            sheet_hsn = writer.book.add_worksheet('HSN Summary')
            ex.write_standard_header(sheet_hsn, "4. HSN Summary of Inward Supplies", len(data["hsn"]), 6)
            headers_hsn = ["HSN Code", "Description", "UOM", "Qty", "Taxable Value", "Total Value"]
            for col_num, header in enumerate(headers_hsn):
                sheet_hsn.write(8, col_num, header, ex.fmt_table_header)
            
            row = 9
            for item in data["hsn"]:
                sheet_hsn.write(row, 0, item.get("hsn", "NA"), ex.fmt_bold_border)
                sheet_hsn.write(row, 1, item.get("description", "N/A"), ex.fmt_border)
                sheet_hsn.write(row, 2, item.get("uom", "NOS"), ex.fmt_border)
                sheet_hsn.write(row, 3, ex.safe_float(item.get("qty")), ex.fmt_border)
                sheet_hsn.write(row, 4, ex.safe_float(item.get("taxable_value")), ex.fmt_money)
                tax_amt = ex.safe_float(item.get("igst",0)+item.get("cgst",0)+item.get("sgst",0))
                sheet_hsn.write(row, 5, ex.safe_float(ex.safe_float(item.get("taxable_value")) + tax_amt), ex.fmt_money)
                row += 1
            ex.set_column_widths(sheet_hsn, [15, 30, 10, 12, 15, 15])

            # 5. Doc Summary Sheet
            sheet_sum = writer.book.add_worksheet('Doc Summary')
            ex.write_standard_header(sheet_sum, "5. Inward Supplies Document Summary", None, 2)
            headers_sum = ["Metric", "Value"]
            for col_num, header in enumerate(headers_sum):
                sheet_sum.write(8, col_num, header, ex.fmt_table_header)
            
            ds = data.get("doc_summary", {})
            summary_rows = [
                ["Total Bills", ds.get("total_bills", 0)],
                ["Cancelled/Returned", ds.get("cancelled_bills", 0)],
                ["Net Purchase Bills", ds.get("net_bills", 0)],
                ["Total Taxable Value", ex.safe_float(ds.get("total_taxable"))],
                ["Total IGST", ex.safe_float(ds.get("total_igst"))],
                ["Total CGST", ex.safe_float(ds.get("total_cgst"))],
                ["Total SGST", ex.safe_float(ds.get("total_sgst"))],
                ["Total Input Tax Credit", ex.safe_float(ds.get("total_tax"))],
                ["Total Purchase Value", ex.safe_float(ds.get("total_value"))]
            ]
            
            row = 9
            for label, val in summary_rows:
                sheet_sum.write(row, 0, label, ex.fmt_bold_border)
                if isinstance(val, (float, Decimal)):
                    sheet_sum.write(row, 1, ex.safe_float(val), ex.fmt_money)
                else:
                    sheet_sum.write(row, 1, val, ex.fmt_border)
                row += 1
            ex.set_column_widths(sheet_sum, [30, 20])

        excel_bytes = output.getvalue()
        
        if auto_open:
            try:
                temp_dir = tempfile.gettempdir()
                filename = f"GSTR2_{start_date}_to_{end_date}.xlsx"
                filepath = os.path.join(temp_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(excel_bytes)
                if os.name == 'nt':
                    os.startfile(filepath)
            except Exception as e:
                print(f"Failed to auto-open Excel: {str(e)}")

        return excel_bytes

    async def get_trial_balance_data(self) -> dict:
        from app.models import Company, Account, JournalEntryLine, JournalEntry
        from sqlalchemy import select, func
        from decimal import Decimal
        from datetime import datetime

        # Fetch Company Info
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else "",
            "contact": (company.phone or company.mobile_no or "") if company else "",
            "email": company.email if company else ""
        }

        # Fetch all accounts
        acc_stmt = select(Account).where(Account.company_id == self.company_id)
        acc_res = await self.db.execute(acc_stmt)
        accounts = acc_res.scalars().all()
        
        # Fetch aggregated debit/credit sums per account
        agg_stmt = (
            select(
                JournalEntryLine.account_id,
                func.sum(JournalEntryLine.debit).label("total_debit"),
                func.sum(JournalEntryLine.credit).label("total_credit")
            )
            .join(JournalEntry)
            .where(JournalEntry.company_id == self.company_id)
            .where(JournalEntry.is_posted == True)
            .group_by(JournalEntryLine.account_id)
        )
        agg_res = await self.db.execute(agg_stmt)
        agg_data = {row.account_id: (row.total_debit or Decimal("0.00"), row.total_credit or Decimal("0.00")) for row in agg_res.all()}
        
        tb_accounts = []
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")
        
        for acc in accounts:
            deb, cred = agg_data.get(acc.id, (Decimal("0.00"), Decimal("0.00")))
            opening = acc.opening_balance or Decimal("0.00")
            
            if acc.account_type in ("ASSET", "EXPENSE"):
                net = opening + deb - cred
            else:
                net = opening + cred - deb
                
            tb_accounts.append({
                "account_id": str(acc.id),
                "account_name": acc.name,
                "account_type": acc.account_type,
                "account_subtype": acc.account_subtype or "",
                "opening_balance": float(opening),
                "total_debit": float(deb),
                "total_credit": float(cred),
                "net_balance": float(net)
            })
            total_debit += deb
            total_credit += cred
            
        return {
            "companyInfo": comp_info,
            "accounts": tb_accounts,
            "total_debit": float(total_debit),
            "total_credit": float(total_credit),
            "generated_on": datetime.now().strftime("%Y-%m-%d %H:%M")
        }

    async def generate_trial_balance_pdf(self) -> bytes:
        from fastapi.encoders import jsonable_encoder
        import json
        data = await self.get_trial_balance_data()
        template = self.jinja_env.get_template("trial_balance.html")
        html_out = template.render(
            report_data_json=json.dumps(jsonable_encoder(data)),
            landscape=self.landscape
        )
        try:
            pdf_bytes = await self._generate_pdf(html_out)
            return pdf_bytes
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(e)}")

    async def get_gst_summary_data(self) -> dict:
        from app.models import Company, Invoice, PurchaseBill
        from sqlalchemy import select, func
        from datetime import datetime

        # Fetch Company Info
        comp_res = await self.db.execute(select(Company).where(Company.id == self.company_id))
        company = comp_res.scalar_one_or_none()
        comp_info = {
            "name": company.name if company else "Company",
            "gst_number": company.gst_number if company and company.gst_number else "",
            "address": company.office_address_1 if company else "",
            "contact": (company.phone or company.mobile_no or "") if company else "",
            "email": company.email if company else ""
        }

        # Total sales & output tax
        sales_stmt = select(
            func.sum(Invoice.subtotal).label("subtotal"),
            func.sum(Invoice.tax_amount).label("tax")
        ).where(Invoice.company_id == self.company_id, Invoice.status != "CANCELLED")
        sales_res = await self.db.execute(sales_stmt)
        sales_row = sales_res.first()
        
        # Total purchases & ITC
        purch_stmt = select(
            func.sum(PurchaseBill.subtotal).label("subtotal"),
            func.sum(PurchaseBill.tax_amount).label("tax")
        ).where(PurchaseBill.company_id == self.company_id, PurchaseBill.status != "CANCELLED")
        purch_res = await self.db.execute(purch_stmt)
        purch_row = purch_res.first()
        
        total_sales_value = float(sales_row.subtotal or 0.0) if sales_row else 0.0
        output_tax = float(sales_row.tax or 0.0) if sales_row else 0.0
        total_purchases_value = float(purch_row.subtotal or 0.0) if purch_row else 0.0
        itc_claimed = float(purch_row.tax or 0.0) if purch_row else 0.0
        net_tax_payable = output_tax - itc_claimed

        return {
            "companyInfo": comp_info,
            "total_sales_value": total_sales_value,
            "output_tax": output_tax,
            "total_purchases_value": total_purchases_value,
            "itc_claimed": itc_claimed,
            "net_tax_payable": net_tax_payable,
            "generated_on": datetime.now().strftime("%Y-%m-%d %H:%M")
        }

    async def generate_gst_summary_pdf(self) -> bytes:
        from fastapi.encoders import jsonable_encoder
        import json
        data = await self.get_gst_summary_data()
        template = self.jinja_env.get_template("gst_summary.html")
        html_out = template.render(
            report_data_json=json.dumps(jsonable_encoder(data)),
            landscape=self.landscape
        )
        try:
            pdf_bytes = await self._generate_pdf(html_out)
            return pdf_bytes
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(e)}")
