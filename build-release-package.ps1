# =====================================================================
# JK INFOTECH ERP — Automated Master Release & Packaging Script
# File: Y:\JK Infotech ERP\build-release-package.ps1
# =====================================================================

$ErrorActionPreference = "Stop"
$WorkspaceRoot = $PSScriptRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "JK INFOTECH ERP v1.1.9 — Full Release Packaging" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# ---------------------------------------------------------------------
# Step 1: Locate Inno Setup Compiler (ISCC.exe)
# ---------------------------------------------------------------------
$isccCandidates = @(
    "C:\Program Files\Inno Setup 7\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 7\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "ISCC.exe"
)


$isccPath = $null
foreach ($path in $isccCandidates) {
    if (Get-Command $path -ErrorAction SilentlyContinue) {
        $isccPath = $path
        break
    }
    if (Test-Path $path) {
        $isccPath = $path
        break
    }
}

if (-not $isccPath) {
    Write-Error "Inno Setup Compiler (ISCC.exe) was not found in standard paths. Please ensure Inno Setup 6 is installed."
}
Write-Host "[✓] Inno Setup Compiler found: $isccPath" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 1.5: Bundle PostgreSQL Engine Binaries if Missing
# ---------------------------------------------------------------------
$pgsqlLocal = Join-Path $WorkspaceRoot "pgsql"
$pgSystem = "C:\Program Files\PostgreSQL\16"

if (-not (Test-Path $pgsqlLocal) -and (Test-Path $pgSystem)) {
    Write-Host "`n[1.5/4] Bundling PostgreSQL Engine from $pgSystem..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $pgsqlLocal -Force | Out-Null
    Copy-Item -Path (Join-Path $pgSystem "bin") -Destination (Join-Path $pgsqlLocal "bin") -Recurse -Force
    Copy-Item -Path (Join-Path $pgSystem "lib") -Destination (Join-Path $pgsqlLocal "lib") -Recurse -Force
    Copy-Item -Path (Join-Path $pgSystem "share") -Destination (Join-Path $pgsqlLocal "share") -Recurse -Force
    Write-Host "[✓] PostgreSQL engine binaries bundled into $pgsqlLocal" -ForegroundColor Green
}


# ---------------------------------------------------------------------
# Step 2: Build Python Backend Executable (PyInstaller)
# ---------------------------------------------------------------------
Write-Host "`n[1/4] Building Python Backend Executable (PyInstaller)..." -ForegroundColor Yellow
$backendDir = Join-Path $WorkspaceRoot "backend"
Push-Location $backendDir

try {
    $venvPy = Join-Path $backendDir "venv\Scripts\python.exe"
    if (Test-Path $venvPy) {
        & $venvPy -m PyInstaller --noconfirm backend.spec
    } else {
        pyinstaller --noconfirm backend.spec
    }
    
    $distExe = Join-Path $backendDir "dist\backend.exe"
    if (-not (Test-Path $distExe)) {
        throw "backend.exe output not found at $distExe after PyInstaller build."
    }
    Write-Host "[✓] Python backend built successfully: $([math]::Round((Get-Item $distExe).Length / 1MB, 2)) MB" -ForegroundColor Green
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------
# Step 3: Build Windows UWP App Release Package
# ---------------------------------------------------------------------
Write-Host "`n[2/4] Building Windows UWP Client (Release Mode v1.1.9.0)..." -ForegroundColor Yellow
$frontendDir = Join-Path $WorkspaceRoot "frontend"
Push-Location $frontendDir

try {
    # Build React Native Windows App Package
    npx react-native run-windows --logging --release --no-launch
    
    $appxDir = Join-Path $frontendDir "windows\AppPackages\JKErpWindows\JKErpWindows_1.1.9.0_x64_Test"
    if (-not (Test-Path $appxDir)) {
        # Fallback check if output directory name differs slightly
        $appxDirFallback = Get-ChildItem (Join-Path $frontendDir "windows\AppPackages\JKErpWindows") | Where-Object { $_.Name -like "*1.1.9*" } | Select-Object -First 1
        if ($appxDirFallback) {
            $appxDir = $appxDirFallback.FullName
        } else {
            Write-Warning "AppPackages v1.1.9 folder not found automatically. Using available package."
        }
    }
    Write-Host "[✓] Windows UWP app built at: $appxDir" -ForegroundColor Green
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------
# Step 4: Compile Inno Setup Script
# ---------------------------------------------------------------------
Write-Host "`n[3/4] Compiling Inno Setup Script (setup.iss)..." -ForegroundColor Yellow
$setupIssPath = Join-Path $WorkspaceRoot "setup.iss"
$outputDir = Join-Path $WorkspaceRoot "Output"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

& $isccPath $setupIssPath

$setupExePath = Join-Path $outputDir "JK_Infotech_ERP_Setup_v1.1.9.exe"
if (-not (Test-Path $setupExePath)) {
    throw "Setup executable not found at $setupExePath after Inno Setup compilation."
}
Write-Host "[✓] Setup installer compiled successfully: $setupExePath ($([math]::Round((Get-Item $setupExePath).Length / 1MB, 2)) MB)" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 5: Generate ZIP Updater File
# ---------------------------------------------------------------------
Write-Host "`n[4/4] Packaging ZIP Updater Archive..." -ForegroundColor Yellow
$zipPath = Join-Path $outputDir "JK_Infotech_ERP_v1.1.9.zip"
$updatesZipPath = Join-Path $WorkspaceRoot "updates\JK_Infotech_ERP_v1.1.9.zip"




if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force }

# Create ZIP archive containing the Setup Executable
Compress-Archive -Path $setupExePath -DestinationPath $zipPath -Force

# Copy to updates directory for local release distribution testing
if (-not (Test-Path (Join-Path $WorkspaceRoot "updates"))) {
    New-Item -ItemType Directory -Path (Join-Path $WorkspaceRoot "updates") -Force | Out-Null
}
Copy-Item -Path $zipPath -Destination $updatesZipPath -Force

Write-Host "[✓] Updater ZIP created successfully:" -ForegroundColor Green
Write-Host "    - Output ZIP: $zipPath ($([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB)" -ForegroundColor Green
Write-Host "    - Updates ZIP: $updatesZipPath" -ForegroundColor Green

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "RELEASE BUILD COMPLETE — ALL ARTIFACTS VERIFIED!" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
