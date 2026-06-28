@echo off
echo Installing dependencies (if needed)...
call npm install
echo Starting Dmyati local server on port 3000...
start http://localhost:3000

:loop
node server.js
if %errorlevel% equ 42 (
    echo.
    echo ==============================================
    echo UPDATE DETECTED! Restarting server...
    echo ==============================================
    call npm install
    goto loop
)
