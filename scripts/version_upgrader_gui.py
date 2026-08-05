# =====================================================================
# JK INFOTECH ERP — Official Release Version Upgrader Utility
# File: Y:\JK Infotech ERP\scripts\version_upgrader_gui.py
# =====================================================================

import os
import sys
import re
import json
import shutil
import subprocess
import threading
import winreg
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

# ── Workspace Paths ──────────────────────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
workspace_root = os.path.abspath(os.path.join(script_dir, ".."))

pkg_json_path = os.path.join(workspace_root, "frontend", "package.json")
pkg_lock_path = os.path.join(workspace_root, "frontend", "package-lock.json")
appx_manifest_path = os.path.join(workspace_root, "frontend", "windows", "JKErpWindows", "Package.appxmanifest")
setup_iss_path = os.path.join(workspace_root, "setup.iss")
build_ps1_path = os.path.join(workspace_root, "build-release-package.ps1")
output_dir = os.path.join(workspace_root, "Output")
updates_dir = os.path.join(workspace_root, "updates")


def is_windows_dark_theme() -> bool:
    """Detect if Windows OS is set to Dark Theme or Light Theme."""
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        val, _ = winreg.QueryValueEx(key, "AppsUseLightTheme")
        winreg.CloseKey(key)
        return val == 0  # 0 = Dark Theme, 1 = Light Theme
    except Exception:
        return False  # Default to Light theme if registry check fails


def detect_current_version() -> str:
    """Detect current app version from frontend/package.json."""
    try:
        if os.path.exists(pkg_json_path):
            with open(pkg_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("version", "1.0.0")
    except Exception as e:
        print(f"Error reading package.json: {e}")
    return "1.0.0"


def calculate_bump_versions(current_ver: str):
    """Return patch, minor, major bumped version strings."""
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)$", current_ver.strip())
    if not match:
        return current_ver, current_ver, current_ver
    major, minor, patch = map(int, match.groups())
    return (
        f"{major}.{minor}.{patch + 1}",
        f"{major}.{minor + 1}.0",
        f"{major + 1}.0.0"
    )


