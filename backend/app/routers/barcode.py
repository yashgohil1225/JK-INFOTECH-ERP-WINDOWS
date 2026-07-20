# =============================================================
# JK INFOTECH ERP — Barcode Generator Router
# File : app/routers/barcode.py
# =============================================================

import random
from typing import List, Optional
from uuid import UUID
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from sqlalchemy import select

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_company
from app.models import Product, Company, User

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

@router.post("/print")
async def print_labels(
    request: BarcodeLabelRequest,
    db: AsyncSession = Depends(get_db),
    company: Company = Depends(get_current_company)
):
    """Stub endpoint for server-side barcode printing if needed in future."""
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
