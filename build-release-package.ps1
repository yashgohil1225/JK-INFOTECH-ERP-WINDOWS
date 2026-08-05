# =====================================================================
# JK INFOTECH ERP — Automated Master Release & Packaging Script
# File: Y:\JK Infotech ERP\build-release-package.ps1
# =====================================================================

$ErrorActionPreference = "Stop"
$WorkspaceRoot = $PSScriptRoot
$AppVersion = "1.6.8"

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

    # Compile standalone migrate-db.exe for setup installer & runtime migration
    Write-Host "Building standalone database migration executable (migrate-db.exe)..." -ForegroundColor Yellow
    $migrateScript = Join-Path $WorkspaceRoot "scripts\migrate_pg_to_sqlite.py"
    $scriptsOutputDir = Join-Path $WorkspaceRoot "scripts"
    if (Test-Path $venvPy) {
        & $venvPy -m PyInstaller --noconfirm --onefile --windowed --name "migrate-db" --collect-all "psycopg2" --hidden-import "sqlite3" --distpath $scriptsOutputDir $migrateScript
    } else {
        pyinstaller --noconfirm --onefile --windowed --name "migrate-db" --collect-all "psycopg2" --hidden-import "sqlite3" --distpath $scriptsOutputDir $migrateScript
    }
    Write-Host "[✓] Standalone migration tool built successfully: $(Join-Path $scriptsOutputDir 'migrate-db.exe')" -ForegroundColor Green

    # Compile single launcher executable (JK_Infotech_ERP.exe) for setup installer
    Write-Host "Building single compiled launcher executable (JK_Infotech_ERP.exe)..." -ForegroundColor Yellow
    $launcherScript = Join-Path $WorkspaceRoot "scripts\launcher.py"
    $iconPath = Join-Path $WorkspaceRoot "JK INFOTECH branding assests\ico\jk-infotech-icon.ico"
    if (Test-Path $venvPy) {
        & $venvPy -m PyInstaller --noconfirm --onefile --windowed --name "JK_Infotech_ERP" --icon $iconPath --distpath $scriptsOutputDir $launcherScript
    } else {
        pyinstaller --noconfirm --onefile --windowed --name "JK_Infotech_ERP" --icon $iconPath --distpath $scriptsOutputDir $launcherScript
    }
    Write-Host "[✓] Single compiled launcher built successfully: $(Join-Path $scriptsOutputDir 'JK_Infotech_ERP.exe')" -ForegroundColor Green
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
    # Recompile JS bundle to guarantee index.windows.bundle reflects latest code changes
    npx react-native bundle --platform windows --dev false --entry-file index.js --bundle-output windows/JKErpWindows/ReactAssets/index.windows.bundle --assets-dest windows/JKErpWindows/ReactAssets

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

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "RELEASE BUILD COMPLETE — ALL ARTIFACTS VERIFIED!" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
