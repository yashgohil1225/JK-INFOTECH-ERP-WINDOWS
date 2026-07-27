; =====================================================================
; JK INFOTECH ERP — Professional Silent Setup Installer Script
; File: Y:\JK Infotech ERP\setup.iss
; =====================================================================

[Setup]
AppId={{9428b0f2-9cad-4953-a4b8-da3e6a84d40a}
AppName=JK INFOTECH ERP
AppVersion=1.0.9
AppPublisher=JK Infotech
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64
DefaultDirName={autopf}\JK Infotech ERP
DefaultGroupName=JK INFOTECH ERP
DisableProgramGroupPage=yes
OutputBaseFilename=JK_Infotech_ERP_Setup_v1.0.9
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Dirs]
Name: "{app}\pg_data"; Permissions: users-full

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Copy PostgreSQL folder
Source: "Y:\JK Infotech ERP\pgsql\*"; DestDir: "{app}\pgsql"; Flags: recursesubdirs createallsubdirs

; Copy Redis cache engine folder
Source: "Y:\JK Infotech ERP\redis\*"; DestDir: "{app}\redis"; Flags: recursesubdirs createallsubdirs ignoreversion

; Copy compiled PyInstaller backend executable
Source: "Y:\JK Infotech ERP\backend\dist\backend.exe"; DestDir: "{app}\backend"; Flags: ignoreversion

; Copy the UWP client MSIX package and dependencies
Source: "Y:\JK Infotech ERP\frontend\windows\AppPackages\JKErpWindows\JKErpWindows_1.0.9.0_x64_Test\*"; DestDir: "{app}\client"; Flags: recursesubdirs createallsubdirs ignoreversion

Source: "Y:\JK Infotech ERP\backend\.env.example"; DestDir: "{app}\backend"; DestName: ".env"; Flags: onlyifdoesntexist

; Copy branding icon for shortcuts
Source: "Y:\JK Infotech ERP\JK INFOTECH branding assests\ico\jk-infotech-icon.ico"; DestDir: "{app}"; Flags: ignoreversion

; Copy silent VBS launcher script
Source: "Y:\JK Infotech ERP\launcher.vbs"; DestDir: "{app}"; Flags: ignoreversion

; Copy sideload helper script
Source: "Y:\JK Infotech ERP\sideload.ps1"; DestDir: "{app}"; Flags: ignoreversion

; Copy helper scripts folder
Source: "Y:\JK Infotech ERP\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs createallsubdirs ignoreversion

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Icons]
Name: "{autodesktop}\JK INFOTECH ERP"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; IconFilename: "{app}\jk-infotech-icon.ico"; IconIndex: 0; Tasks: desktopicon
Name: "{group}\JK INFOTECH ERP"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; IconFilename: "{app}\jk-infotech-icon.ico"; IconIndex: 0

[Registry]
; Configure the Backend backend.exe executable to launch automatically when user logs in
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "JK_Infotech_ERP_Backend"; ValueData: """{app}\backend\backend.exe"""; Flags: uninsdeletevalue

[Run]
; 1. Always stop and unregister any legacy/stale PostgreSQL service registration to guarantee valid path
Filename: "net.exe"; Parameters: "stop JK_Infotech_PostgreSQL"; Flags: runhidden
Filename: "{app}\pgsql\bin\pg_ctl.exe"; Parameters: "unregister -N ""JK_Infotech_PostgreSQL"""; Flags: runhidden

; 1.5 Always stop and unregister any legacy/stale Redis service registration to guarantee valid path
Filename: "net.exe"; Parameters: "stop JK_Infotech_Redis"; Flags: runhidden
Filename: "{app}\redis\redis-server.exe"; Parameters: "--service-uninstall --service-name ""JK_Infotech_Redis"""; Flags: runhidden

; 2. Initialize PostgreSQL Data Cluster database (Only if data folder does not exist)
Filename: "{app}\pgsql\bin\initdb.exe"; Parameters: "-D ""{app}\pg_data"" -U postgres --auth-host=trust --auth-local=trust"; StatusMsg: "Initializing local database server..."; Flags: runhidden; Check: NotDataDirExists

; 2.5 Grant LocalSystem full control over pg_data directory
Filename: "icacls.exe"; Parameters: """{app}\pg_data"" /grant ""NT AUTHORITY\LocalSystem:(OI)(CI)F"" /T /q"; StatusMsg: "Configuring database directory permissions..."; Flags: runhidden

; 3. Register PostgreSQL as a native Windows Service with current installation path
Filename: "{app}\pgsql\bin\pg_ctl.exe"; Parameters: "register -N ""JK_Infotech_PostgreSQL"" -D ""{app}\pg_data"" -U LocalSystem"; StatusMsg: "Registering database engine services..."; Flags: runhidden
Filename: "sc.exe"; Parameters: "config JK_Infotech_PostgreSQL start= auto"; StatusMsg: "Configuring database automatic startup..."; Flags: runhidden
Filename: "sc.exe"; Parameters: "failure JK_Infotech_PostgreSQL reset= 86400 actions= restart/5000/restart/5000/restart/5000"; StatusMsg: "Configuring database auto-recovery rules..."; Flags: runhidden

; 3.3 Auto-tune Redis maxmemory dynamically based on client machine RAM capacity
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\tune-redis.ps1"" -RedisDir ""{app}\redis"""; StatusMsg: "Optimizing cache engine for client hardware..."; Flags: runhidden

