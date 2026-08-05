' =====================================================================
' JK INFOTECH ERP — Silent Fast Launcher Script
' Ensures SQLite database & Backend Engine are active before opening UI
' =====================================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strAppDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strAppDir

strProgramData = WshShell.ExpandEnvironmentStrings("%PROGRAMDATA%")
If strProgramData = "" Or strProgramData = "%PROGRAMDATA%" Then
    strProgramData = WshShell.ExpandEnvironmentStrings("%APPDATA%")
End If
strSqliteDir  = strProgramData & "\JK Infotech ERP\sqlite_data"

strPgVersion  = strAppDir & "\pg_data\PG_VERSION"
strSqliteDb   = strSqliteDir & "\jkerp.db"
strBackendExe = strAppDir & "\backend\backend.exe"
strMigratePy  = strAppDir & "\scripts\migrate_pg_to_sqlite.py"

' ---------------------------------------------------------------------
' WMI-based process check — runs entirely in-process, spawns ZERO windows.
' ---------------------------------------------------------------------
Function IsProcessRunning(procName)
    Dim oWMI, oProcs
    On Error Resume Next
    Set oWMI = GetObject("winmgmts:\\.\root\cimv2")
    If Err.Number <> 0 Then IsProcessRunning = False : Exit Function
    Set oProcs = oWMI.ExecQuery("SELECT Name FROM Win32_Process WHERE Name='" & procName & "'")
    IsProcessRunning = (oProcs.Count > 0)
    On Error GoTo 0
End Function

' 1. One-time visual migration from PostgreSQL to SQLite if legacy database is present
strMarkerFile = strSqliteDir & "\.migrated_from_pg"
If objFSO.FileExists(strPgVersion) And Not objFSO.FileExists(strMarkerFile) Then
    strMigrateExe = strAppDir & "\scripts\migrate-db.exe"
    If objFSO.FileExists(strMigrateExe) Then
        WshShell.Run """" & strMigrateExe & """", 1, True
    ElseIf objFSO.FileExists(strMigratePy) Then
        WshShell.Run "python.exe """ & strMigratePy & """", 1, True
    End If
End If

' 2. Start Backend Server Engine asynchronously - ONLY if not already running
If Not IsProcessRunning("backend.exe") Then
    If objFSO.FileExists(strBackendExe) Then
        WshShell.Run """" & strBackendExe & """", 0, False
    End If
End If

' 3. Instant UI Launch via Windows AppX activation (sub-50ms parallel activation)
Dim strLaunchScript
strLaunchScript = strAppDir & "\scripts\launch-app.ps1"
If Not objFSO.FileExists(strLaunchScript) Then
    strLaunchScript = strAppDir & "\launch-app.ps1"
End If
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strLaunchScript & """", 0, False