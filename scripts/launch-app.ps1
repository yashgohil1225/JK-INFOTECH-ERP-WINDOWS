# =====================================================================
# JK INFOTECH ERP — UWP App Launch Script
# Called by launcher.vbs to activate the UWP app
# Uses protocol scheme activation (jkerpwindows:) and AUMID fallback
# =====================================================================

$appName = "9428b0f2-9cad-4953-a4b8-da3e6a84d40a"
$scriptDir = Split-Path $PSScriptRoot -Parent  # {app} folder

$logFile = Join-Path $scriptDir "launch-app.log"
"--- Launch attempt: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ---" | Out-File $logFile -Append -Encoding utf8

function Log { param($m); $m | Out-File $logFile -Append -Encoding utf8; Write-Host $m }

# Step 1: Try launching via registered Windows protocol scheme (jkerpwindows:)
# This is the fastest, most direct UWP activation method supported by Windows 10 & 11
try {
    Log "Attempting launch via jkerpwindows: protocol..."
    Start-Process "jkerpwindows:" -ErrorAction Stop
    Log "[SUCCESS] App launched via jkerpwindows: protocol"
    exit 0
} catch {
    Log "Protocol launch notice: $_"
}

# Step 2: Try launching via AUMID shell:AppsFolder
$pkg = Get-AppxPackage -Name "*$appName*" -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1
if (-not $pkg) {
    $pkg = Get-AppxPackage -Name "*$appName*" -AllUsers -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1
}

if ($pkg) {
    $aumid = $pkg.PackageFamilyName + "!App"
    Log "Package found: $($pkg.PackageFamilyName) v$($pkg.Version)"
    try {
        Start-Process "shell:AppsFolder\$aumid" -ErrorAction Stop
        Log "[SUCCESS] App launched via shell:AppsFolder\$aumid"
        exit 0
    } catch {
        Log "shell:AppsFolder launch failed: $_"
    }
}

# Step 3: Fast-path registration if package is not registered for current user
Log "Package not registered for current user. Executing fast registration..."
$clientPkgDir = Join-Path $scriptDir "client\package"
if (-not (Test-Path $clientPkgDir)) { $clientPkgDir = Join-Path $scriptDir "client" }

$msixFile = Get-ChildItem -Path $clientPkgDir -Filter "JKErpWindows*.msix" -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $msixFile) {
    $msixFile = Get-ChildItem -Path $clientPkgDir -Filter "*.msix" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'VCLibs|Xaml' } | Select-Object -First 1
}

if ($msixFile) {
    try {
        Log "Fast registering MSIX package: $($msixFile.Name)..."
        Add-AppxPackage -Path $msixFile.FullName -ForceUpdateFromAnyVersion -ErrorAction Stop
        Start-Sleep -Seconds 1
        Start-Process "jkerpwindows:" -ErrorAction Stop
        Log "[SUCCESS] App launched after fast registration"
        exit 0
    } catch {
        Log "Fast registration notice: $_"
    }
}

# Step 4: Final launch attempt after registration
$pkg = Get-AppxPackage -Name "*$appName*" -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1
if ($pkg) {
    $aumid = $pkg.PackageFamilyName + "!App"
    Log "Post-registration launch: $aumid"
    try {
        Start-Process "shell:AppsFolder\$aumid" -ErrorAction Stop
        Log "[SUCCESS] App launched post-registration"
        exit 0
    } catch {
        Log "Post-registration launch failed: $_"
    }
}

Log "[ERROR] Could not launch JK INFOTECH ERP."

