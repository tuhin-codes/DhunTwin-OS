@echo off
set "BACKEND=%~dp0"

echo ==========================================
echo        CarbonTwin OS Backend
echo ==========================================
echo.
echo Starting...
echo.

"%BACKEND%.venv\Scripts\python.exe" -m uvicorn app.main:app --reload

echo.
echo Backend stopped.
pause