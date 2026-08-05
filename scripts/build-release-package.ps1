# =====================================================================
# JK INFOTECH ERP — Automated Master Release & Packaging Script
# File: Y:\JK Infotech ERP\build-release-package.ps1
# =====================================================================

$ErrorActionPreference = "Stop"
$WorkspaceRoot = Split-Path $PSScriptRoot -Parent
$AppVersion = "1.6.3"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "JK INFOTECH ERP v$AppVersion — Full Release Packaging" -ForegroundColor Cyan
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
    Write-Error "Inno Setup Compiler (ISCC.exe) was not found in standard paths. Please ensure Inno Setup 6 or 7 is installed."
}
Write-Host "[✓] Inno Setup Compiler found: $isccPath" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 1.5: Bundle PostgreSQL Engine Binaries & VC++ Prerequisites
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

# Copy VC++ Runtime DLLs directly into pgsql\bin to guarantee DLL resolution on clean Windows PCs
$pgsqlBin = Join-Path $pgsqlLocal "bin"
if (Test-Path $pgsqlBin) {
    $sys32 = "$env:SystemRoot\System32"
    $vcDlls = @("vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll")
    foreach ($dll in $vcDlls) {
        $srcDll = Join-Path $sys32 $dll
        if (Test-Path $srcDll) {
            Copy-Item -Path $srcDll -Destination (Join-Path $pgsqlBin $dll) -Force
        }
    }
    Write-Host "[✓] VC++ runtime DLLs injected into $pgsqlBin" -ForegroundColor Green
}

# Bundle VC_redist.x64.exe prerequisite installer
$redistDir = Join-Path $WorkspaceRoot "redist"
$vcRedistExe = Join-Path $redistDir "vc_redist.x64.exe"
if (-not (Test-Path $vcRedistExe)) {
    New-Item -ItemType Directory -Path $redistDir -Force | Out-Null
    $vsRedistCandidates = @(
        "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Redist\MSVC\v143\vc_redist.x64.exe",
        "C:\Program Files (x86)\Microsoft Visual Studio\Installer\resources\app\layout\VC_redist.x64.exe"
    )
    foreach ($candidate in $vsRedistCandidates) {
        if (Test-Path $candidate) {
            Copy-Item -Path $candidate -Destination $vcRedistExe -Force
            break
        }
    }
    if (-not (Test-Path $vcRedistExe)) {
        Write-Host "Downloading Microsoft Visual C++ 2015-2022 Redistributable..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vc_redist.x64.exe" -OutFile $vcRedistExe
    }
}
Write-Host "[✓] VC++ Redistributable bundled at: $vcRedistExe" -ForegroundColor Green

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
Write-Host "`n[2/4] Building Windows UWP Client (Release Mode v${AppVersion}.0)..." -ForegroundColor Yellow
$frontendDir = Join-Path $WorkspaceRoot "frontend"
Push-Location $frontendDir

try {
    # Build React Native Windows App Package with sideload package creation enabled
    npx react-native run-windows --logging --release --no-launch --arch x64 --msbuildprops "AppxPackageSigningEnabled=true,UapAppxPackageBuildMode=SideLoadOnly,AppxBundle=Never"
    
    $appxDir = Join-Path $frontendDir "windows\AppPackages\JKErpWindows\JKErpWindows_${AppVersion}.0_x64_Test"
    if (-not (Test-Path $appxDir)) {
        # Fallback check if output directory name differs slightly
        $appxDirFallback = Get-ChildItem (Join-Path $frontendDir "windows\AppPackages\JKErpWindows") | Where-Object { $_.Name -like "*${AppVersion}*" } | Select-Object -First 1
        if ($appxDirFallback) {
            $appxDir = $appxDirFallback.FullName
        } else {
            throw "AppPackages folder not found at $appxDir after React Native Windows build."
        }
    }
    Write-Host "[✓] Windows UWP app built at: $appxDir" -ForegroundColor Green
    
    # Inject UWP C++ runtime _app.dll files into standalone Release binary folder
    $releaseBinDir = Join-Path $frontendDir "windows\x64\Release\JKErpWindows"
    if (Test-Path $releaseBinDir) {
        $cbsDir = "C:\Windows\SystemApps\MicrosoftWindows.Client.CBS_cw5n1h2txyewy"
        if (Test-Path $cbsDir) {
            Copy-Item -Path "$cbsDir\*_app.dll" -Destination $releaseBinDir -Force -ErrorAction SilentlyContinue
            Write-Host "[✓] UWP C++ runtime DLLs (msvcp140_app.dll) injected into standalone client folder" -ForegroundColor Green
        }
    }
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

$setupExePath = Join-Path $outputDir "JK_Infotech_ERP_Setup_v${AppVersion}.exe"
if (-not (Test-Path $setupExePath)) {
    throw "Setup executable not found at $setupExePath after Inno Setup compilation."
}
Write-Host "[✓] Setup installer compiled successfully: $setupExePath ($([math]::Round((Get-Item $setupExePath).Length / 1MB, 2)) MB)" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 5: Generate ZIP Updater File
# ---------------------------------------------------------------------
Write-Host "`n[4/4] Packaging ZIP Updater Archive..." -ForegroundColor Yellow
$zipPath = Join-Path $outputDir "JK_Infotech_ERP_v${AppVersion}.zip"
$updatesZipPath = Join-Path $WorkspaceRoot "updates\JK_Infotech_ERP_v${AppVersion}.zip"

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
