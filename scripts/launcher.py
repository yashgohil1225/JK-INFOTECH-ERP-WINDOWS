import os
import sys
import subprocess
import time

def is_process_running(proc_name: str) -> bool:
    try:
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        output = subprocess.check_output(f'tasklist /FI "IMAGENAME eq {proc_name}"', shell=True, creationflags=flags).decode('utf-8', errors='ignore')
        return proc_name.lower() in output.lower()
    except Exception:
        return False

def main():
    if getattr(sys, 'frozen', False):
        exec_dir = os.path.dirname(os.path.abspath(sys.executable))
        if os.path.basename(exec_dir).lower() in ["scripts", "backend"]:
            app_dir = os.path.dirname(exec_dir)
        else:
            app_dir = exec_dir
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        app_dir = os.path.dirname(script_dir)

    program_data = os.environ.get("PROGRAMDATA") or os.environ.get("APPDATA") or os.path.expanduser("~")
    sqlite_dir = os.path.join(program_data, "JK Infotech ERP", "sqlite_data")
    
    pg_version = os.path.join(app_dir, "pg_data", "PG_VERSION")
    marker_file = os.path.join(sqlite_dir, ".migrated_from_pg")
    
    # 1. One-time visual migration from PostgreSQL to SQLite if legacy database is present
    if os.path.exists(pg_version) and not os.path.exists(marker_file):
        migrate_exe = os.path.join(app_dir, "scripts", "migrate-db.exe")
        migrate_py = os.path.join(app_dir, "scripts", "migrate_pg_to_sqlite.py")
        if os.path.exists(migrate_exe):
            subprocess.run([migrate_exe])
        elif os.path.exists(migrate_py):
            subprocess.run([sys.executable, migrate_py])

    # 2. Start Backend Server Engine asynchronously - ONLY if not already running
    if not is_process_running("backend.exe"):
        backend_exe = os.path.join(app_dir, "backend", "backend.exe")
        if os.path.exists(backend_exe):
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
            subprocess.Popen([backend_exe], cwd=os.path.dirname(backend_exe), creationflags=flags)

    # 3. Instant UI Launch via Windows AppX activation or protocol scheme
    try:
        os.startfile("jkerpwindows:")
    except Exception:
        ps_cmd = (
            "$appName = '9428b0f2-9cad-4953-a4b8-da3e6a84d40a'; "
            "$pkg = Get-AppxPackage -Name '*'$appName'*' -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1; "
            "if ($pkg) { Start-Process ('shell:AppsFolder\' + $pkg.PackageFamilyName + '!App') }"
        )
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        subprocess.Popen(["powershell.exe", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", ps_cmd], creationflags=flags)

if __name__ == "__main__":
    main()
