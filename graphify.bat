@echo off
REM Start the graphify watcher and server in the background
start /b "" node mcp/graphify-watcher.js
start /b "" node mcp/graph-server.js
:loop
timeout /t 5 >nul
goto loop
