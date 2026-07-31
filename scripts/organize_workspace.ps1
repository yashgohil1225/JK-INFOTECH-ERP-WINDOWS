# =====================================================================
# JK INFOTECH ERP — Workspace Cleanup & Folder Organization Utility
# File: Y:\JK Infotech ERP\scripts\organize_workspace.ps1
# =====================================================================

$root = "Y:\JK Infotech ERP"

# 1. Remove unwanted log and binary log files
$unwantedFiles = @(
    (Join-Path $root "msbuild.binlog"),
    (Join-Path $root "frontend\build.log"),
    (Join-Path $root "frontend\msbuild.binlog"),
    (Join-Path $root "backend\error.log"),
    (Join-Path $root "backend\diagnostic_secret.txt"),
    (Join-Path $root "backend\test_invoice.pdf"),
    (Join-Path $root "backend\erp.db"),
    (Join-Path $root "backend\jk_erp.db")
)

foreach ($file in $unwantedFiles) {
    if (Test-Path $file) {
        Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
        Write-Host "[Deleted Junk File] $file" -ForegroundColor Yellow
    }
}

# 2. Clean PyInstaller intermediate build folder
$backendBuild = Join-Path $root "backend\build"
if (Test-Path $backendBuild) {
    Remove-Item -Path $backendBuild -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[Deleted Folder] $backendBuild" -ForegroundColor Yellow
}

# 3. Create backend\tools directory and move scratch .py scripts into backend\tools
$toolsDir = Join-Path $root "backend\tools"
if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
}

$scratchScripts = @(
    "activate_cos.py",
    "check_cos.py",
    "check_db_data.py",
    "check_db_full.py",
    "check_paths.py",
    "check_roaming_db.py",
    "check_sqlite.py",
    "clean_companies.py",
    "fetch_cos.py",
    "generate_key.py",
    "reconcile_cos.py",
    "rename_co.py",
    "test_db.py",
    "test_pdf.py",
    "unlock_script.py"
)

foreach ($script in $scratchScripts) {
    $sSrc = Join-Path $root "backend\$script"
    $sDst = Join-Path $toolsDir $script
    if (Test-Path $sSrc) {
        Move-Item -Path $sSrc -Destination $sDst -Force -ErrorAction SilentlyContinue
        Write-Host "[Moved to backend\tools\] $script" -ForegroundColor Cyan
    }
}

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "WORKSPACE CLEANUP & ORGANIZATION COMPLETE!" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
