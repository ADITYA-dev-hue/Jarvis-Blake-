@echo off
title JARVIS Laptop Agent (Windows)
echo ===================================================
echo   Starting JARVIS Phase 1 Windows Laptop Agent
echo ===================================================

cd /d "%~dp0laptop-agent"

set PYTHON_CMD=

:: 1. Check if virtual environment exists
if exist "%~dp0venv\Scripts\python.exe" (
    set PYTHON_CMD="%~dp0venv\Scripts\python.exe"
    goto RUN
)

:: 2. Check if python is in PATH
where python.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python
    goto RUN
)

:: 3. Check AppData WindowsApps python alias
if exist "%USERPROFILE%\AppData\Local\Microsoft\WindowsApps\python.exe" (
    set PYTHON_CMD="%USERPROFILE%\AppData\Local\Microsoft\WindowsApps\python.exe"
    goto RUN
)

:: 4. Check AppData local pythoncore
if exist "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" (
    set PYTHON_CMD="%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
    goto RUN
)

:: 5. Check Programs\Python
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python*") do (
    if exist "%%D\python.exe" (
        set PYTHON_CMD="%%D\python.exe"
        goto RUN
    )
)

echo [ERROR] Python was not found in PATH or standard directories.
echo Please install Python 3.9+ or add it to your PATH.
pause
exit /b 1

:RUN
echo [INFO] Using Python: %PYTHON_CMD%
%PYTHON_CMD% agent.py
pause