def update_version_in_files(old_ver: str, new_ver: str, log_func) -> bool:
    """Synchronize new version string across all 5 project config files safely."""
    try:
        new_appx_ver = f"{new_ver}.0" if len(new_ver.split(".")) == 3 else new_ver

        # 1. frontend/package.json
        if os.path.exists(pkg_json_path):
            with open(pkg_json_path, "r", encoding="utf-8") as f:
                content = f.read()
            updated_content = re.sub(r'("version"\s*:\s*")[^"]+(")', f'\\g<1>{new_ver}\\g<2>', content, count=1)
            with open(pkg_json_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
            log_func(f"[OK] Updated frontend/package.json -> {new_ver}")

        # 2. frontend/package-lock.json
        if os.path.exists(pkg_lock_path):
            with open(pkg_lock_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["version"] = new_ver
            if "packages" in data and "" in data["packages"]:
                data["packages"][""]["version"] = new_ver
            with open(pkg_lock_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                f.write("\n")
            log_func(f"[OK] Updated frontend/package-lock.json -> {new_ver}")

        # 3. Package.appxmanifest
        if os.path.exists(appx_manifest_path):
            with open(appx_manifest_path, "r", encoding="utf-8") as f:
                content = f.read()
            updated_content = re.sub(r'(Version\s*=\s*")[^"]+(")', f'\\g<1>{new_appx_ver}\\g<2>', content)
            with open(appx_manifest_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
            log_func(f"[OK] Updated Package.appxmanifest -> {new_appx_ver}")

        # 4. setup.iss
        if os.path.exists(setup_iss_path):
            with open(setup_iss_path, "r", encoding="utf-8") as f:
                content = f.read()

            content = re.sub(r'(AppVersion\s*=\s*)[^\r\n]+', f'AppVersion={new_ver}', content)
            content = re.sub(r'(OutputBaseFilename\s*=\s*JK_Infotech_ERP_Setup_v)[^\r\n]+', f'OutputBaseFilename=JK_Infotech_ERP_Setup_v{new_ver}', content)
            content = re.sub(r'JKErpWindows_\d+\.\d+\.\d+\.\d+_x64_Test', f'JKErpWindows_{new_appx_ver}_x64_Test', content)

            with open(setup_iss_path, "w", encoding="utf-8") as f:
                f.write(content)
            log_func(f"[OK] Updated setup.iss -> {new_ver} (AppPackage: JKErpWindows_{new_appx_ver}_x64_Test)")

        # 5. build-release-package.ps1
        if os.path.exists(build_ps1_path):
            with open(build_ps1_path, "r", encoding="utf-8") as f:
                content = f.read()
            updated_content = re.sub(r'(\$AppVersion\s*=\s*")[^"]+(")', f'\\g<1>{new_ver}\\g<2>', content)
            with open(build_ps1_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
            log_func(f"[OK] Updated build-release-package.ps1 -> {new_ver}")

        return True
    except Exception as e:
        log_func(f"[ERROR] Failed updating version strings: {e}")
        return False


def clean_previous_builds(log_func) -> int:
    """Delete previously generated executables and zip files from Output and updates folders."""
    count = 0
    dirs = [output_dir, updates_dir]
    for d in dirs:
        if os.path.exists(d):
            for fname in os.listdir(d):
                if fname.endswith(".exe") or fname.endswith(".zip") or fname.endswith(".bak"):
                    fpath = os.path.join(d, fname)
                    try:
                        os.remove(fpath)
                        count += 1
                        log_func(f"[CLEAN] Deleted previous build file: {fname}")
                    except Exception as e:
                        log_func(f"[WARNING] Could not delete {fname}: {e}")
    return count


class VersionUpgraderGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("JK INFOTECH ERP — Version Manager & Upgrader")
        self.root.geometry("800x850")
        self.root.resizable(True, True)
        try:
            self.root.state("zoomed")  # Open maximized by default on Windows
        except Exception:
            pass

        # Dynamic System Theme Palette (Light vs Dark)
        self.is_dark = is_windows_dark_theme()
        if self.is_dark:
            self.colors = {
                "bg": "#0F172A",
                "card_bg": "#1E293B",
                "card_border": "#334155",
                "text": "#F8FAFC",
                "text_secondary": "#94A3B8",
                "accent": "#0284C7",
                "accent_hover": "#38BDF8",
                "success": "#10B981",
                "danger": "#EF4444",
                "entry_bg": "#0F172A",
                "console_bg": "#090D16",
                "console_fg": "#38BDF8",
                "btn_bg": "#334155"
            }
        else:
            self.colors = {
                "bg": "#F1F5F9",
                "card_bg": "#FFFFFF",
                "card_border": "#CBD5E1",
                "text": "#0F172A",
                "text_secondary": "#64748B",
                "accent": "#0284C7",
                "accent_hover": "#0369A1",
                "success": "#059669",
                "danger": "#DC2626",
                "entry_bg": "#F8FAFC",
                "console_bg": "#0F172A",
                "console_fg": "#38BDF8",
                "btn_bg": "#E2E8F0"
            }

        self.root.configure(bg=self.colors["bg"])
        self.is_building = False

        self._setup_styles()
        self._build_ui()
        self._refresh_current_version()

    def _setup_styles(self):
        self.style = ttk.Style()
        self.style.theme_use("clam")
        self.style.configure(".", background=self.colors["bg"], foreground=self.colors["text"], font=("Segoe UI", 10))

        # Modern Progress Bar Style
        self.style.configure(
            "Blue.Horizontal.TProgressbar",
            troughcolor=self.colors["bg"],
            background=self.colors["accent"],
            bordercolor=self.colors["card_border"],
            lightcolor=self.colors["accent_hover"],
            darkcolor=self.colors["accent"]
        )

    def _build_ui(self):
        # Top Header Banner
        header = tk.Frame(self.root, bg=self.colors["card_bg"], pady=15, padx=20)
        header.pack(fill="x", side="top")

        title_lbl = tk.Label(
            header,
            text="JK INFOTECH ERP",
            font=("Segoe UI", 16, "bold"),
            bg=self.colors["card_bg"],
            fg=self.colors["accent"]
        )
        title_lbl.pack(anchor="w")

        theme_mode_str = "Dark Theme Mode" if self.is_dark else "Light Theme Mode"
        subtitle_lbl = tk.Label(
            header,
            text=f"Automated Release Version Upgrader & Packaging Utility ({theme_mode_str})",
            font=("Segoe UI", 10),
            bg=self.colors["card_bg"],
            fg=self.colors["text_secondary"]
        )
        subtitle_lbl.pack(anchor="w")

        # Main Container
        main_frame = tk.Frame(self.root, bg=self.colors["bg"], padx=20, pady=15)
        main_frame.pack(fill="both", expand=True)

        # ── Card 1: Version Status & Preset Bumps ────────────────────
        card1 = tk.LabelFrame(
            main_frame,
            text=" App Version Control ",
            font=("Segoe UI", 11, "bold"),
            bg=self.colors["card_bg"],
            fg=self.colors["text"],
            bd=1,
            relief="solid",
            padx=15,
            pady=12
        )
        card1.pack(fill="x", pady=(0, 12))

        # Current Version Row
        row1 = tk.Frame(card1, bg=self.colors["card_bg"])
        row1.pack(fill="x", pady=(0, 10))

        tk.Label(row1, text="Current Active Version:", font=("Segoe UI", 10), bg=self.colors["card_bg"], fg=self.colors["text_secondary"]).pack(side="left")
        self.lbl_current_ver = tk.Label(row1, text="Detecting...", font=("Segoe UI", 11, "bold"), bg=self.colors["card_bg"], fg=self.colors["accent"])
        self.lbl_current_ver.pack(side="left", padx=10)

        # Quick Preset Buttons Frame
        tk.Label(card1, text="Quick Version Bump Presets:", font=("Segoe UI", 9, "bold"), bg=self.colors["card_bg"], fg=self.colors["text_secondary"]).pack(anchor="w", pady=(5, 5))

        btn_preset_frame = tk.Frame(card1, bg=self.colors["card_bg"])
        btn_preset_frame.pack(fill="x", pady=(0, 10))

        self.btn_patch = tk.Button(
            btn_preset_frame, text="Patch (+0.0.1)", font=("Segoe UI", 9),
            bg=self.colors["btn_bg"], fg=self.colors["text"], activebackground=self.colors["accent"],
            activeforeground="#FFFFFF", bd=0, padx=12, pady=6, cursor="hand2", command=lambda: self._set_target_preset("patch")
        )
        self.btn_patch.pack(side="left", padx=(0, 8))

        self.btn_minor = tk.Button(
            btn_preset_frame, text="Minor (+0.1.0)", font=("Segoe UI", 9),
            bg=self.colors["btn_bg"], fg=self.colors["text"], activebackground=self.colors["accent"],
            activeforeground="#FFFFFF", bd=0, padx=12, pady=6, cursor="hand2", command=lambda: self._set_target_preset("minor")
        )
        self.btn_minor.pack(side="left", padx=(0, 8))

        self.btn_major = tk.Button(
            btn_preset_frame, text="Major (+1.0.0)", font=("Segoe UI", 9),
            bg=self.colors["btn_bg"], fg=self.colors["text"], activebackground=self.colors["accent"],
            activeforeground="#FFFFFF", bd=0, padx=12, pady=6, cursor="hand2", command=lambda: self._set_target_preset("major")
        )
        self.btn_major.pack(side="left")

        # Custom Version Entry Row
        row2 = tk.Frame(card1, bg=self.colors["card_bg"])
        row2.pack(fill="x", pady=(5, 5))

        tk.Label(row2, text="New Version Number:", font=("Segoe UI", 10, "bold"), bg=self.colors["card_bg"], fg=self.colors["text"]).pack(side="left", padx=(0, 10))

        self.entry_new_ver = tk.Entry(
            row2, font=("Segoe UI", 11, "bold"), bg=self.colors["entry_bg"], fg=self.colors["text"],
            insertbackground=self.colors["text"], bd=1, relief="solid", highlightcolor=self.colors["accent"], highlightthickness=1
        )
        self.entry_new_ver.pack(side="left", fill="x", expand=True)

        # ── Card 2: Options ──────────────────────────────────────────
        card2 = tk.LabelFrame(
            main_frame,
            text=" Action Options ",
            font=("Segoe UI", 11, "bold"),
            bg=self.colors["card_bg"],
            fg=self.colors["text"],
            bd=1,
            relief="solid",
            padx=15,
            pady=10
        )
        card2.pack(fill="x", pady=(0, 12))

        self.var_clean_old = tk.BooleanVar(value=True)
        chk_clean = tk.Checkbutton(
            card2, text="Clean previous generated setup executables & zip updaters from Output/ and updates/",
            variable=self.var_clean_old, font=("Segoe UI", 9), bg=self.colors["card_bg"], fg=self.colors["text"],
            selectcolor=self.colors["card_bg"], activebackground=self.colors["card_bg"], activeforeground=self.colors["text"]
        )
        chk_clean.pack(anchor="w")

        # ── Card 3: Live Build Progress Bar & Status ─────────────────
        card3 = tk.Frame(main_frame, bg=self.colors["card_bg"], bd=1, relief="solid", padx=15, pady=10)
        card3.pack(fill="x", pady=(0, 12))

        progress_hdr = tk.Frame(card3, bg=self.colors["card_bg"])
        progress_hdr.pack(fill="x", pady=(0, 5))

        self.lbl_build_status = tk.Label(
            progress_hdr, text="Status: Ready", font=("Segoe UI", 9, "bold"),
            bg=self.colors["card_bg"], fg=self.colors["text_secondary"]
        )
        self.lbl_build_status.pack(side="left")

        self.lbl_progress_pct = tk.Label(
            progress_hdr, text="0%", font=("Segoe UI", 9, "bold"),
            bg=self.colors["card_bg"], fg=self.colors["accent"]
        )
        self.lbl_progress_pct.pack(side="right")

        self.progressbar = ttk.Progressbar(
            card3, style="Blue.Horizontal.TProgressbar", orient="horizontal", mode="determinate", maximum=100, value=0
        )
        self.progressbar.pack(fill="x")

        # ── Buttons Action Frame ─────────────────────────────────────
        action_frame = tk.Frame(main_frame, bg=self.colors["bg"])
        action_frame.pack(fill="x", pady=(0, 12))

        self.btn_update_only = tk.Button(
            action_frame, text="Update Version Strings Only", font=("Segoe UI", 10, "bold"),
            bg=self.colors["card_bg"], fg=self.colors["accent"], activebackground=self.colors["btn_bg"],
            activeforeground=self.colors["accent"], bd=1, relief="solid", padx=15, pady=8, cursor="hand2", command=self.on_update_version_only
        )
        self.btn_update_only.pack(side="left", padx=(0, 10))

        self.btn_build_all = tk.Button(
            action_frame, text="Update & Build Release Package", font=("Segoe UI", 10, "bold"),
            bg=self.colors["accent"], fg="#FFFFFF", activebackground=self.colors["accent_hover"],
            activeforeground="#FFFFFF", bd=0, padx=20, pady=8, cursor="hand2", command=self.on_update_and_build
        )
        self.btn_build_all.pack(side="left", fill="x", expand=True)

        # ── Output Log Console ───────────────────────────────────────
        log_frame = tk.LabelFrame(
            main_frame,
            text=" Console Output ",
            font=("Segoe UI", 10, "bold"),
            bg=self.colors["card_bg"],
            fg=self.colors["text"],
            bd=1,
            relief="solid",
            padx=10,
            pady=8
        )
        log_frame.pack(fill="both", expand=True)

        self.log_area = scrolledtext.ScrolledText(
            log_frame, font=("Consolas", 9), bg=self.colors["console_bg"], fg=self.colors["console_fg"],
            insertbackground=self.colors["text"], bd=0
        )
        self.log_area.pack(fill="both", expand=True)

    def set_progress(self, val: int, status_text: str = None):
        """Update progress bar value and status text safely."""
        def _update():
            self.progressbar["value"] = val
            self.lbl_progress_pct.config(text=f"{int(val)}%")
            if status_text:
                self.lbl_build_status.config(text=f"Status: {status_text}")
        self.root.after(0, _update)

    def log(self, message: str):
        """Append log message safely to log console and update progress step."""
        def _append():
            self.log_area.insert(tk.END, message + "\n")
            self.log_area.see(tk.END)

        self.root.after(0, _append)

        # Step Progress Detection from Build Output Log
        if "[1.5/4]" in message or "PostgreSQL" in message:
            self.set_progress(15, "Bundling PostgreSQL Binaries...")
        elif "[1/4]" in message or "PyInstaller" in message:
            self.set_progress(30, "Building Python Backend Executable (PyInstaller)...")
        elif "[2/4]" in message or "Windows UWP" in message:
            self.set_progress(55, "Building Windows UWP Client App...")
        elif "[3/4]" in message or "Inno Setup" in message:
            self.set_progress(80, "Compiling Inno Setup Installer (.exe)...")
        elif "[4/4]" in message or "Updater ZIP" in message:
            self.set_progress(92, "Packaging Standalone Updater ZIP...")

    def _refresh_current_version(self):
        self.current_ver = detect_current_version()
        self.lbl_current_ver.config(text=self.current_ver)

        self.patch_ver, self.minor_ver, self.major_ver = calculate_bump_versions(self.current_ver)
        self.btn_patch.config(text=f"Patch ({self.patch_ver})")
        self.btn_minor.config(text=f"Minor ({self.minor_ver})")
        self.btn_major.config(text=f"Major ({self.major_ver})")

        # Default suggestion: Patch bump
        self.entry_new_ver.delete(0, tk.END)
        self.entry_new_ver.insert(0, self.patch_ver)

        self.log(f"[INFO] Current detected app version: {self.current_ver}")

    def _set_target_preset(self, preset_type: str):
        self.entry_new_ver.delete(0, tk.END)
        if preset_type == "patch":
            self.entry_new_ver.insert(0, self.patch_ver)
        elif preset_type == "minor":
            self.entry_new_ver.insert(0, self.minor_ver)
        elif preset_type == "major":
            self.entry_new_ver.insert(0, self.major_ver)

    def _validate_version_input(self) -> str:
        new_ver = self.entry_new_ver.get().strip()
        if not re.match(r"^\d+\.\d+\.\d+$", new_ver):
            messagebox.showerror("Invalid Version Format", "Please enter a valid Semantic Version (e.g. 1.3.0)")
            return None
        return new_ver

    def on_update_version_only(self):
        new_ver = self._validate_version_input()
        if not new_ver:
            return

        self.set_progress(5, f"Updating version strings to {new_ver}...")

        if self.var_clean_old.get():
            cleaned = clean_previous_builds(self.log)
            self.log(f"[INFO] Cleaned {cleaned} old build file(s).")
            self.set_progress(10, "Cleaned old build files.")

        success = update_version_in_files(self.current_ver, new_ver, self.log)
        if success:
            self.set_progress(100, f"Version updated to {new_ver}!")
            messagebox.showinfo("Success", f"Successfully updated version to {new_ver} across all project files!")
            self._refresh_current_version()
        else:
            self.set_progress(0, "Error updating version.")

    def on_update_and_build(self):
        new_ver = self._validate_version_input()
        if not new_ver:
            return

        if self.is_building:
            messagebox.showwarning("Build in Progress", "A build is already running. Please wait.")
            return

        ans = messagebox.askyesno("Confirm Release Build", f"Update version to {new_ver} and launch full release packaging?")
        if not ans:
            return

        self.is_building = True
        self.btn_build_all.config(state="disabled", bg=self.colors["card_border"])
        self.btn_update_only.config(state="disabled")

        self.set_progress(2, f"Starting build for v{new_ver}...")

        def _thread_target():
            try:
                if self.var_clean_old.get():
                    cleaned = clean_previous_builds(self.log)
                    self.log(f"[INFO] Cleaned {cleaned} old build file(s).")

                self.set_progress(5, f"Updating version strings to {new_ver}...")
                self.log(f"--- BUMPING VERSION TO {new_ver} ---")
                success = update_version_in_files(self.current_ver, new_ver, self.log)
                if not success:
                    self.log("[ERROR] Version update failed. Aborting build.")
                    self.set_progress(0, "Failed to update version.")
                    return

                self.set_progress(10, "Launching build process...")
                self.log("--- LAUNCHING RELEASE PACKAGING (build-release-package.ps1) ---")

                cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", build_ps1_path]
                
                creationflags = 0
                startupinfo = None
                if os.name == 'nt':
                    creationflags = subprocess.CREATE_NO_WINDOW
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = subprocess.SW_HIDE

                process = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=workspace_root,
                    creationflags=creationflags, startupinfo=startupinfo
                )

                for line in iter(process.stdout.readline, ''):
                    if line:
                        self.log(line.strip())

                process.stdout.close()
                return_code = process.wait()

                if return_code == 0:
                    self.set_progress(100, f"Completed release v{new_ver}!")
                    self.log("==================================================")
                    self.log(f"[SUCCESS] Release build v{new_ver} completed successfully!")
                    self.log("==================================================")
                    messagebox.showinfo("Build Finished", f"Successfully packaged JK INFOTECH ERP v{new_ver}!")
                else:
                    self.set_progress(0, f"Build failed with code {return_code}")
                    self.log(f"[ERROR] Release packaging failed with exit code {return_code}")
                    messagebox.showerror("Build Error", f"Packaging failed with exit code {return_code}")

            except Exception as ex:
                self.set_progress(0, "Build exception encountered")
                self.log(f"[EXCEPTION] {ex}")
                messagebox.showerror("Error", str(ex))
            finally:
                self.is_building = False
                self.root.after(0, lambda: self.btn_build_all.config(state="normal", bg=self.colors["accent"]))
                self.root.after(0, lambda: self.btn_update_only.config(state="normal"))
                self.root.after(0, self._refresh_current_version)

        threading.Thread(target=_thread_target, daemon=True).start()


def main():
    root = tk.Tk()
    app = VersionUpgraderGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
