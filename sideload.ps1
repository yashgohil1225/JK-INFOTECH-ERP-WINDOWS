# JK Infotech ERP — Post-Install Sideloader
# Runs as the logged-in user (non-elevated) to register the UWP package
param([string]$ClientPath)

# Import certificate to current user's TrustedPeople store
$cert = Get-ChildItem -Path $ClientPath -Filter '*.cer' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($cert) {
    try { Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\CurrentUser\TrustedPeople -ErrorAction SilentlyContinue } catch {}
}

# Perform in-place update of UWP package to preserve LocalState & user sessions

# Install dependency packages individually first (skip errors if already installed)
$depsPath = Join-Path $ClientPath "Dependencies\x64"
if (Test-Path $depsPath) {
    Get-ChildItem -Path $depsPath -Filter '*.appx' -ErrorAction SilentlyContinue | ForEach-Object {
        try { Add-AppxPackage -Path $_.FullName -ErrorAction SilentlyContinue } catch {}
    }
}

# Install the main MSIX package (with force shutdown flags for seamless update)
$pkg = Get-ChildItem -Path "$ClientPath\*" -Include '*.msix', '*.msixbundle', '*.appx' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'VCLibs|Xaml' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($pkg) {
    try {
        Add-AppxPackage -Path $pkg.FullName -ForceApplicationShutdown -ForceTargetAppShutdown -ErrorAction Stop
    } catch {
        Write-Warning "Add-AppxPackage initial attempt error: $_. Retrying standard install..."
        try {
            Add-AppxPackage -Path $pkg.FullName -ErrorAction SilentlyContinue
        } catch {}
    }
}

