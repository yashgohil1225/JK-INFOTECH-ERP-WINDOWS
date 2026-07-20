from app.database import SyncSessionLocal
from app.models import User
from app.services.auth import hash_password

session = SyncSessionLocal()
try:
    user = session.query(User).filter_by(email="yashgohil1225@gmail.com").first()
    if user:
        user.password_hash = hash_password("123456")
        user.pin_hash = hash_password("123456")
        user.pin_login_enabled = True
        user.failed_pin_attempts = 0
        user.pin_locked_until = None
        session.commit()
        print("Password and PIN reset to 123456 for yashgohil1225@gmail.com successful!")
    else:
        print("User not found!")
finally:
    session.close()
