' =====================================================================
' JK INFOTECH ERP — Silent Launcher Script
' Ensures PostgreSQL and Backend Engine are active before opening UI
' =====================================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' 1. Check & start PostgreSQL service or fallback to embedded pg_ctl.exe
strPgCtl = strAppDir & "\pgsql\bin\pg_ctl.exe"
strPgData = strAppDir & "\pg_data"

WshShell.Run "powershell -WindowStyle Hidden -Command ""if ((Get-Service JK_Infotech_PostgreSQL -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Service JK_Infotech_PostgreSQL -ErrorAction SilentlyContinue }; if (-not (Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet)) { & '" & strPgCtl & "' -D '" & strPgData & "' -o '-p 5432' -l '" & strPgData & "\postgres.log' start }""", 0, True

' 1.5 Check & start Redis cache engine or service
strRedisExe = strAppDir & "\redis\redis-server.exe"
strRedisConf = strAppDir & "\redis\redis.windows.conf"
WshShell.Run "powershell -WindowStyle Hidden -Command ""if ((Get-Service JK_Infotech_Redis -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Service JK_Infotech_Redis -ErrorAction SilentlyContinue }; if (-not (Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet)) { Start-Process -FilePath '" & strRedisExe & "' -ArgumentList '""'""'" & strRedisConf & "'""'"" --port 6379' -WindowStyle Hidden }""", 0, True

' 2. Check & start backend engine if not running
strBackendExe = strAppDir & "\backend\backend.exe"
strPyExe = strAppDir & "\.venv\Scripts\python.exe"
strRunPy = strAppDir & "\backend\run.py"

If objFSO.FileExists(strBackendExe) Then
    WshShell.Run "powershell -WindowStyle Hidden -Command ""if (-not (Get-Process backend -ErrorAction SilentlyContinue)) { Start-Process -FilePath '" & strBackendExe & "' -WindowStyle Hidden }""", 0, False
ElseIf objFSO.FileExists(strPyExe) And objFSO.FileExists(strRunPy) Then
    WshShell.Run "powershell -WindowStyle Hidden -Command ""if (-not (Get-Process python -ErrorAction SilentlyContinue)) { Start-Process -FilePath '" & strPyExe & "' -ArgumentList '" & strRunPy & "' -WorkingDirectory '" & strAppDir & "\backend' -WindowStyle Hidden }""", 0, False
End If

' 3. Wait for backend port 8000 to become active (up to 10 seconds)
WshShell.Run "powershell -WindowStyle Hidden -Command ""$count = 0; while (-not (Test-NetConnection -ComputerName localhost -Port 8000 -InformationLevel Quiet) -and $count -lt 20) { Start-Sleep -Milliseconds 500; $count++ }""", 0, True

' 4. Launch UWP Desktop Client Interface
WshShell.Run "cmd.exe /c start shell:AppsFolder\9428b0f2-9cad-4953-a4b8-da3e6a84d40a_242epvxd83p06!App", 0, False