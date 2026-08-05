# pyrefly: ignore [missing-import]
import sys
import io
import os

# Ensure working directory is set to the executable's directory when frozen
# so that .env files and local logs are loaded and written to the correct folder.
if getattr(sys, 'frozen', False):
    os.chdir(os.path.dirname(sys.executable))

# Prevent PyInstaller --noconsole crash due to None stdout/stderr in windowed mode
if sys.stdout is None:
    sys.stdout = io.StringIO()
if sys.stderr is None:
    sys.stderr = io.StringIO()

import uvicorn
import platform
import multiprocessing

# Set ProactorEventLoop policy at module level (not just inside __main__) so
# that uvicorn's reloader child processes also inherit it when they re-import
# this module. SelectorEventLoop (Windows default) cannot spawn subprocesses,
# which breaks Playwright's Chromium launch for PDF generation.
if platform.system() == "Windows":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

if __name__ == "__main__":
    multiprocessing.freeze_support()

    is_frozen = getattr(sys, 'frozen', False)
    if is_frozen:
        from app.main import app
        import traceback
        import tempfile
        import os

        try:
            uvicorn.run(
                app,
                host="127.0.0.1",
                port=8000,
                reload=False,
                loop="asyncio",  # honour the ProactorEventLoop policy set above
            )
        except Exception as e:
            # Write traceback to ProgramData directory
            program_data = os.environ.get("PROGRAMDATA") or os.environ.get("APPDATA") or tempfile.gettempdir()
            log_dir = os.path.join(program_data, "JK Infotech ERP", "sqlite_data")
            os.makedirs(log_dir, exist_ok=True)
            log_path = os.path.join(log_dir, "backend_crash.log")
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(f"CRASH REPORT:\n{str(e)}\n\n")
                f.write(traceback.format_exc())
            sys.exit(1)
        finally:
            try:
                program_data = os.environ.get("PROGRAMDATA") or os.environ.get("APPDATA") or tempfile.gettempdir()
                log_dir = os.path.join(program_data, "JK Infotech ERP", "sqlite_data")
                os.makedirs(log_dir, exist_ok=True)
                if hasattr(sys.stdout, "getvalue"):
                    stdout_content = sys.stdout.getvalue()
                    if stdout_content:
                        log_path = os.path.join(log_dir, "backend_output.log")
                        with open(log_path, "w", encoding="utf-8") as f:
                            f.write(stdout_content)
                if hasattr(sys.stderr, "getvalue"):
                    stderr_content = sys.stderr.getvalue()
                    if stderr_content:
                        log_path = os.path.join(log_dir, "backend_stderr.log")
                        with open(log_path, "w", encoding="utf-8") as f:
                            f.write(stderr_content)
            except:
                pass
    else:
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            loop="asyncio",  # honour the ProactorEventLoop policy set above
        )