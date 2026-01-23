@echo off
echo ========================================
echo EDGE Interactive Playground
echo ========================================
echo.
echo Starting local server...
echo.
echo The playground will open in your default browser.
echo Press Ctrl+C to stop the server.
echo.

cd /d "%~dp0"
start http://localhost:8000
python -m http.server 8000