; 3.5 Register Redis Cache Engine as a native Windows Service
Filename: "{app}\redis\redis-server.exe"; Parameters: "--service-install --service-name ""JK_Infotech_Redis"""; StatusMsg: "Registering cache engine service..."; Flags: runhidden
Filename: "sc.exe"; Parameters: "config JK_Infotech_Redis start= auto"; StatusMsg: "Configuring cache service automatic startup..."; Flags: runhidden
Filename: "sc.exe"; Parameters: "failure JK_Infotech_Redis reset= 86400 actions= restart/5000/restart/5000/restart/5000"; StatusMsg: "Configuring cache service auto-recovery rules..."; Flags: runhidden

; 4. Start the database & cache services
Filename: "net.exe"; Parameters: "start JK_Infotech_PostgreSQL"; StatusMsg: "Starting database service..."; Flags: runhidden
Filename: "net.exe"; Parameters: "start JK_Infotech_Redis"; StatusMsg: "Starting cache engine service..."; Flags: runhidden

; 5. Create the 'jk_erp' database (fails silently if already exists, which is fine)
Filename: "{app}\pgsql\bin\createdb.exe"; Parameters: "-U postgres -h localhost jk_erp"; StatusMsg: "Creating application schema..."; Flags: runhidden; Check: NotDataDirExists

; 5. Sideload Certificate to Trusted People store (requires admin elevation)
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""$cert = Get-ChildItem -Path '{app}\client' -Filter '*.cer' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1; if ($cert) {{ Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\LocalMachine\TrustedPeople }"""; StatusMsg: "Installing application signing credentials..."; Flags: runhidden

; 6. Apply Network Loopback exemption (requires admin elevation)
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""CheckNetIsolation.exe LoopbackExempt -a -n=9428b0f2-9cad-4953-a4b8-da3e6a84d40a_242epvxd83p06"""; StatusMsg: "Configuring local network sandbox access..."; Flags: runhidden

; 7. Sideload MSIX package as logged-in user (MUST drop elevation for Add-AppxPackage)
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\sideload.ps1"" -ClientPath ""{app}\client"""; StatusMsg: "Installing Windows desktop client interface..."; Flags: runhidden runasoriginaluser

; 8. Launch backend server background process
Filename: "{app}\backend\backend.exe"; StatusMsg: "Starting application backend engine..."; Flags: nowait runhidden

[UninstallRun]
; 1. Stop and Unregister PostgreSQL Service
Filename: "net.exe"; Parameters: "stop JK_Infotech_PostgreSQL"; Flags: runhidden; RunOnceId: "StopPostgres"
Filename: "{app}\pgsql\bin\pg_ctl.exe"; Parameters: "unregister -N ""JK_Infotech_PostgreSQL"""; Flags: runhidden; RunOnceId: "UnregisterPostgres"

; 1.5 Stop and Unregister Redis Service
Filename: "net.exe"; Parameters: "stop JK_Infotech_Redis"; Flags: runhidden; RunOnceId: "StopRedis"
Filename: "{app}\redis\redis-server.exe"; Parameters: "--service-uninstall --service-name ""JK_Infotech_Redis"""; Flags: runhidden; RunOnceId: "UnregisterRedis"

; 2. Uninstall the frontend UWP Application Package
Filename: "powershell.exe"; Parameters: "-Command ""Get-AppxPackage *9428b0f2-9cad-4953-a4b8-da3e6a84d40a* | Remove-AppxPackage"""; Flags: runhidden; RunOnceId: "UninstallUWP"

[Code]
// Helper function to check if database files have already been initialized across any known directory
function NotDataDirExists(): Boolean;
begin
  Result := not DirExists(ExpandConstant('{app}\pg_data'));
end;

// Helper function to check if the PostgreSQL service is already registered in Windows Service Control Manager
function NotPostgresServiceExists(): Boolean;
begin
  Result := not RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\JK_Infotech_PostgreSQL');
end;

// Helper function to check if PostgreSQL service is not already running
function PostgresServiceIsNotRunning(): Boolean;
var
  ResultCode: Integer;
begin
  if Exec(ExpandConstant('{sys}\sc.exe'), 'query JK_Infotech_PostgreSQL', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := True;
  end
  else
    Result := True;
end;
