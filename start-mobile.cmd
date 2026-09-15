@echo off
cd /d "%~dp0"
if not exist node_modules call npm ci
if errorlevel 1 goto failed
call npm start -- --port 8082
if errorlevel 1 goto failed
exit /b 0
:failed
echo Could not start Expo. Please check the error above.
pause
