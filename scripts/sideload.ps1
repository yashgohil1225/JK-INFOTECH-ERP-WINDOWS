# JK Infotech ERP — Post-Install Sideloader
# Registers certificate, dependencies, and UWP/MSIX package with detailed logging
param([string]$ClientPath)

if (-not $ClientPath) {
    # Default: look in {app}\client\package, then {app}\client
    $scriptParent = Split-Path $PSScriptRoot -Parent
    $pkgPath = Join-Path $scriptParent "client\package"
    if (Test-Path $pkgPath) {
        $ClientPath = $pkgPath
    } else {
        $ClientPath = Join-Path $scriptParent "client"
    }
}

$logFile = Join-Path (Split-Path $ClientPath -Parent) "sideload.log"
"--- JK INFOTECH ERP Sideload Log: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ---" | Out-File -FilePath $logFile -Encoding utf8 -Force

function Log-Message {
    param([string]$Message)
    Write-Host $Message
    "[$((Get-Date).ToString('HH:mm:ss'))] $Message" | Out-File -FilePath $logFile -Append -Encoding utf8
}

Log-Message "Starting sideload procedure from: $ClientPath"

# 1. Enable Sideloading Registry Keys
try {
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name "AllowAllTrustedApps" -Value 1 -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name "AllowDevelopmentWithoutDevLicense" -Value 1 -Type DWord -ErrorAction SilentlyContinue
    Log-Message "AppModelUnlock registry keys verified."
} catch {
    Log-Message "Notice: HKLM AppModelUnlock update skipped: $_"
}

# 2. Find and import signing certificate
# Search in ClientPath and one level up (in case called with client\package)
$certSearchPaths = @($ClientPath, (Split-Path $ClientPath -Parent))
$cert = $null
foreach ($searchPath in $certSearchPaths) {
    $cert = Get-ChildItem -Path $searchPath -Filter '*.cer' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cert) { break }
}

if ($cert) {
    Log-Message "Found signing certificate: $($cert.FullName)"
    try { Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\CurrentUser\TrustedPeople -ErrorAction SilentlyContinue; Log-Message "Certificate -> CurrentUser\TrustedPeople" } catch {}
    try { Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\LocalMachine\Root -ErrorAction SilentlyContinue; Log-Message "Certificate -> LocalMachine\Root" } catch {}
    try { Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\LocalMachine\TrustedPeople -ErrorAction SilentlyContinue; Log-Message "Certificate -> LocalMachine\TrustedPeople" } catch {}
} else {
    Log-Message "Warning: No .cer certificate file found in $ClientPath"
}

# 3. Unregister any existing version cleanly
Log-Message "Unregistering any existing version of the package..."
try {
    Get-AppxPackage -Name "*9428b0f2*" -AllUsers -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Get-AppxPackage -Name "*9428b0f2*" -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
    Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*9428b0f2*" } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
    Log-Message "Previous package registration cleared."
} catch {
    Log-Message "Notice clearing previous package: $_"
}

# 4. Find x64 dependency packages
$depFiles = @()
$depsPathX64 = Join-Path $ClientPath "Dependencies\x64"
if (Test-Path $depsPathX64) {
    $depFiles = Get-ChildItem -Path $depsPathX64 -Filter '*.appx' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
    Log-Message "Found $($depFiles.Count) x64 dependency packages in x64 subdirectory."
} else {
    $depsPath = Join-Path $ClientPath "Dependencies"
    if (Test-Path $depsPath) {
        $depFiles = Get-ChildItem -Path $depsPath -Recurse -Filter '*.appx' -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '\\x64\\' } | Select-Object -ExpandProperty FullName
        Log-Message "Found $($depFiles.Count) x64 dependency packages in Dependencies folder."
    }
}

# 5. Pre-install each dependency individually
foreach ($dep in $depFiles) {
    try {
        Add-AppxPackage -Path $dep -ErrorAction SilentlyContinue
        Log-Message "Installed dependency: $(Split-Path $dep -Leaf)"
    } catch {
        Log-Message "Notice installing dependency $(Split-Path $dep -Leaf): $_"
    }
}

# 6. Find the main MSIX package file
$pkg = Get-ChildItem -Path $ClientPath -Filter 'JKErpWindows*.msix' -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $pkg) {
    $pkg = Get-ChildItem -Path $ClientPath -Filter '*.msix' -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch 'VCLibs|Xaml' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $pkg) {
    $pkg = Get-ChildItem -Path $ClientPath -Filter '*.msixbundle' -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

if ($pkg) {
    Log-Message "Registering main app package: $($pkg.Name)"
    $success = $false

    # Attempt 1: Plain install (dependencies already pre-installed above)
    try {
        Add-AppxPackage -Path $pkg.FullName -ForceUpdateFromAnyVersion -ErrorAction Stop
        Log-Message "[SUCCESS] Add-AppxPackage completed."
        $success = $true
    } catch {
        Log-Message "Attempt 1 failed: $_"
    }

    # Attempt 2: With explicit dependency array
    if (-not $success -and $depFiles.Count -gt 0) {
        try {
            Add-AppxPackage -Path $pkg.FullName -DependencyPath $depFiles -ForceUpdateFromAnyVersion -ErrorAction Stop
            Log-Message "[SUCCESS] Add-AppxPackage with DependencyPath completed."
            $success = $true
        } catch {
            Log-Message "Attempt 2 failed: $_"
        }
    }

    if ($success) {
        Log-Message "Verifying installation..."
        Start-Sleep -Seconds 2
        $installed = Get-AppxPackage -Name "*9428b0f2*" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($installed) {
            Log-Message "[VERIFIED] Package registered: $($installed.PackageFamilyName) v$($installed.Version)"
        } else {
            Log-Message "[WARNING] Package command succeeded but package not found in registry. May need a moment."
        }
    } else {
        Log-Message "[ERROR] All registration attempts failed for $($pkg.Name)"
    }
} else {
    Log-Message "[ERROR] No MSIX package file found in: $ClientPath"
}

# 7. Dynamic Loopback Exemption for UWP AppContainer (needed to reach localhost backend)
try {
    $installedPkg = Get-AppxPackage -Name "*9428b0f2*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($installedPkg) {
        CheckNetIsolation.exe LoopbackExempt -a "-n=$($installedPkg.PackageFamilyName)" 2>$null | Out-Null
        Log-Message "[SUCCESS] Loopback exemption granted for $($installedPkg.PackageFamilyName)"
    }
} catch {
    Log-Message "Notice: Loopback exemption update skipped: $_"
}

Log-Message "Sideload procedure finished."
