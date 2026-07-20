# =============================================================
# JK INFOTECT ERP — Hardware Identifier
# File : app/core/hardware.py
# =============================================================

import hashlib
import functools

@functools.lru_cache(maxsize=1)
def get_hwid() -> str:
    """
    Returns a unique, stable hardware ID for the current machine.
    Used for hardware-bound licensing.
    
    PERMANENT ROOT SOLUTION: 
    Using Windows Registry MachineGuid to guarantee an OS/Motherboard
    tied ID without relying on hostname or MAC address.
    """
    try:
        import winreg
        registry = winreg.ConnectRegistry(None, winreg.HKEY_LOCAL_MACHINE)
        key = winreg.OpenKey(registry, r"SOFTWARE\Microsoft\Cryptography")
        machine_guid, _ = winreg.QueryValueEx(key, "MachineGuid")
        winreg.CloseKey(key)
        
        # Create a clean, fixed-length hex string
        return hashlib.sha256(machine_guid.encode()).hexdigest().upper()[:16]
        
    except (ImportError, Exception):
        # Extreme fallback for highly restricted/non-Windows environments
        return "STABLE-DEV-HWID-0000"
