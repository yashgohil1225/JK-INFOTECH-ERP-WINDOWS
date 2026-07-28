' =====================================================================
' JK INFOTECH ERP — Silent Fast Launcher Script
' Ensures PostgreSQL, Redis and Backend Engine are active before opening UI
' =====================================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

strPgCtl = strAppDir & "\pgsql\bin\pg_ctl.exe"
strPgData = strAppDir & "\pg_data"
strRedisExe = strAppDir & "\redis\redis-server.exe"
strRedisConf = strAppDir & "\redis\redis.windows.conf"
strBackendExe = strAppDir & "\backend\backend.exe"
strPyExe = strAppDir & "\.venv\Scripts\python.exe"
strRunPy = strAppDir & "\backend\run.py"

' 1. Start Services & Backend Engine in background
WshShell.Run "powershell -WindowStyle Hidden -Command ""if ((Get-Service JK_Infotech_PostgreSQL -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Service JK_Infotech_PostgreSQL -ErrorAction SilentlyContinue }; if (-not (Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet)) { & '" & strPgCtl & "' -D '" & strPgData & "' -o '-p 5432' -l '" & strPgData & "\postgres.log' start }""", 0, False

WshShell.Run "powershell -WindowStyle Hidden -Command ""if ((Get-Service JK_Infotech_Redis -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Service JK_Infotech_Redis -ErrorAction SilentlyContinue }; if (-not (Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet)) { Start-Process -FilePath '" & strRedisExe & "' -ArgumentList '""'""'" & strRedisConf & "'""'"" --port 6379' -WindowStyle Hidden }""", 0, False

If objFSO.FileExists(strBackendExe) Then
    WshShell.Run "powershell -WindowStyle Hidden -Command ""if (-not (Get-Process backend -ErrorAction SilentlyContinue)) { Start-Process -FilePath '" & strBackendExe & "' -WindowStyle Hidden }""", 0, False
ElseIf objFSO.FileExists(strPyExe) And objFSO.FileExists(strRunPy) Then
    WshShell.Run "powershell -WindowStyle Hidden -Command ""if (-not (Get-Process python -ErrorAction SilentlyContinue)) { Start-Process -FilePath '" & strPyExe & "' -ArgumentList '" & strRunPy & "' -WorkingDirectory '" & strAppDir & "\backend' -WindowStyle Hidden }""", 0, False
End If

' 2. Ultra-Fast HTTP readiness probe for Backend Port 8000 (MSXML2 ServerXMLHTTP)
Set xmlhttp = CreateObject("MSXML2.ServerXMLHTTP.6.0")
xmlhttp.setTimeouts 300, 300, 300, 300

For i = 1 To 25
    On Error Resume Next
    xmlhttp.open "GET", "http://localhost:8000/health", False
    xmlhttp.send
    If Err.Number = 0 Then
        If xmlhttp.status = 200 Then
            Exit For
        End If
    End If
    On Error GoTo 0
    WScript.Sleep 250
Next

' 3. Launch UWP Desktop Client Interface
WshShell.Run "cmd.exe /c start shell:AppsFolder\9428b0f2-9cad-4953-a4b8-da3e6a84d40a_242epvxd83p06!App", 0, False