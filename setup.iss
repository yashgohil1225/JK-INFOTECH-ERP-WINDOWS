; =====================================================================
; JK INFOTECH ERP — Professional Silent Setup Installer Script
; File: Y:\JK Infotech ERP\setup.iss
; =====================================================================
[Setup]
AppId={{9428b0f2-9cad-4953-a4b8-da3e6a84d40a}
AppName=JK INFOTECH ERP
AppVersion=1.6.8
AppPublisher=JK Infotech
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible

DefaultDirName={autopf}\JK Infotech ERP
DefaultGroupName=JK INFOTECH ERP
DisableDirPage=yes
DisableProgramGroupPage=yes
DirExistsWarning=no
OutputBaseFilename=JK_Infotech_ERP_Setup_v1.6.8
UninstallFilesDir={app}\uninstall
UninstallDisplayIcon={app}\JK_Infotech_ERP.exe

Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
CloseApplications=yes
RestartApplications=no

[InstallDelete]
; Purge old root uninstaller files, legacy PostgreSQL/Redis binary folders, scripts & obsolete files
Type: filesandordirs; Name: "{app}\unins000.exe"
Type: filesandordirs; Name: "{app}\unins000.dat"
Type: filesandordirs; Name: "{app}\redis"
Type: filesandordirs; Name: "{app}\pgsql"
Type: filesandordirs; Name: "{app}\scripts"
Type: filesandordirs; Name: "{app}\client"
Type: filesandordirs; Name: "{app}\launcher.vbs"
Type: filesandordirs; Name: "{app}\launch-app.ps1"
Type: filesandordirs; Name: "{app}\sideload.ps1"
Type: filesandordirs; Name: "{app}\jk-infotech-icon.ico"

[UninstallDelete]
; Purge residual log files, temporary cache files, and app directories upon uninstallation
Type: filesandordirs; Name: "{app}\*.log"
Type: filesandordirs; Name: "{app}\backend\*.log"
Type: filesandordirs; Name: "{app}\temp"
Type: filesandordirs; Name: "{app}"

[Dirs]
Name: "{commonappdata}\JK Infotech ERP\sqlite_data"; Permissions: users-full

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Copy Visual C++ 2015-2022 Redistributable Installer Prerequisite
Source: "Y:\JK Infotech ERP\redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall ignoreversion

; Copy compiled Single Launcher Executable (JK_Infotech_ERP.exe)
Source: "Y:\JK Infotech ERP\scripts\JK_Infotech_ERP.exe"; DestDir: "{app}"; Flags: ignoreversion

; Copy compiled PyInstaller backend folder (backend.exe, PYZ archive, and dependencies)
Source: "Y:\JK Infotech ERP\backend\dist\backend\*"; DestDir: "{app}\backend"; Flags: recursesubdirs createallsubdirs ignoreversion skipifsourcedoesntexist

; Extract UWP client MSIX package into {tmp} (purged automatically after AppX registration)
Source: "Y:\JK Infotech ERP\frontend\windows\AppPackages\JKErpWindows\JKErpWindows_1.6.8.0_x64_Test\*"; DestDir: "{tmp}\client\package"; Flags: recursesubdirs createallsubdirs deleteafterinstall ignoreversion

Source: "Y:\JK Infotech ERP\backend\.env.example"; DestDir: "{app}\backend"; DestName: ".env"; Flags: ignoreversion

; Extract portable PostgreSQL engine binaries into {tmp} exclusively for setup migration (purged after setup)
Source: "Y:\JK Infotech ERP\pgsql\*"; DestDir: "{tmp}\pgsql"; Flags: recursesubdirs createallsubdirs deleteafterinstall ignoreversion skipifsourcedoesntexist

; Extract standalone migration binary into {tmp} exclusively for setup migration (purged after setup)
Source: "Y:\JK Infotech ERP\scripts\migrate-db.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall ignoreversion skipifsourcedoesntexist

[Icons]
; Desktop & Start Menu shortcuts target single compiled executable
Name: "{autodesktop}\JK INFOTECH ERP"; Filename: "{app}\JK_Infotech_ERP.exe"; IconFilename: "{app}\JK_Infotech_ERP.exe"; IconIndex: 0
Name: "{group}\JK INFOTECH ERP"; Filename: "{app}\JK_Infotech_ERP.exe"; IconFilename: "{app}\JK_Infotech_ERP.exe"; IconIndex: 0
Name: "{group}\Uninstall JK INFOTECH ERP"; Filename: "{app}\uninstall\unins000.exe"; IconFilename: "{app}\uninstall\unins000.exe"; IconIndex: 0

[Registry]
; Configure the Backend backend.exe executable to launch automatically when user logs in
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "JK_Infotech_ERP_Backend"; ValueData: """{app}\backend\backend.exe"""; Flags: uninsdeletevalue

; System-wide App Sideloading & Developer Mode registry unlocks for MSIX/AppX packages
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"; ValueType: dword; ValueName: "AllowAllTrustedApps"; ValueData: 1
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"; ValueType: dword; ValueName: "AllowDevelopmentWithoutDevLicense"; ValueData: 1

[Run]
; 0. Silently Install Visual C++ 2015-2022 Redistributable Runtime Prerequisites (only if missing)
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Visual C++ Runtime prerequisites..."; Flags: runhidden skipifdoesntexist; Check: NotVCRedistInstalled

; 1. Run One-Time Database Migration directly during setup installation if legacy PostgreSQL data exists
Filename: "{tmp}\migrate-db.exe"; StatusMsg: "Migrating existing database to high-performance SQLite engine..."; Flags: skipifdoesntexist runasoriginaluser

; 1.5 Stop and unregister any legacy PostgreSQL service registration from previous versions
Filename: "net.exe"; Parameters: "stop JK_Infotech_PostgreSQL"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete JK_Infotech_PostgreSQL"; Flags: runhidden

; 1.6 Stop and unregister any legacy Redis service registration from previous versions
Filename: "net.exe"; Parameters: "stop JK_Infotech_Redis"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete JK_Infotech_Redis"; Flags: runhidden

; 2. Grant Authenticated Users & LocalSystem full control over sqlite_data directory
Filename: "icacls.exe"; Parameters: """{commonappdata}\JK Infotech ERP"" /grant ""*S-1-5-11:(OI)(CI)F"" /T /q"; StatusMsg: "Configuring database directory permissions..."; Flags: runhidden

; 3. Sideload Certificate to Trusted Root & Trusted People stores globally
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""$cert = Get-ChildItem -Path '{tmp}\client' -Filter '*.cer' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1; if ($cert) {{ Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\LocalMachine\Root -ErrorAction SilentlyContinue; Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\LocalMachine\TrustedPeople -ErrorAction SilentlyContinue; Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\CurrentUser\TrustedPeople -ErrorAction SilentlyContinue }}"""; StatusMsg: "Installing application signing credentials..."; Flags: runhidden

; 4. Apply Network Loopback exemption (requires admin elevation)
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""$pkg = Get-AppxPackage *9428b0f2-9cad-4953-a4b8-da3e6a84d40a* | Select-Object -First 1; if ($pkg) {{ CheckNetIsolation.exe LoopbackExempt -a -n=$pkg.PackageFamilyName }}"""; StatusMsg: "Configuring local network sandbox access..."; Flags: runhidden

; 5. Provision MSIX package system-wide (pre-registers for all current & new Windows user accounts)
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""$pkg = Get-ChildItem -Path '{tmp}\client\package' -Filter 'JKErpWindows*.msix' -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if (-not $pkg) {{ $pkg = Get-ChildItem -Path '{tmp}\client\package' -Filter '*.msix' -Recurse -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -notmatch 'VCLibs|Xaml' }} | Select-Object -First 1 }}; $deps = Get-ChildItem -Path '{tmp}\client\package\Dependencies\x64' -Filter '*.appx' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName; if ($pkg) {{ if ($deps) {{ Add-AppxProvisionedPackage -Online -PackagePath $pkg.FullName -DependencyPackagePath $deps -SkipLicense -ErrorAction SilentlyContinue }} else {{ Add-AppxProvisionedPackage -Online -PackagePath $pkg.FullName -SkipLicense -ErrorAction SilentlyContinue }} }}"""; StatusMsg: "Provisioning client interface package system-wide..."; Flags: runhidden

; 6. Fast direct MSIX registration for current user profile
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""$pkg = Get-ChildItem -Path '{tmp}\client\package' -Filter 'JKErpWindows*.msix' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1; if ($pkg) {{ Add-AppxPackage -Path $pkg.FullName -ForceUpdateFromAnyVersion -ErrorAction SilentlyContinue }}"""; StatusMsg: "Installing Windows desktop client interface..."; Flags: runhidden

; 7. Automatically launch the desktop UI interface after installation completes
Filename: "{app}\JK_Infotech_ERP.exe"; Description: "{cm:LaunchProgram,JK INFOTECH ERP}"; Flags: nowait postinstall runasoriginaluser

[UninstallRun]
; 1. Stop and Unregister any legacy PostgreSQL Service if present
Filename: "net.exe"; Parameters: "stop JK_Infotech_PostgreSQL"; Flags: runhidden; RunOnceId: "StopPostgres"
Filename: "sc.exe"; Parameters: "delete JK_Infotech_PostgreSQL"; Flags: runhidden; RunOnceId: "UnregisterPostgres"

; 1.5 Stop and Unregister any legacy Redis Service if present
Filename: "net.exe"; Parameters: "stop JK_Infotech_Redis"; Flags: runhidden; RunOnceId: "StopRedis"
Filename: "sc.exe"; Parameters: "delete JK_Infotech_Redis"; Flags: runhidden; RunOnceId: "UnregisterRedis"

; 2. Uninstall the frontend UWP Application Package
Filename: "powershell.exe"; Parameters: "-Command ""Get-AppxPackage *9428b0f2-9cad-4953-a4b8-da3e6a84d40a* | Remove-AppxPackage"""; Flags: runhidden; RunOnceId: "UninstallUWP"

[Code]
// Helper function: Check if Visual C++ 2015-2022 Redistributable x64 runtime is already installed
function NotVCRedistInstalled: Boolean;
var
  Installed: Cardinal;
begin
  Result := True;
  // Check 64-bit registry view (VC++ x64 runtime registers under 64-bit HKLM)
  if RegQueryDWordValue(HKLM64, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', Installed) then
  begin
    if Installed = 1 then
      Result := False;
  end;
  // Fallback check 32-bit registry view
  if Result and RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', Installed) then
  begin
    if Installed = 1 then
      Result := False;
  end;
end;

// Pre-Install hook: Gracefully terminate active app processes before file extraction
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  // 1. Terminate application processes to ensure no file handle locks during overwrite
  Exec('taskkill.exe', '/F /IM backend.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/F /IM JK_Infotech_ERP.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  // Give Windows OS time to finalize file handle releases
  Sleep(500);
end;
