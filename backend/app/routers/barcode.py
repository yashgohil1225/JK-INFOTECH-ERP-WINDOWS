# =============================================================
# JK INFOTECH ERP — Barcode Generator Router
# File : app/routers/barcode.py
# =============================================================

import io
import random
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.graphics import renderPDF

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import Product, Company, User
from app.core.redis import cache_manager

router = APIRouter(prefix="/api/v1/barcode", tags=["Barcode"])

class BarcodeConfig(BaseModel):
    width: int
    height: int
    format: str
    include_text: bool

class BarcodeLabelRequest(BaseModel):
    product_id: UUID
    quantity: int
    config: BarcodeConfig

class BulkGenerateRequest(BaseModel):
    product_ids: List[UUID]

class BarcodeSheetItem(BaseModel):
    product_id: UUID
    quantity: int = 1

class BarcodeSheetRequest(BaseModel):
    items: List[BarcodeSheetItem]
    layout: str = "a4_24" # "a4_24", "a4_40", "a4_65", "thermal_50x25", "thermal_50x25_2up", "thermal_38x25"
    orientation: str = "landscape" # "portrait", "landscape"
    start_position: int = 1
    margin_offset_x: float = 0.0
    margin_offset_y: float = 0.0
    show_company: bool = True
    show_name: bool = True
    show_price: bool = True
    show_code: bool = True

def calculate_ean13_checksum(digits12: str) -> str:
    """EAN-13 checksum calculation."""
    total = sum(int(digit) * (3 if i % 2 == 1 else 1) for i, digit in enumerate(digits12))
    mod = total % 10
    checksum = 0 if mod == 0 else 10 - mod
    return str(checksum)

async def generate_unique_ean13(db: AsyncSession, company_id: UUID) -> str:
    """Generates a unique EAN-13 barcode starting with 290 prefix."""
    for _ in range(100):
        # 9 random digits for the manufacturer/product code
        rand_digits = "".join(str(random.randint(0, 9)) for _ in range(9))
        digits12 = f"290{rand_digits}"
        ean13 = digits12 + calculate_ean13_checksum(digits12)
        
        # Verify uniqueness
        result = await db.execute(
            select(Product).where(Product.company_id == company_id, Product.barcode == ean13)
        )
        if not result.scalar_one_or_none():
            return ean13
            
    raise ValueError("System saturated: Failed to generate a unique barcode.")

@router.post("/generate/{product_id}")
async def generate_barcode(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company),
    current_user: User = Depends(get_current_user)
):
    """Generate a unique EAN-13 barcode for a product."""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.company_id == company.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found in this registry."
        )
    if product.barcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Barcode has already been generated for this product and cannot be changed."
        )

    try:
        barcode = await generate_unique_ean13(db, company.id)
        product.barcode = barcode
        await db.commit()
        return {"barcode": barcode}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Barcode Generation Failure: {str(e)}"
        )

@router.post("/bulk-generate")
async def bulk_generate(
    payload: BulkGenerateRequest,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company),
    current_user: User = Depends(get_current_user)
):
    """Bulk generate unique EAN-13 barcodes for selected products."""
    result = await db.execute(
        select(Product).where(
            Product.id.in_(payload.product_ids),
            Product.company_id == company.id
        )
    )
    products = result.scalars().all()
    if not products:
        return {"count": 0}
        
    count = 0
    try:
        for product in products:
            if not product.barcode:
                barcode = await generate_unique_ean13(db, company.id)
                product.barcode = barcode
                count += 1
                
        if count > 0:
            await db.commit()
            
        return {"count": count}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk Generation Failure: {str(e)}"
        )

