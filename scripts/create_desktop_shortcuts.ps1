# =====================================================================
# JK INFOTECH ERP — Create Custom Desktop Shortcuts with Icons
# File: Y:\JK Infotech ERP\scripts\create_desktop_shortcuts.ps1
# =====================================================================

$WshShell = New-Object -ComObject WScript.Shell

# Detect Desktop Directory
$desktopDir = [Environment]::GetFolderPath("Desktop")
if (-not (Test-Path $desktopDir) -and (Test-Path "$env:USERPROFILE\OneDrive\Desktop")) {
    $desktopDir = "$env:USERPROFILE\OneDrive\Desktop"
}

$workspaceRoot = "Y:\JK Infotech ERP"

# 1. Reset Fresh Client Shortcut (with Refresh / Reset Icon)
$resetBat = Join-Path $workspaceRoot "reset-fresh-client.bat"
$s1Desktop = Join-Path $desktopDir "Reset Fresh Client.lnk"
$s1Root = Join-Path $workspaceRoot "Reset Fresh Client.lnk"

foreach ($sLoc in @($s1Desktop, $s1Root)) {
    $sc = $WshShell.CreateShortcut($sLoc)
    $sc.TargetPath = $resetBat
    $sc.WorkingDirectory = $workspaceRoot
    $sc.IconLocation = "C:\Windows\System32\imageres.dll, -5322" # Modern Windows Refresh Icon
    if (-not (Test-Path "C:\Windows\System32\imageres.dll")) {
        $sc.IconLocation = "C:\Windows\System32\shell32.dll, 238"
    }
    $sc.Save()
}

# 2. Generate License Key Shortcut (Silent Windowless Launch with Golden Key Icon)
$pythonw = "Y:\JK Infotech ERP\backend\venv\Scripts\pythonw.exe"
if (-not (Test-Path $pythonw)) {
    $pythonw = "pythonw.exe"
}
$guiPy = Join-Path $workspaceRoot "scripts\key_generator_gui.py"
$s2Desktop = Join-Path $desktopDir "Generate License Key.lnk"
$s2Root = Join-Path $workspaceRoot "Generate License Key.lnk"

foreach ($sLoc in @($s2Desktop, $s2Root)) {
    $sc = $WshShell.CreateShortcut($sLoc)
    $sc.TargetPath = $pythonw
    $sc.Arguments = "`"$guiPy`""
    $sc.WorkingDirectory = $workspaceRoot
    $sc.IconLocation = "C:\Windows\System32\shell32.dll, 44" # Distinct Golden Key Icon
    $sc.Save()
}

# Clean up raw batch file shortcuts from Desktop if present
Remove-Item -Path "$desktopDir\reset-fresh-client.bat" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$desktopDir\generate-license-key.bat" -Force -ErrorAction SilentlyContinue

Write-Host "SUCCESS: Updated Generate License Key shortcut to launch silently without CMD window!" -ForegroundColor Green
