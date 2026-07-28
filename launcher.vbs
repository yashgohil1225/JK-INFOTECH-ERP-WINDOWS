' =====================================================================
' JK INFOTECH ERP — Silent Fast Launcher Script
' Ensures PostgreSQL, Redis and Backend Engine are active before opening UI
' =====================================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

strPgCtl = strAppDir & "\pgsql\bin\pg_ctl.exe"
strPgData = strAppDir & "\pg_data"
strPgInit = strAppDir & "\pgsql\bin\initdb.exe"
strCreateDb = strAppDir & "\pgsql\bin\createdb.exe"
strPgVersion = strPgData & "\PG_VERSION"
strRedisExe = strAppDir & "\redis\redis-server.exe"
strRedisConf = strAppDir & "\redis\redis.windows.conf"
strBackendExe = strAppDir & "\backend\backend.exe"
strPyExe = strAppDir & "\.venv\Scripts\python.exe"
strRunPy = strAppDir & "\backend\run.py"

' 1. Launch UWP Desktop Client Interface INSTANTLY (0.1s response)
WshShell.Run "cmd.exe /c start shell:AppsFolder\9428b0f2-9cad-4953-a4b8-da3e6a84d40a_242epvxd83p06!App", 0, False

' 2. Auto-initialize PostgreSQL cluster if missing
If Not objFSO.FileExists(strPgVersion) Then
    WshShell.Run """" & strPgInit & """ -D """ & strPgData & """ -U postgres --auth-host=trust --auth-local=trust", 0, True
End If

' 3. Start Database, Cache, and Backend Engine in parallel background
WshShell.Run "cmd.exe /c start /b ""pg"" """ & strPgCtl & """ -D """ & strPgData & """ -o ""-p 5432"" -l """ & strPgData & "\postgres.log"" start", 0, False
WshShell.Run "cmd.exe /c start /b ""redis"" """ & strRedisExe & """ """ & strRedisConf & """ --port 6379", 0, False

If objFSO.FileExists(strBackendExe) Then
    WshShell.Run "cmd.exe /c start /b ""backend"" """ & strBackendExe & """", 0, False
ElseIf objFSO.FileExists(strPyExe) And objFSO.FileExists(strRunPy) Then
    WshShell.Run "cmd.exe /c start /b ""backend_py"" """ & strPyExe & """ """ & strRunPy & """", 0, False
End If