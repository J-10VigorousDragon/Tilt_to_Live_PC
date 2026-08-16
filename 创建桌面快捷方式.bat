@echo off
rem One-click: create desktop shortcut with custom icon (icon.ico + Tilt to Live.lnk)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"
pause
