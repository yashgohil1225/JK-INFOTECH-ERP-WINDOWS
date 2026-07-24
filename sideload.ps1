# JK Infotech ERP — Post-Install Sideloader
# Runs as the logged-in user (non-elevated) to register the UWP package
param([string]$ClientPath)

# Import certificate to current user's TrustedPeople store
$cert = Get-ChildItem -Path $ClientPath -Filter '*.cer' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($cert) {
    try { Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\CurrentUser\TrustedPeople -ErrorAction SilentlyContinue } catch {}
}

# Remove any existing version
Get-AppxPackage *9428b0f2-9cad-4953-a4b8-da3e6a84d40a* -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue

# Install dependency packages individually first (skip errors if already installed)
$depsPath = Join-Path $ClientPath "Dependencies\x64"
if (Test-Path $depsPath) {
    Get-ChildItem -Path $depsPath -Filter '*.appx' -ErrorAction SilentlyContinue | ForEach-Object {
        try { Add-AppxPackage -Path $_.FullName -ErrorAction SilentlyContinue } catch {}
    }
}

# Install the main MSIX package (no -DependencyPath to avoid locking conflicts)
$pkg = Get-ChildItem -Path "$ClientPath\*" -Include '*.msix', '*.msixbundle', '*.appx' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'VCLibs|Xaml' } | Select-Object -First 1
if ($pkg) {
    Add-AppxPackage -Path $pkg.FullName
}
