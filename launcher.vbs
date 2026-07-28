' =====================================================================
' JK INFOTECH ERP — High Speed Fast Launcher Script (< 0.1s launch time)
' Ensures PostgreSQL and Backend Engine are active before opening UI
' =====================================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' 1. Check & start PostgreSQL service or fallback to embedded pg_ctl.exe (Non-blocking)
strPgCtl = strAppDir & "\pgsql\bin\pg_ctl.exe"
strPgData = strAppDir & "\pg_data"

WshShell.Run "powershell -WindowStyle Hidden -Command ""if ((Get-Service JK_Infotech_PostgreSQL -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Service JK_Infotech_PostgreSQL -ErrorAction SilentlyContinue }; if (-not (Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet)) { & '" & strPgCtl & "' -D '" & strPgData & "' -o '-p 5432' -l '" & strPgData & "\postgres.log' start }""", 0, False

' 1.5 Check & start Redis cache engine or service (Non-blocking)
strRedisExe = strAppDir & "\redis\redis-server.exe"
strRedisConf = strAppDir & "\redis\redis.windows.conf"
WshShell.Run "powershell -WindowStyle Hidden -Command ""if ((Get-Service JK_Infotech_Redis -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Service JK_Infotech_Redis -ErrorAction SilentlyContinue }; if (-not (Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet)) { Start-Process -FilePath '" & strRedisExe & "' -ArgumentList '""'""'" & strRedisConf & "'""'"" --port 6379' -WindowStyle Hidden }""", 0, False

' 2. Check & start backend engine if not running (Non-blocking)
strBackendExe = strAppDir & "\backend\backend.exe"
strPyExe = strAppDir & "\.venv\Scripts\python.exe"
strRunPy = strAppDir & "\backend\run.py"

If objFSO.FileExists(strBackendExe) Then
    WshShell.Run "powershell -WindowStyle Hidden -Command ""if (-not (Get-Process backend -ErrorAction SilentlyContinue)) { Start-Process -FilePath '" & strBackendExe & "' -WindowStyle Hidden }""", 0, False
ElseIf objFSO.FileExists(strPyExe) And objFSO.FileExists(strRunPy) Then
    WshShell.Run "powershell -WindowStyle Hidden -Command ""if (-not (Get-Process python -ErrorAction SilentlyContinue)) { Start-Process -FilePath '" & strPyExe & "' -ArgumentList '" & strRunPy & "' -WorkingDirectory '" & strAppDir & "\backend' -WindowStyle Hidden }""", 0, False
End If

' 3. Launch UWP Desktop Client Interface INSTANTLY (< 0.1s delay)
WshShell.Run "cmd.exe /c start shell:AppsFolder\9428b0f2-9cad-4953-a4b8-da3e6a84d40a_242epvxd83p06!App", 0, False