@router.get("/lookup/{code}")
async def lookup_barcode(
    code: str,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    """Lookup a product by its barcode."""
    result = await db.execute(
        select(Product).where(
            Product.barcode == code,
            Product.company_id == company.id
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Barcode not registered to any product."
        )
    return product

def draw_fitted_string(
    c: canvas.Canvas,
    text: str,
    cx: float,
    y: float,
    max_width: float,
    font_name: str = "Helvetica",
    initial_font_size: float = 7.0,
    min_font_size: float = 5.0
):
    """Draws centered text dynamically auto-scaled and truncated to fit within max_width."""
    if not text:
        return
    font_size = initial_font_size
    text_width = c.stringWidth(text, font_name, font_size)
    
    while text_width > max_width and font_size > min_font_size:
        font_size -= 0.5
        text_width = c.stringWidth(text, font_name, font_size)
        
    formatted_text = text
    if text_width > max_width:
        while len(formatted_text) > 2 and c.stringWidth(formatted_text + "...", font_name, min_font_size) > max_width:
            formatted_text = formatted_text[:-1]
        formatted_text = formatted_text + "..."
        font_size = min_font_size
        
    c.setFont(font_name, font_size)
    c.drawCentredString(cx, y, formatted_text)

def draw_fitted_barcode(
    c: canvas.Canvas,
    code: str,
    cx: float,
    y: float,
    max_width: float,
    max_height: float,
    font_size: float = 6.0
):
    """Draws a vector barcode (EAN13/Code128) dynamically scaled to fit within max_width and max_height."""
    if not code:
        code = "2901234567895"
        
    is_ean = len(code) == 13 and code.isdigit()
    btype = "EAN13" if is_ean else "Code128"
    
    try:
        drawing = createBarcodeDrawing(
            btype,
            value=code,
            width=max_width,
            height=max_height,
            humanReadable=True,
            fontSize=font_size
        )
        
        dw = float(drawing.width)
        dh = float(drawing.height)
        
        if dw > 0 and dh > 0:
            scale_x = max_width / dw if dw > max_width else 1.0
            scale_y = max_height / dh if dh > max_height else 1.0
            scale = min(scale_x, scale_y)
            
            if scale < 1.0:
                drawing.width = dw * scale
                drawing.height = dh * scale
                drawing.scale(scale, scale)
                
        render_x = cx - (drawing.width / 2.0)
        renderPDF.draw(drawing, c, render_x, y)
    except Exception:
        c.setFont("Helvetica-Bold", min(font_size, 7.0))
        c.drawCentredString(cx, y, f"[{code}]")

def build_barcode_pdf(
    items_data: list,
    layout: str,
    orientation: str = "landscape",
    start_position: int = 1,
    margin_offset_x: float = 0.0,
    margin_offset_y: float = 0.0,
    show_company: bool = True,
    show_name: bool = True,
    show_price: bool = True,
    company_name: str = "Company"
) -> bytes:
    buffer = io.BytesIO()
    is_portrait = (orientation.lower() == "portrait")
    
    if layout.startswith("thermal_"):
        # Thermal Roll Formats
        if layout == "thermal_38x25":
            p_w, p_h = 107.72, 70.87 # 38mm x 25mm in points
        elif layout == "thermal_50x25_2up":
            p_w, p_h = 283.46, 70.87 # 100mm x 25mm (Dual 50x25mm)
        else: # thermal_50x25
            p_w, p_h = 141.73, 70.87 # 50mm x 25mm in points
            
        c = canvas.Canvas(buffer, pagesize=(p_w, p_h))
        
        flat_labels = []
        for item in items_data:
            qty = item.get("quantity", 1)
            for _ in range(qty):
                flat_labels.append(item)
                
        if layout == "thermal_50x25_2up":
            # 2-up Dual Lane (2 stickers per row)
            cols = 2
            sub_w = p_w / 2.0
            for idx, item in enumerate(flat_labels):
                col = idx % cols
                if col == 0 and idx > 0:
                    c.showPage()
                    
                x_start = col * sub_w
                name = item.get("name", "Product")
                price = f"Rs. {item.get('sale_price', 0):,.2f}"
                code = item.get("barcode") or item.get("sku") or "2901234567895"
                
                c.setStrokeColorRGB(0.85, 0.85, 0.85)
                c.setLineWidth(0.4)
                c.rect(x_start + 1.5, 1.5, sub_w - 3, p_h - 3, fill=0, stroke=1)
                
                cx = x_start + (sub_w / 2.0)
                max_w = sub_w - 8.0
                cur_y = p_h - 8.5
                
                if show_company:
                    draw_fitted_string(c, company_name, cx, cur_y, max_w, font_name="Helvetica-Bold", initial_font_size=7.5, min_font_size=5.0)
                    cur_y -= 8.5
                if show_name:
                    draw_fitted_string(c, name, cx, cur_y, max_w, font_name="Helvetica", initial_font_size=6.5, min_font_size=5.0)
                    cur_y -= 8.5
                    
                barcode_bottom_y = 15.5 if show_price else 4.5
                barcode_max_h = max(14.0, cur_y - barcode_bottom_y - 2.0)
                draw_fitted_barcode(c, code, cx=cx, y=barcode_bottom_y, max_width=120.0, max_height=barcode_max_h, font_size=5.5)
                
                if show_price:
                    draw_fitted_string(c, f"MRP: {price}", cx, 6.5, max_w, font_name="Helvetica-Bold", initial_font_size=7.0, min_font_size=5.0)
                    
            c.showPage()
        else:
            # Single Thermal Roll (50x25 or 38x25)
            for item in flat_labels:
                name = item.get("name", "Product")
                price = f"Rs. {item.get('sale_price', 0):,.2f}"
                code = item.get("barcode") or item.get("sku") or "2901234567895"
                
                # Canvas 90° rotation for Portrait (Ladder Barcode) mode
                if is_portrait:
                    c.saveState()
                    # Physical paper is (p_w, p_h). Rotate 90° so content draws vertically along p_w
                    c.translate(0, p_h)
                    c.rotate(-90)
                    # Rotated space coordinates: width = p_h (25mm), height = p_w (50mm or 38mm)
                    rw, rh = p_h, p_w
                    
                    c.setStrokeColorRGB(0.85, 0.85, 0.85)
                    c.setLineWidth(0.4)
                    c.rect(1.5, 1.5, rw - 3, rh - 3, fill=0, stroke=1)
                    
                    cx = rw / 2.0
                    max_w = rw - 6.0 # 25mm - margins = ~64pt
                    cur_y = rh - 9.0 # start near top of rotated height
                    
                    if show_company:
                        draw_fitted_string(c, company_name, cx, cur_y, max_w, font_name="Helvetica-Bold", initial_font_size=7.0, min_font_size=5.0)
                        cur_y -= 9.0
                    if show_name:
                        draw_fitted_string(c, name, cx, cur_y, max_w, font_name="Helvetica", initial_font_size=6.5, min_font_size=5.0)
                        cur_y -= 9.0
                        
                    barcode_bottom_y = 16.0 if show_price else 5.0
                    barcode_max_h = max(16.0, cur_y - barcode_bottom_y - 2.0)
                    draw_fitted_barcode(c, code, cx=cx, y=barcode_bottom_y, max_width=60.0, max_height=barcode_max_h, font_size=5.0)
                    
                    if show_price:
                        draw_fitted_string(c, f"MRP: {price}", cx, 7.5, max_w, font_name="Helvetica-Bold", initial_font_size=7.0, min_font_size=5.0)
                        
                    c.restoreState()
                else:
                    # Landscape (0° Normal Picket Fence) mode
                    c.setStrokeColorRGB(0.85, 0.85, 0.85)
                    c.setLineWidth(0.4)
                    c.rect(1.5, 1.5, p_w - 3, p_h - 3, fill=0, stroke=1)
                    
                    cx = p_w / 2.0
                    max_w = p_w - 8.0
                    cur_y = p_h - 9.0
                    
                    if show_company:
                        draw_fitted_string(c, company_name, cx, cur_y, max_w, font_name="Helvetica-Bold", initial_font_size=7.5, min_font_size=5.0)
                        cur_y -= 9.0
                    if show_name:
                        draw_fitted_string(c, name, cx, cur_y, max_w, font_name="Helvetica", initial_font_size=6.5, min_font_size=5.0)
                        cur_y -= 9.0
                        
                    barcode_bottom_y = 16.0 if show_price else 5.0
                    barcode_max_h = max(14.0, cur_y - barcode_bottom_y - 2.0)
                    barcode_max_w = p_w - 10.0
                    draw_fitted_barcode(c, code, cx=cx, y=barcode_bottom_y, max_width=barcode_max_w, max_height=barcode_max_h, font_size=5.5)
                    
                    if show_price:
                        draw_fitted_string(c, f"MRP: {price}", cx, 7.5, max_w, font_name="Helvetica-Bold", initial_font_size=7.0, min_font_size=5.0)
                        
                c.showPage()
    else:
        # A4 Sheet Layouts (a4_24, a4_40, a4_65)
        offset_x_pt = margin_offset_x * 2.83465
        offset_y_pt = margin_offset_y * 2.83465
        
        if is_portrait:
            page_w, page_h = A4
            if layout == "a4_65":
                cols, rows = 5, 13
                margin_x, margin_y = 12 + offset_x_pt, 16 + offset_y_pt
            elif layout == "a4_40":
                cols, rows = 4, 10
                margin_x, margin_y = 14 + offset_x_pt, 20 + offset_y_pt
            else: # a4_24
                cols, rows = 3, 8
                margin_x, margin_y = 18 + offset_x_pt, 30 + offset_y_pt
        else: # Landscape A4
            page_w, page_h = A4[1], A4[0]
            if layout == "a4_65":
                cols, rows = 13, 5
                margin_x, margin_y = 16 + offset_x_pt, 12 + offset_y_pt
            elif layout == "a4_40":
                cols, rows = 5, 8
                margin_x, margin_y = 20 + offset_x_pt, 20 + offset_y_pt
            else: # a4_24
                cols, rows = 4, 6
                margin_x, margin_y = 24 + offset_x_pt, 24 + offset_y_pt
                
        c = canvas.Canvas(buffer, pagesize=(page_w, page_h))
        grid_w = (page_w - (margin_x * 2)) / cols
        grid_h = (page_h - (margin_y * 2)) / rows
        
        total_per_page = cols * rows
        start_idx = max(0, start_position - 1) # 0-indexed position on page 1
        
        flat_labels = []
        for item in items_data:
            qty = item.get("quantity", 1)
            for _ in range(qty):
                flat_labels.append(item)
                
        # Fill grid positions considering start_idx on page 1
        current_pos = start_idx
        for item in flat_labels:
            if current_pos > start_idx and current_pos % total_per_page == 0:
                c.showPage()
                
            page_slot = current_pos % total_per_page
            col = page_slot % cols
            row = page_slot // cols
            
            x = margin_x + (col * grid_w)
            y = page_h - margin_y - ((row + 1) * grid_h)
            
            c.setStrokeColorRGB(0.85, 0.85, 0.85)
            c.setLineWidth(0.4)
            c.rect(x + 2, y + 2, grid_w - 4, grid_h - 4, fill=0, stroke=1)
            
            label_cx = x + (grid_w / 2.0)
            max_w = grid_w - 6.0
            cur_y = y + grid_h - (10.0 if layout == "a4_65" else 12.0)
            
            if show_company:
                draw_fitted_string(
                    c, company_name, label_cx, cur_y, max_w,
                    font_name="Helvetica-Bold",
                    initial_font_size=8.0 if layout == "a4_24" else (6.5 if layout == "a4_65" else 7.0),
                    min_font_size=4.5
                )
                cur_y -= (8.0 if layout == "a4_65" else 10.0)
                
            if show_name:
                draw_fitted_string(
                    c, item.get("name", ""), label_cx, cur_y, max_w,
                    font_name="Helvetica",
                    initial_font_size=7.5 if layout == "a4_24" else (6.0 if layout == "a4_65" else 6.5),
                    min_font_size=4.5
                )
                cur_y -= (8.0 if layout == "a4_65" else 11.0)
                
            code = item.get("barcode") or item.get("sku") or "2901234567895"
            price_bottom_reserve = 15.5 if show_price else 4.0
            barcode_max_w = min(max_w, 110.0 if layout == "a4_24" else (70.0 if layout == "a4_65" else 85.0))
            barcode_max_h = max(12.0, cur_y - (y + price_bottom_reserve))
            
            draw_fitted_barcode(
                c, code, cx=label_cx, y=y+price_bottom_reserve,
                max_width=barcode_max_w,
                max_height=barcode_max_h,
                font_size=5.0 if layout == "a4_65" else 6.0
            )
            
            if show_price:
                price = f"MRP: Rs. {item.get('sale_price', 0):,.2f}"
                draw_fitted_string(
                    c, price, label_cx, y + 6.5, max_w,
                    font_name="Helvetica-Bold",
                    initial_font_size=8.0 if layout == "a4_24" else (6.5 if layout == "a4_65" else 7.0),
                    min_font_size=4.5
                )
                
            current_pos += 1
            
        c.showPage()
        
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

@router.post("/pdf-labels")
async def generate_pdf_labels(
    payload: BarcodeSheetRequest,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company),
    current_user: User = Depends(get_current_user)
):
    """Generate high-resolution vector barcode sticker sheet PDF for printing."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items specified for label generation.")
        
    item_map = {item.product_id: item.quantity for item in payload.items}
    product_ids = list(item_map.keys())
    
    result = await db.execute(
        select(Product).where(
            Product.id.in_(product_ids),
            Product.company_id == company.id
        )
    )
    products = result.scalars().all()
    if not products:
        raise HTTPException(status_code=404, detail="No matching products found.")
        
    items_data = []
    for prod in products:
        # Guarantee barcode exists
        if not prod.barcode:
            prod.barcode = await generate_unique_ean13(db, company.id)
            
        items_data.append({
            "name": prod.name,
            "sku": prod.sku,
            "barcode": prod.barcode,
            "sale_price": float(prod.sale_price or 0.0),
            "quantity": item_map.get(prod.id, 1)
        })
        
    await db.commit()
    
    # Generate PDF
    pdf_bytes = build_barcode_pdf(
        items_data=items_data,
        layout=payload.layout,
        orientation=payload.orientation,
        start_position=payload.start_position,
        margin_offset_x=payload.margin_offset_x,
        margin_offset_y=payload.margin_offset_y,
        show_company=payload.show_company,
        show_name=payload.show_name,
        show_price=payload.show_price,
        company_name=company.name
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=barcode_labels_{payload.layout}_{payload.orientation}.pdf",
            "X-Cache": "MISS"
        }
    )

@router.get("/pdf-labels")
async def get_pdf_labels(
    items: str = "",
    layout: str = "a4_24",
    orientation: str = "landscape",
    start_position: int = 1,
    margin_offset_x: float = 0.0,
    margin_offset_y: float = 0.0,
    show_company: bool = True,
    show_name: bool = True,
    show_price: bool = True,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company),
    current_user: User = Depends(get_current_user)
):
    """GET endpoint for vector barcode sticker sheet PDF."""
    item_map = {}
    if items:
        for pair in items.split(","):
            if ":" in pair:
                parts = pair.split(":")
                try:
                    p_id = UUID(parts[0].strip())
                    qty = int(parts[1].strip())
                    item_map[p_id] = max(1, qty)
                except Exception:
                    pass

    if not item_map:
        res = await db.execute(select(Product).where(Product.company_id == company.id).limit(50))
        products = res.scalars().all()
        item_map = {p.id: 1 for p in products}
    else:
        product_ids = list(item_map.keys())
        res = await db.execute(select(Product).where(Product.id.in_(product_ids), Product.company_id == company.id))
        products = res.scalars().all()

    if not products:
        raise HTTPException(status_code=404, detail="No matching products found.")

    items_data = []
    for prod in products:
        if not prod.barcode:
            prod.barcode = await generate_unique_ean13(db, company.id)
        items_data.append({
            "name": prod.name,
            "sku": prod.sku,
            "barcode": prod.barcode,
            "sale_price": float(prod.sale_price or 0.0),
            "quantity": item_map.get(prod.id, 1)
        })
    await db.commit()

    pdf_bytes = build_barcode_pdf(
        items_data=items_data,
        layout=layout,
        orientation=orientation,
        start_position=start_position,
        margin_offset_x=margin_offset_x,
        margin_offset_y=margin_offset_y,
        show_company=show_company,
        show_name=show_name,
        show_price=show_price,
        company_name=company.name
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=barcode_labels_{layout}_{orientation}.pdf",
            "X-Cache": "MISS"
        }
    )

@router.post("/print")
async def print_labels(
    request: BarcodeLabelRequest,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    """Legacy print endpoint stub."""
    return {"pdf_url": ""}


# --- Real-time Mobile Scanner Integration ---

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

class ScanPayload(BaseModel):
    barcode: str

@router.websocket("/ws/{session_id}")
async def ws_scanner(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            # Keep connection alive; accept pings/scans if any
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)

@router.post("/scan/{session_id}")
async def report_scan(session_id: str, payload: ScanPayload):
    """Broadcast scanned barcode to the PC session via websocket."""
    await manager.broadcast(session_id, {"barcode": payload.barcode})
    return {"status": "broadcasted", "barcode": payload.barcode}

@router.post("/connect/{session_id}")
async def report_connection(session_id: str):
    """Broadcast mobile connection status to the PC session via websocket."""
    await manager.broadcast(session_id, {"status": "mobile_connected"})
    return {"status": "broadcasted"}

@router.get("/local-ip")
async def get_local_ip():
    """Detect PC's local network IP for mobile device pairing."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Use dummy destination to resolve primary interface IP
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return {"ip": ip}
