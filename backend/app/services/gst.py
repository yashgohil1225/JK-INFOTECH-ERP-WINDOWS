# =============================================================
# JK INFOTECT ERP — GST Service
# File : app/services/gst.py
# =============================================================

from sqlalchemy.ext.asyncio import AsyncSession

class GSTService:
    """
    Service for GST verification. 
    In production, this would call a government API or a 3rd party provider.
    """
    async def verify_gst(self, gstin: str, db: AsyncSession):
        """
        Mock GST verification for development.
        """
        # Basic format check (15 chars)
        if len(gstin) != 15:
            return {"is_valid": False, "error": "Invalid GSTIN format. Must be 15 characters."}

        # Mock success response
        return {
            "is_valid":    True,
            "gstin":       gstin.upper(),
            "legal_name":  "JK INDUSTRIAL SOLUTIONS PVT LTD",
            "trade_name":  "JK SOLUTIONS",
            "status":      "Active",
            "state_code":  gstin[:2],
            "address":     "Plot 42, GIDC Industrial Estate, Sector 26, Gandhinagar, Gujarat",
        }

gst_service = GSTService()
