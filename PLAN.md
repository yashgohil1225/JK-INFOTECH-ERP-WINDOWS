# JK INFOTECH ERP — Project Plan & Pending Tasks

This document tracks planned features, pending architectural enhancements, and future roadmaps for **JK INFOTECH ERP**.

---

## 1. Dedicated `uninstall\` Subfolder Configuration
- **Goal**: Move `unins000.exe` and `unins000.dat` into `{app}\uninstall\` subfolder (`UninstallFilesDir={app}\uninstall` in `setup.iss`).
- **Benefit**: Root installation folder remains 100% clean and free of uninstaller data clutter.

---

## 2. Custom Branded Installer Graphics & Artwork
- **Goal**: Add custom Wizard Banners (`WizardImageFile`, `WizardSmallImageFile`) featuring the official **JK INFOTECH** logo, dark theme aesthetics, and custom blue branding artwork.
- **Benefit**: Replaces standard default Inno Setup wizard visuals with a high-end corporate installation wizard interface.

---

## 3. Clean App Folder Lockdown (Junk File Filtering)
- **Goal**: Add strict file exclusions to `setup.iss` to prevent developer logs (`*.log`), temporary caches, `.spec` files, and test files from being copied to client PCs.
- **Benefit**: Keeps client PCs 100% lean, containing only pure production binary files.

---

## 4. Single Compiled Launcher Executable (`JK_Infotech_ERP.exe`)

### Goal
Compile startup and activation logic into a single native executable (`JK_Infotech_ERP.exe`) to remove all exposed `.vbs` and `.ps1` script files from `{app}` on client PCs.

### Key Benefits
- **Clean Enterprise Directory**: `{app}` contains only `JK_Infotech_ERP.exe`, `backend\`, `client\`, and standard uninstaller (identical to Tally / Vyapar).
- **Silent & Sub-50ms Launch**: Executes backend server check and AppX window activation in memory without relying on external VBScript or PowerShell execution policies.

### Execution Steps
1. **Build Launcher Source (`scripts/launcher.py` / C++)**:
   - Programmatically checks if `backend.exe` process is active.
   - Activates WinUI 3 UWP client via native Windows AppX APIs (`Get-AppxPackage *9428b0f2...*`).
   - Compiles binary to `JK_Infotech_ERP.exe` using PyInstaller / C++ compiler.
2. **Update Setup Installer (`setup.iss`)**:
   - Point Desktop and Start Menu shortcuts to `{app}\JK_Infotech_ERP.exe`.
   - Exclude `launcher.vbs`, `launch-app.ps1`, and `sideload.ps1` from client installation package rules.
3. **Update Release Pipeline (`build-release-package.ps1`)**:
   - Integrate `JK_Infotech_ERP.exe` compilation into the automated master build pipeline.

---

## 5. Auto-Clean Residual Files on Uninstall
- **Goal**: Configure `[UninstallDelete]` rules in `setup.iss` to automatically sweep away temporary log files (`*.log`), PDF preview caches, and empty directories upon uninstallation.
- **Benefit**: Ensures 100% clean software removal without leaving leftover junk folders in `C:\Program Files\JK Infotech ERP\`, while keeping client database (`jkerp.db` in `%PROGRAMDATA%`) safe.

---

## 6. Embedded Executable Icon & Root Icon Purge
- **Goal**: Embed `jk-infotech-icon.ico` directly inside `JK_Infotech_ERP.exe` binary during compilation (`--icon=jk-infotech-icon.ico`).
- **Benefit**: Windows shortcuts load the high-resolution logo directly from the executable, allowing us to remove `jk-infotech-icon.ico` as a standalone file from the root `{app}` directory.

---

## 7. Temporary Setup Extraction of UWP MSIX Package (`{tmp}\client\package`)
- **Goal**: Configure `setup.iss` to extract the UWP MSIX package into `{tmp}\client\package` during installation rather than `{app}\client\package`.
- **Benefit**: Once `sideload.ps1` registers the AppX package into Windows, Inno Setup automatically purges `{tmp}`, completely eliminating the `{app}\client\` directory from `C:\Program Files\JK Infotech ERP\`.

---

## 8. Windows Control Panel Official Brand Logo Icon (`UninstallDisplayIcon`)
- **Goal**: Configure `UninstallDisplayIcon` directive in `setup.iss` (`UninstallDisplayIcon={app}\jk-infotech-icon.ico` or `{app}\JK_Infotech_ERP.exe`).
- **Benefit**: Fixes generic Windows installer icon in Control Panel / Settings -> Installed Apps, displaying your official high-resolution **JK INFOTECH logo icon** instead.

---

## 9. Upcoming Tasks & Doubts Backlog

*(Add future pending tasks, doubts, and solutions here)*





