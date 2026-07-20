from app.database import SyncSessionLocal
from app.models import User, Company

session = SyncSessionLocal()
try:
    users = session.query(User).all()
    print("--- USERS ---")
    for u in users:
        print(f"Email: {u.email} | Phone: {u.phone} | Name: {u.full_name} | Active: {u.is_active}")
    
    companies = session.query(Company).all()
    print("--- COMPANIES ---")
    for c in companies:
        print(f"ID: {c.id} | Name: {c.name}")
finally:
    session.close()
