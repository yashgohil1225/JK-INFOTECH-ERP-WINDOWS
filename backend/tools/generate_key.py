#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta, timezone

# Ensure the backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app.middleware.security_guard import sign_payload
except ImportError:
    print("Error: Could not import security_guard modules. Make sure you run this script from the backend directory.")
    sys.exit(1)

def generate_key(hwid: str, duration_months: str) -> str:
    """
    Generates a securely signed activation key for a given HWID and duration.
    """
    hwid = hwid.strip().upper()
    if not hwid:
        raise ValueError("Hardware ID (HWID) cannot be empty.")

    if duration_months.lower() == "lifetime":
        expires_at_str = "lifetime"
    else:
        try:
            months = int(duration_months)
            if months <= 0:
                raise ValueError()
        except ValueError:
            raise ValueError("Duration must be a positive integer or 'lifetime'.")
            
        # Calculate expiration based on current UTC time
        now = datetime.now(timezone.utc)
        expires_time = now + timedelta(days=30 * months)
        expires_at_str = expires_time.isoformat()

    payload = {
        "hwid": hwid,
        "expires_at": expires_at_str
    }
    
    signed_key = sign_payload(payload)
    return signed_key

def main():
    print("=============================================")
    print("  JK INFOTECH ERP — OFFLINE KEY GENERATOR   ")
    print("=============================================\n")
    
    if len(sys.argv) >= 3:
        hwid = sys.argv[1]
        duration = sys.argv[2]
    else:
        hwid = input("Enter Target Machine's HWID: ").strip()
        duration = input("Enter Duration (in months, or 'lifetime'): ").strip()
        
    try:
        key = generate_key(hwid, duration)
        print("\n---------------------------------------------")
        print("SUCCESS! Generated Secure Activation Key:")
        print("---------------------------------------------")
        print(key)
        print("---------------------------------------------")
        print(f"Bound to HWID : {hwid.upper()}")
        print(f"Duration      : {duration} {'Month(s)' if duration != 'lifetime' else ''}")
        print("=============================================\n")
    except Exception as e:
        print(f"\n[ERROR] Generation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
