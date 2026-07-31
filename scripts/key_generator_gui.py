# =====================================================================
# JK INFOTECH ERP — Official Developer License Key Generator Utility
# File: Y:\JK Infotech ERP\scripts\key_generator_gui.py
# =====================================================================

import os
import sys
import json
import base64
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
import tkinter as tk
from tkinter import ttk, messagebox

# ── Load Core Signing Configuration ──────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
workspace_root = os.path.abspath(os.path.join(script_dir, ".."))
backend_dir = os.path.join(workspace_root, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    # pyrefly: ignore [missing-import]
    from app.middleware.security_guard import sign_payload, verify_payload, SECRET_KEY
except Exception as e:
    # Fallback default key if import fails outside backend venv
    SECRET_KEY = b"jk_erp_industrial_security_2026_super_secret_integrity_key"
    def sign_payload(payload_dict: dict) -> str:
        payload_str = base64.b64encode(json.dumps(payload_dict).encode()).decode()
        signature = hmac.new(SECRET_KEY, payload_str.encode(), hashlib.sha256).hexdigest()
        return f"{payload_str}.{signature}"

    def verify_payload(signed_payload: str) -> dict:
        try:
            payload_str, signature = signed_payload.rsplit(".", 1)
            expected_sig = hmac.new(SECRET_KEY, payload_str.encode(), hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected_sig, signature):
                return json.loads(base64.b64decode(payload_str).decode())
        except Exception:
            pass
        return None


class LicenseGeneratorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("JK INFOTECH ERP — License Key Generator")
        self.root.geometry("640x720")
        self.root.resizable(False, False)
        
        # WinUI 3 Dark Theme Palette
        self.colors = {
            "bg": "#0F172A",
            "card_bg": "#1E293B",
            "card_border": "#334155",
            "text": "#F8FAFC",
            "text_secondary": "#94A3B8",
            "accent": "#0284C7",
            "accent_hover": "#0369A1",
            "accent_light": "rgba(56, 189, 248, 0.12)",
            "success": "#22C55E",
            "success_hover": "#16A34A",
            "input_bg": "#0F172A",
            "input_border": "#475569"
        }
        
        self.root.configure(bg=self.colors["bg"])
        self._setup_ui()

    def _setup_ui(self):
        # Container Card
        card = tk.Frame(
            self.root,
            bg=self.colors["card_bg"],
            highlightbackground=self.colors["card_border"],
            highlightthickness=1,
            bd=0
        )
        card.place(x=24, y=20, width=592, height=676)

        # Header Section
        lbl_subtitle = tk.Label(
            card,
            text="SECURITY / LICENSE GENERATOR",
            font=("Segoe UI", 9, "bold"),
            fg="#38BDF8",
            bg=self.colors["card_bg"]
        )
        lbl_subtitle.pack(anchor="w", padx=28, pady=(20, 2))

        lbl_title = tk.Label(
            card,
            text="JK INFOTECH ERP Key Generator",
            font=("Segoe UI", 18, "bold"),
            fg=self.colors["text"],
            bg=self.colors["card_bg"]
        )
        lbl_title.pack(anchor="w", padx=28, pady=(0, 14))

        # Divider
        divider = tk.Frame(card, bg=self.colors["card_border"], height=1)
        divider.pack(fill="x", padx=28, pady=(0, 16))

        # Field 1: Client Hardware ID (HWID)
        lbl_hwid = tk.Label(
            card,
            text="Client Hardware ID (HWID):",
            font=("Segoe UI", 10, "bold"),
            fg=self.colors["text"],
            bg=self.colors["card_bg"]
        )
        lbl_hwid.pack(anchor="w", padx=28, pady=(0, 4))

        hwid_frame = tk.Frame(card, bg=self.colors["card_bg"])
        hwid_frame.pack(fill="x", padx=28, pady=(0, 14))

        self.entry_hwid = tk.Entry(
            hwid_frame,
            font=("Consolas", 11, "bold"),
            bg=self.colors["input_bg"],
            fg=self.colors["text"],
            insertbackground=self.colors["text"],
            bd=1,
            relief="solid",
            highlightcolor="#38BDF8"
        )
        self.entry_hwid.pack(side="left", fill="x", expand=True, ipady=6, ipadx=8)

        btn_paste = tk.Button(
            hwid_frame,
            text="PASTE HWID",
            font=("Segoe UI", 9, "bold"),
            bg="#334155",
            fg="#F8FAFC",
            activebackground="#475569",
            activeforeground="#FFFFFF",
            bd=0,
            cursor="hand2",
            command=self._paste_hwid,
            padx=12,
            pady=6
        )
        btn_paste.pack(side="right", padx=(8, 0))

        # Field 2: Select Duration (Demo vs Standard Paid Subscriptions)
        lbl_duration = tk.Label(
            card,
            text="Select License / Demo Duration:",
            font=("Segoe UI", 10, "bold"),
            fg=self.colors["text"],
            bg=self.colors["card_bg"]
        )
        lbl_duration.pack(anchor="w", padx=28, pady=(0, 6))

        self.var_duration = tk.StringVar(value="12")
        
        duration_frame = tk.Frame(card, bg=self.colors["card_bg"])
        duration_frame.pack(fill="x", padx=28, pady=(0, 16))

        # Demo Section Header
        lbl_demo_sec = tk.Label(
            duration_frame,
            text="🎁 DEMO TRIAL OPTIONS:",
            font=("Segoe UI", 8, "bold"),
            fg="#F59E0B",
            bg=self.colors["card_bg"]
        )
        lbl_demo_sec.pack(anchor="w", pady=(0, 2))

        demo_f = tk.Frame(duration_frame, bg=self.colors["card_bg"])
        demo_f.pack(fill="x", pady=(0, 8))

        demo_durations = [
            ("5 Min Test", "5min"),
            ("3 Days Demo", "3d"),
            ("7 Days Demo", "7d"),
            ("15 Days Demo", "15d")
        ]

        for label, val in demo_durations:
            rb = tk.Radiobutton(
                demo_f,
                text=label,
                value=val,
                variable=self.var_duration,
                font=("Segoe UI", 9, "bold"),
                fg="#FBBF24",
                bg=self.colors["card_bg"],
                selectcolor="#0F172A",
                activebackground=self.colors["card_bg"],
                activeforeground="#FBBF24",
                cursor="hand2"
            )
            rb.pack(side="left", padx=(0, 12))

        # Standard Paid Subscriptions Header
        lbl_paid_sec = tk.Label(
            duration_frame,
            text="💼 STANDARD / ENTERPRISE LICENSES:",
            font=("Segoe UI", 8, "bold"),
            fg="#38BDF8",
            bg=self.colors["card_bg"]
        )
        lbl_paid_sec.pack(anchor="w", pady=(4, 2))

        paid_durations = [
            ("1 Month", "1"),
            ("3 Months", "3"),
            ("6 Months", "6"),
            ("1 Year (12M)", "12"),
            ("2 Years (24M)", "24"),
            ("Lifetime", "lifetime")
        ]

        row_f = None
        for i, (label, val) in enumerate(paid_durations):
            if i % 3 == 0:
                row_f = tk.Frame(duration_frame, bg=self.colors["card_bg"])
                row_f.pack(fill="x", pady=2)
            
            rb = tk.Radiobutton(
                row_f,
                text=label,
                value=val,
                variable=self.var_duration,
                font=("Segoe UI", 9, "bold"),
                fg=self.colors["text"],
                bg=self.colors["card_bg"],
                selectcolor="#0F172A",
                activebackground=self.colors["card_bg"],
                activeforeground="#38BDF8",
                cursor="hand2"
            )
            rb.pack(side="left", padx=(0, 16))

        # Button: Generate Key
        btn_generate = tk.Button(
            card,
            text="GENERATE ACTIVATION KEY",
            font=("Segoe UI", 11, "bold"),
            bg=self.colors["accent"],
            fg="#FFFFFF",
            activebackground=self.colors["accent_hover"],
            activeforeground="#FFFFFF",
            bd=0,
            cursor="hand2",
            command=self.generate_key,
            pady=10
        )
        btn_generate.pack(fill="x", padx=28, pady=(0, 16))

        # Field 3: Generated Key Output
        lbl_result = tk.Label(
            card,
            text="Generated Cryptographic License Key:",
            font=("Segoe UI", 10, "bold"),
            fg=self.colors["text"],
            bg=self.colors["card_bg"]
        )
        lbl_result.pack(anchor="w", padx=28, pady=(0, 4))

        self.txt_key = tk.Text(
            card,
            height=3,
            font=("Consolas", 10),
            bg=self.colors["input_bg"],
            fg="#38BDF8",
            insertbackground=self.colors["text"],
            bd=1,
            relief="solid",
            wrap="char"
        )
        self.txt_key.pack(fill="x", padx=28, pady=(0, 14))

        # Actions Row (Copy Buttons)
        actions_frame = tk.Frame(card, bg=self.colors["card_bg"])
        actions_frame.pack(fill="x", padx=28, pady=(0, 14))

        self.btn_copy_key = tk.Button(
            actions_frame,
            text="COPY KEY ONLY",
            font=("Segoe UI", 10, "bold"),
            bg=self.colors["success"],
            fg="#FFFFFF",
            activebackground=self.colors["success_hover"],
            activeforeground="#FFFFFF",
            bd=0,
            cursor="hand2",
            command=self._copy_key_only,
            pady=8
        )
        self.btn_copy_key.pack(side="left", fill="x", expand=True, padx=(0, 6))

        self.btn_copy_msg = tk.Button(
            actions_frame,
            text="COPY WHATSAPP MESSAGE",
            font=("Segoe UI", 10, "bold"),
            bg="#0284C7",
            fg="#FFFFFF",
            activebackground="#0369A1",
            activeforeground="#FFFFFF",
            bd=0,
            cursor="hand2",
            command=self._copy_whatsapp_message,
            pady=8
        )
        self.btn_copy_msg.pack(side="right", fill="x", expand=True, padx=(6, 0))

        # Status Footer
        self.lbl_status = tk.Label(
            card,
            text="Ready to generate. Paste client's Hardware ID above.",
            font=("Segoe UI", 9),
            fg=self.colors["text_secondary"],
            bg=self.colors["card_bg"]
        )
        self.lbl_status.pack(anchor="w", padx=28, pady=(0, 10))

    def _paste_hwid(self):
        try:
            clipboard_text = self.root.clipboard_get().strip()
            if clipboard_text:
                self.entry_hwid.delete(0, tk.END)
                self.entry_hwid.insert(0, clipboard_text.upper())
                self.lbl_status.config(text="Hardware ID pasted from clipboard.", fg="#38BDF8")
        except Exception:
            self.lbl_status.config(text="Clipboard is empty or invalid.", fg="#F87171")

    def generate_key(self):
        hwid = self.entry_hwid.get().strip().upper()
        if not hwid:
            messagebox.showwarning("Input Required", "Please enter or paste the client's Hardware ID (HWID).")
            return

        duration = self.var_duration.get()
        
        if duration == "lifetime":
            expires_at_str = "lifetime"
            dur_label = "Lifetime (Unlimited)"
        elif duration == "5min":
            trusted_time = datetime.now(timezone.utc)
            expires_time = trusted_time + timedelta(minutes=5)
            expires_at_str = expires_time.isoformat()
            dur_label = "5 Minutes Quick Demo Trial"
        elif duration.endswith("d"):
            try:
                days_cnt = int(duration[:-1])
                trusted_time = datetime.now(timezone.utc)
                expires_time = trusted_time + timedelta(days=days_cnt)
                expires_at_str = expires_time.isoformat()
                dur_label = f"{days_cnt} Days Demo Trial"
            except Exception as e:
                messagebox.showerror("Error", f"Invalid demo duration option: {e}")
                return
        else:
            try:
                months = int(duration)
                trusted_time = datetime.now(timezone.utc)
                expires_time = trusted_time + timedelta(days=30 * months)
                expires_at_str = expires_time.isoformat()
                dur_label = f"{months} Month(s) Subscription License"
            except Exception as e:
                messagebox.showerror("Error", f"Invalid duration option: {e}")
                return

        payload = {
            "hwid": hwid,
            "expires_at": expires_at_str
        }

        signed_key = sign_payload(payload)

        # Update output
        self.txt_key.delete("1.0", tk.END)
        self.txt_key.insert("1.0", signed_key)

        self.current_key = signed_key
        self.current_hwid = hwid
        self.current_duration_label = dur_label

        self.lbl_status.config(
            text=f"SUCCESS! Key generated for HWID: {hwid} ({dur_label})",
            fg="#4ADE80"
        )

    def _copy_key_only(self):
        key = self.txt_key.get("1.0", tk.END).strip()
        if not key:
            messagebox.showwarning("No Key", "Please click 'GENERATE ACTIVATION KEY' first.")
            return
        
        self.root.clipboard_clear()
        self.root.clipboard_append(key)
        self.btn_copy_key.config(text="COPIED KEY!")
        self.root.after(2000, lambda: self.btn_copy_key.config(text="COPY KEY ONLY"))

    def _copy_whatsapp_message(self):
        key = self.txt_key.get("1.0", tk.END).strip()
        if not key:
            messagebox.showwarning("No Key", "Please click 'GENERATE ACTIVATION KEY' first.")
            return

        hwid = getattr(self, "current_hwid", "YOUR_PC_HWID")
        dur = getattr(self, "current_duration_label", "Standard License")

        msg = (
            f"🔑 *JK INFOTECH ERP — ACTIVATION KEY*\n"
            f"----------------------------------------\n"
            f"Here is your official license key to activate your software:\n\n"
            f"📌 *Hardware ID:* `{hwid}`\n"
            f"⏱️ *Validity Period:* `{dur}`\n\n"
            f"🔐 *Activation Key:* (Copy the line below):\n"
            f"`{key}`\n\n"
            f"----------------------------------------\n"
            f"Instructions: Open JK INFOTECH ERP on your PC, paste this key into the Activation Key box, and click ACTIVATE LICENSE.\n"
            f"Thank you for choosing JK INFOTECH ERP!"
        )

        self.root.clipboard_clear()
        self.root.clipboard_append(msg)
        self.btn_copy_msg.config(text="COPIED MESSAGE!")
        self.root.after(2000, lambda: self.btn_copy_msg.config(text="COPY WHATSAPP MESSAGE"))


if __name__ == "__main__":
    root = tk.Tk()
    app = LicenseGeneratorGUI(root)
    root.mainloop()
