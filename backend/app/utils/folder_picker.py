import os
import sys
import base64
import subprocess
import logging

logger = logging.getLogger("folder_picker")

def pick_folder_dialog(initial_dir: str = "") -> str:
    """
    Opens native Windows Folder Browser Dialog using PowerShell COM / WinForms.
    Brings dialog to front of active application.
    """
    clean_init = (initial_dir or "").replace("'", "''")

    # Strategy 1: PowerShell Shell.Application COM Object (Brings window to front natively)
    ps_com_script = f"""
$app = New-Object -ComObject Shell.Application
$folder = $app.BrowseForFolder(0, 'Select Auto-Backup Folder Location', 0, '{clean_init}')
if ($folder -ne $null) {{
    Write-Host $folder.Self.Path
}}
"""
    try:
        encoded_ps = base64.b64encode(ps_com_script.encode("utf-16le")).decode("utf-8")
        cmd = ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded_ps]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        output_path = res.stdout.strip()
        if output_path and os.path.exists(output_path):
            return output_path.replace("/", "\\")
    except Exception as err:
        logger.warning(f"PowerShell COM folder picker exception: {err}")

    # Strategy 2: PowerShell WinForms FolderBrowserDialog with STA
    ps_forms_script = f"""
[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Select Auto-Backup Folder Location'
$dlg.ShowNewFolderButton = $true
if ('{clean_init}' -and (Test-Path '{clean_init}')) {{
    $dlg.SelectedPath = '{clean_init}'
}}
$res = $dlg.ShowDialog()
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {{
    Write-Host $dlg.SelectedPath
}}
"""
    try:
        encoded_ps2 = base64.b64encode(ps_forms_script.encode("utf-16le")).decode("utf-8")
        cmd2 = ["powershell.exe", "-NoProfile", "-STA", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded_ps2]
        res2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=60)
        output_path2 = res2.stdout.strip()
        if output_path2 and os.path.exists(output_path2):
            return output_path2.replace("/", "\\")
    except Exception as err:
        logger.warning(f"PowerShell WinForms folder picker exception: {err}")

    # Strategy 3: Tkinter filedialog fallback
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        start_path = initial_dir if (initial_dir and os.path.exists(initial_dir)) else os.getcwd()
        folder = filedialog.askdirectory(title="Select Auto-Backup Folder Location", initialdir=start_path)
        root.destroy()
        if folder and os.path.exists(folder):
            return folder.replace("/", "\\")
    except Exception as tk_err:
        logger.warning(f"Tkinter folder picker exception: {tk_err}")

    return ""
