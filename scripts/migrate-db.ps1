# =====================================================================
# JK INFOTECH ERP — Database Auto-Migration Utility for Upgrades
# Automatically detects and migrates legacy client databases from AppData
# into the setup installation directory if no database is present.
# =====================================================================
param (
    [string]$TargetDataDir = ""
)

if (-not $TargetDataDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $appDir = Split-Path -Parent $scriptDir
    $TargetDataDir = Join-Path $appDir "pg_data"
}

$targetPgVersion = Join-Path $TargetDataDir "PG_VERSION"
if (-not (Test-Path $targetPgVersion)) {
    $appData = [Environment]::GetFolderPath('ApplicationData')
    $legacyDirs = @(
        "jk-erp-frontend\data",
        "frontend\data"
    )
    foreach ($dir in $legacyDirs) {
        $src = Join-Path $appData $dir
        $srcVersion = Join-Path $src "PG_VERSION"
        if (Test-Path $srcVersion) {
            Write-Host "Migrating legacy database from $src to $TargetDataDir..."
            if (-not (Test-Path $TargetDataDir)) {
                New-Item -ItemType Directory -Path $TargetDataDir -Force | Out-Null
            }
            Copy-Item -Path (Join-Path $src "*") -Destination $TargetDataDir -Recurse -Force
            Write-Host "Migration complete!"
            break
        }
    }
}
