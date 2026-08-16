@echo off
rem Run smoke test (Node.js required)
cd /d "%~dp0"
node test_smoke.js
pause
