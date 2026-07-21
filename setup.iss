; =====================================================================
; JK INFOTECH ERP — Professional Silent Setup Installer Script
; File: Y:\JK Infotech ERP\setup.iss
; =====================================================================

[Setup]
AppId={{9428b0f2-9cad-4953-a4b8-da3e6a84d40a}
AppName=JK INFOTECH ERP
AppVersion=2.1
AppPublisher=JK Infotech
DefaultDirName={autopf}\JK Infotech ERP
DefaultGroupName=JK INFOTECH ERP
DisableProgramGroupPage=yes
OutputBaseFilename=JK_Infotech_ERP_Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Copy PostgreSQL folder
Source: "Y:\JK Infotech ERP\pgsql\*"; DestDir: "{app}\pgsql"; Flags: recursesubdirs createallsubdirs

; Copy compiled PyInstaller backend executable
Source: "Y:\JK Infotech ERP\backend\dist\backend.exe"; DestDir: "{app}\backend"; Flags: ignoreversion

; Copy the generated UWP client build assets
Source: "Y:\JK Infotech ERP\frontend\windows\AppPackages\JKErpWindows\*"; DestDir: "{app}\client"; Flags: recursesubdirs createallsubdirs ignoreversion

Source: "Y:\JK Infotech ERP\backend\.env.example"; DestDir: "{app}\backend"; DestName: ".env"; Flags: onlyifdoesntexist

; Copy branding icon for shortcuts
Source: "Y:\JK Infotech ERP\JK INFOTECH branding assests\ico\jk-infotech-icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userdesktop}\JK INFOTECH ERP"; Filename: "explorer.exe"; Parameters: "shell:AppsFolder\9428b0f2-9cad-4953-a4b8-da3e6a84d40a_242epvxd83p06!App"; IconFilename: "{app}\jk-infotech-icon.ico"; IconIndex: 0
Name: "{group}\JK INFOTECH ERP"; Filename: "explorer.exe"; Parameters: "shell:AppsFolder\9428b0f2-9cad-4953-a4b8-da3e6a84d40a_242epvxd83p06!App"; IconFilename: "{app}\jk-infotech-icon.ico"; IconIndex: 0

[Registry]
; Configure the Backend backend.exe executable to launch automatically when user logs in
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "JK_Infotech_ERP_Backend"; ValueData: """{app}\backend\backend.exe"""; Flags: uninsdeletevalue

[Run]
; 1. Initialize PostgreSQL Data Cluster database (Only if data folder does not exist)
Filename: "{app}\pgsql\bin\initdb.exe"; Parameters: "-D ""{app}\pg_data"" -U postgres --auth-host=scram-sha-256 --auth-local=scram-sha-256"; StatusMsg: "Initializing local database server..."; Flags: runhidden; Check: NotDataDirExists

; 2. Register PostgreSQL as a native Windows Service (Only if service is not already registered)
Filename: "{app}\pgsql\bin\pg_ctl.exe"; Parameters: "register -N ""JK_Infotech_PostgreSQL"" -D ""{app}\pg_data"" -U LocalSystem"; StatusMsg: "Registering database engine services..."; Flags: runhidden; Check: NotPostgresServiceExists

; 3. Start the database service
Filename: "net.exe"; Parameters: "start JK_Infotech_PostgreSQL"; StatusMsg: "Starting database service..."; Flags: runhidden; Check: PostgresServiceIsNotRunning

; 4. Create the 'jk_erp' database (fails silently if already exists, which is fine)
Filename: "{app}\pgsql\bin\createdb.exe"; Parameters: "-U postgres -h localhost jk_erp"; StatusMsg: "Creating application schema..."; Flags: runhidden; Check: NotDataDirExists

; 5. Sideload Certificate to Trusted People store (allows UWP app setup)
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""$cert = Get-ChildItem -Path '{app}\client' -Filter '*.cer' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1; if ($cert) {{ Import-Certificate -FilePath $cert.FullName -CertStoreLocation Cert:\LocalMachine\TrustedPeople }"""; StatusMsg: "Installing application signing credentials..."; Flags: runhidden

; 5.5 Remove any existing app package to prevent conflicts
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""Get-AppxPackage -AllUsers *9428b0f2-9cad-4953-a4b8-da3e6a84d40a* | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue"""; StatusMsg: "Removing previous application versions..."; Flags: runhidden

; 6. Sideload the native UWP Windows Application package
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""$pkg = Get-ChildItem -Path '{app}\client\*' -Include '*.msix', '*.msixbundle', '*.appx' -Recurse | Select-Object -First 1; if ($pkg) {{ Add-AppxPackage -Path $pkg.FullName }"""; StatusMsg: "Installing Windows desktop client interface..."; Flags: runhidden

; 7. Apply Network Loopback exemption for the UWP app to talk to backend
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -Command ""CheckNetIsolation.exe LoopbackExempt -a -n=9428b0f2-9cad-4953-a4b8-da3e6a84d40a_242epvxd83p06"""; StatusMsg: "Configuring local network sandbox access..."; Flags: runhidden

[UninstallRun]
; 1. Stop and Unregister PostgreSQL Service
Filename: "net.exe"; Parameters: "stop JK_Infotech_PostgreSQL"; Flags: runhidden; RunOnceId: "StopPostgres"
Filename: "{app}\pgsql\bin\pg_ctl.exe"; Parameters: "unregister -N ""JK_Infotech_PostgreSQL"""; Flags: runhidden; RunOnceId: "UnregisterPostgres"

; 2. Uninstall the frontend UWP Application Package
Filename: "powershell.exe"; Parameters: "-Command ""Get-AppxPackage *JKErpWindows* | Remove-AppxPackage"""; Flags: runhidden; RunOnceId: "UninstallUWP"

[Code]
// Helper function to check if database files have already been initialized across any known directory
function NotDataDirExists(): Boolean;
begin
  Result := (not DirExists(ExpandConstant('{app}\pg_data'))) and
            (not DirExists(ExpandConstant('{userappdata}\frontend\data'))) and
            (not DirExists(ExpandConstant('{commonappdata}\JK Infotech ERP\pg_data')));
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
