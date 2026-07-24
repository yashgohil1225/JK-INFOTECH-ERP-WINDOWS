# =====================================================================
# JK INFOTECH ERP — Dynamic Redis Resource Auto-Tuner
# Auto-configures Redis maxmemory based on host machine RAM capacity
# =====================================================================

param (
    [string]$RedisDir = "$PSScriptRoot\..\redis"
)

try {
    $ramGb = [math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1MB)
    
    # Calculate recommended maxmemory based on RAM capacity tier
    if ($ramGb -le 4) {
        $maxMem = "256mb"
    } elseif ($ramGb -le 8) {
        $maxMem = "512mb"
    } elseif ($ramGb -le 16) {
        $maxMem = "1gb"
    } else {
        $maxMem = "2gb"
    }

    Write-Host "[JK ERP] Detected System RAM: ${ramGb} GB. Auto-tuning Redis maxmemory to: $maxMem"

    $configFiles = @("$RedisDir\redis.windows.conf", "$RedisDir\redis.windows-service.conf")

    foreach ($file in $configFiles) {
        if (Test-Path $file) {
            $content = Get-Content $file -Raw
            # Replace existing maxmemory line or append
            if ($content -match "(?m)^maxmemory\s+\S+") {
                $content = $content -replace "(?m)^maxmemory\s+\S+", "maxmemory $maxMem"
            } else {
                $content += "`r`nmaxmemory $maxMem`r`nmaxmemory-policy allkeys-lru`r`n"
            }
            Set-Content -Path $file -Value $content -NoNewline
            Write-Host "[JK ERP] Updated configuration in: $file"
        }
    }
} catch {
    Write-Warning "Failed to auto-tune Redis memory: $_"
}
