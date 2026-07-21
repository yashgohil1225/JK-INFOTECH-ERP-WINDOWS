# -------------------------------------------------------------------------
# JK INFOTECH ERP — Enterprise One-Click Client Installer Script
# -------------------------------------------------------------------------

$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $ScriptDir) {
    $ScriptDir = Get-Location
}
Set-Location -Path $ScriptDir

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "         INSTALLING JK INFOTECH ERP                " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Certificate Registration
$CertFile = Get-ChildItem -Path $ScriptDir -Filter "*.cer" -Recurse | Select-Object -First 1
if ($CertFile) {
    Write-Host "[1/3] Registering Trusted Security Certificate..." -ForegroundColor Green
    $certPath = $CertFile.FullName
    Import-Certificate -FilePath $certPath -CertStoreLocation "Cert:\LocalMachine\Root" -ErrorAction SilentlyContinue | Out-Null
    Import-Certificate -FilePath $certPath -CertStoreLocation "Cert:\LocalMachine\TrustedPeople" -ErrorAction SilentlyContinue | Out-Null
    $null = certutil.exe -addstore Root "$certPath" 2>&1
    $null = certutil.exe -addstore TrustedPeople "$certPath" 2>&1
    Write-Host "      Certificate installed successfully!" -ForegroundColor Green
}

# 2. Sideloading Policy Registration
Write-Host "[2/3] Enabling Windows Application Sideloading..." -ForegroundColor Green
$null = reg.exe add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /t REG_DWORD /f /v AllowAllTrustedApps /d 1 2>&1
$null = reg.exe add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /t REG_DWORD /f /v AllowDevelopmentWithoutDevLicense /d 1 2>&1
Write-Host "      Windows App Sideloading Enabled!" -ForegroundColor Green

# 3. CPU Architecture Resolution
$Arch = "x64"
if ($env:PROCESSOR_ARCHITECTURE -eq "x86") {
    $Arch = "x86"
}

$DepFolder = Join-Path -Path $ScriptDir -ChildPath "Dependencies\$Arch"
$Dependencies = @()
if (Test-Path -Path $DepFolder) {
    $Dependencies = @(Get-ChildItem -Path $DepFolder -Filter "*.appx" | Select-Object -ExpandProperty FullName)
}

# 4. Package Detection (.msixbundle / .msix / .appxbundle / .appx)
$AppPackage = Get-ChildItem -Path $ScriptDir -Filter "*.msixbundle" | Select-Object -First 1
if (-not $AppPackage) {
    $AppPackage = Get-ChildItem -Path $ScriptDir -Filter "*.msix" | Select-Object -First 1
}
if (-not $AppPackage) {
    $AppPackage = Get-ChildItem -Path $ScriptDir -Filter "*.appxbundle" | Select-Object -First 1
}
if (-not $AppPackage) {
    $AppPackage = Get-ChildItem -Path $ScriptDir -Filter "*.appx" | Select-Object -First 1
}
if (-not $AppPackage) {
    $AppPackage = Get-ChildItem -Path $ScriptDir -Include "*.msixbundle", "*.msix", "*.appxbundle", "*.appx" -Recurse | Select-Object -First 1
}

# 5. App Deployment
if ($AppPackage) {
    Write-Host "[3/3] Deploying JK INFOTECH ERP Package ($Arch)..." -ForegroundColor Green
    $pkgPath = $AppPackage.FullName
    
    try {
        if ($Dependencies.Count -gt 0) {
            Write-Host "      Installing ($($Dependencies.Count)) required ($Arch) system dependencies..." -ForegroundColor Gray
            Add-AppxPackage -Path $pkgPath -DependencyPath $Dependencies -ForceApplicationShutdown -ErrorAction Stop
        } else {
            Add-AppxPackage -Path $pkgPath -ForceApplicationShutdown -ErrorAction Stop
        }
        
        Write-Host ""
        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "   SUCCESS: JK INFOTECH ERP INSTALLED CLEANLY!  " -ForegroundColor Green
        Write-Host "====================================================" -ForegroundColor Green
        Write-Host "Search for 'JK INFOTECH ERP' in your Windows Start Menu." -ForegroundColor White
    } catch {
        Write-Host "      Updating previous installation registration..." -ForegroundColor Yellow
        $existing = Get-AppxPackage -Name "9428b0f2-9cad-4953-a4b8-da3e6a84d40a" -ErrorAction SilentlyContinue
        if ($existing) {
            Remove-AppxPackage -Package $existing.PackageFullName -ErrorAction SilentlyContinue
        }
        
        try {
            if ($Dependencies.Count -gt 0) {
                Add-AppxPackage -Path $pkgPath -DependencyPath $Dependencies -ForceApplicationShutdown -ErrorAction Stop
            } else {
                Add-AppxPackage -Path $pkgPath -ForceApplicationShutdown -ErrorAction Stop
            }
            Write-Host ""
            Write-Host "====================================================" -ForegroundColor Green
            Write-Host "   SUCCESS: JK INFOTECH ERP INSTALLED CLEANLY!  " -ForegroundColor Green
            Write-Host "====================================================" -ForegroundColor Green
            Write-Host "Search for 'JK INFOTECH ERP' in your Windows Start Menu." -ForegroundColor White
        } catch {
            Write-Host ""
            Write-Host "====================================================" -ForegroundColor Red
            Write-Host "   INSTALLATION ERROR DETAILS:                      " -ForegroundColor Red
            Write-Host "====================================================" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
    }
} else {
    Write-Host "[ERROR] Installation failed: No .msixbundle or .msix package file found!" -ForegroundColor Red
    Write-Host "Tip: Please make sure the entire extracted folder (containing .msixbundle and Dependencies) is copied together." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press Enter to exit..."
$null = Read-Host
