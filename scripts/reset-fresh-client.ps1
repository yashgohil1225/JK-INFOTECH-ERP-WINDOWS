# =====================================================================
# JK INFOTECH ERP — Local Fresh Client Reset & Uninstaller Utility
# Completely uninstalls installed app packages, services, shortcuts,
# registry keys, database clusters, license keys, and app storage to
# simulate a 100% brand-new fresh client PC for testing setup installers.
# =====================================================================

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "JK INFOTECH ERP — Resetting PC to Fresh Client State" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Run official Inno Setup Uninstaller if present
$programFilesDir = "C:\Program Files\JK Infotech ERP"
$uninstaller = Join-Path $programFilesDir "unins000.exe"
if (-not (Test-Path $uninstaller)) {
    $uninstaller = Join-Path $programFilesDir "unins001.exe"
}

if (Test-Path $uninstaller) {
    Write-Host "`n[1/6] Running silent Inno Setup uninstaller..." -ForegroundColor Yellow
    Start-Process -FilePath $uninstaller -ArgumentList "/SILENT /VERYSILENT /SUPPRESSMSGBOXES /NORESTART" -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
}

# 2. Stop background services & active app processes
Write-Host "[2/6] Stopping background services and running processes..." -ForegroundColor Yellow
Stop-Service JK_Infotech_PostgreSQL -ErrorAction SilentlyContinue
Stop-Service JK_Infotech_Redis -ErrorAction SilentlyContinue
taskkill /F /IM backend.exe /T 2>$null | Out-Null
taskkill /F /IM JKErpWindows.exe /T 2>$null | Out-Null
taskkill /F /IM postgres.exe /T 2>$null | Out-Null
taskkill /F /IM redis-server.exe /T 2>$null | Out-Null

# 3. Uninstall Windows UWP App Package
Write-Host "[3/6] Uninstalling Windows UWP client app package..." -ForegroundColor Yellow
Get-AppxPackage *9428b0f2-9cad-4953-a4b8-da3e6a84d40a* -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue

# 4. Clean Windows Services & Registry entries
Write-Host "[4/6] Cleaning Windows Services and Registry entries..." -ForegroundColor Yellow
sc.exe delete JK_Infotech_PostgreSQL 2>$null | Out-Null
sc.exe delete JK_Infotech_Redis 2>$null | Out-Null
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "JK_Infotech_ERP_Backend" -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{9428b0f2-9cad-4953-a4b8-da3e6a84d40a}_is1" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\{9428b0f2-9cad-4953-a4b8-da3e6a84d40a}_is1" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{9428b0f2-9cad-4953-a4b8-da3e6a84d40a}_is1" -Recurse -Force -ErrorAction SilentlyContinue

# 5. Remove Desktop and Start Menu Shortcuts
Write-Host "[5/6] Cleaning Desktop and Start Menu shortcuts..." -ForegroundColor Yellow
$shortcuts = @(
    "$env:USERPROFILE\Desktop\JK INFOTECH ERP.lnk",
    "$env:PUBLIC\Desktop\JK INFOTECH ERP.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\JK INFOTECH ERP",
    "$env:PROGRAMDATA\Microsoft\Windows\Start Menu\Programs\JK INFOTECH ERP"
)
foreach ($shortcut in $shortcuts) {
    if (Test-Path $shortcut) {
        Remove-Item -Path $shortcut -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 6. Purge installation directories, database, license keys, and app storage cache
Write-Host "[6/6] Purging installation directories, database clusters, license keys, and cache..." -ForegroundColor Yellow
if (Test-Path $programFilesDir) {
    Remove-Item -Path $programFilesDir -Recurse -Force -ErrorAction SilentlyContinue
}

$programFilesX86Dir = "C:\Program Files (x86)\JK Infotech ERP"
if (Test-Path $programFilesX86Dir) {
    Remove-Item -Path $programFilesX86Dir -Recurse -Force -ErrorAction SilentlyContinue
}

Get-ChildItem "$env:LOCALAPPDATA\Packages" -Filter "*9428b0f2-9cad-4953-a4b8-da3e6a84d40a*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

$roamingAppDataDir = "$env:APPDATA\jk-erp"
if (Test-Path $roamingAppDataDir) {
    Remove-Item -Path $roamingAppDataDir -Recurse -Force -ErrorAction SilentlyContinue
}

$localAppDataDir = "$env:LOCALAPPDATA\jk-erp"
if (Test-Path $localAppDataDir) {
    Remove-Item -Path $localAppDataDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "SUCCESS! Your PC has been completely reset & uninstalled." -ForegroundColor Green
Write-Host "You can now run JK_Infotech_ERP_Setup.exe to test fresh installation!" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
