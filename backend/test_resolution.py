import asyncio
from app.database import AsyncSessionLocal
from app.models import User, Company, Invoice, PurchaseBill, Customer
from app.services.auth import AuthService
from sqlalchemy import select, func

async def test_auto_login():
    async with AsyncSessionLocal() as db:
        auth_svc = AuthService(db)
        login_res = await auth_svc.local_auto_login()
        if not login_res:
            print("Auto login failed!")
            return
        user_data = login_res.user
        comp_data = login_res.company
        tokens = login_res.tokens
        print(f"\n=== AUTO LOGIN RESOLUTION ===")
        print(f"Logged in User ID: {user_data.id}")
        print(f"Logged in User Email: {user_data.email}")
        print(f"Logged in User's company_id: {user_data.company_id}")
        print(f"Active Company Resolved: '{comp_data.name}' (ID: {comp_data.id}, Active: {comp_data.is_active})")
        print(f"Token Issued for Company ID: {tokens.company_id}")

        # Now test get_kpis query logic for this active company
        co_id = comp_data.id
        total_sales = await db.scalar(
            select(func.sum(Invoice.total)).where(Invoice.company_id == co_id)
        ) or 0
        total_receivable = await db.scalar(
            select(func.sum(Invoice.balance_due)).where(Invoice.company_id == co_id)
        ) or 0
        total_payable = await db.scalar(
            select(func.sum(PurchaseBill.balance_due)).where(PurchaseBill.company_id == co_id)
        ) or 0
        active_cust = await db.scalar(
            select(func.count(Customer.id)).where(Customer.company_id == co_id, Customer.is_active == True)
        ) or 0

        print(f"\n--- KPIS FOR RESOLVED COMPANY '{comp_data.name}' ({co_id}) ---")
        print(f"Total Sales: ₹{total_sales}")
        print(f"Total Receivable: ₹{total_receivable}")
        print(f"Total Payable: ₹{total_payable}")
        print(f"Active Customers: {active_cust}")

if __name__ == "__main__":
    asyncio.run(test_auto_login())
