@echo off
rem One-click: run smoke test, commit and push to GitHub
cd /d "%~dp0"

echo ============================================
echo [1/3] Running smoke test...
echo ============================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found, skipping tests.
) else (
  node test_smoke.js
  if errorlevel 1 (
    echo.
    echo Tests failed. Push aborted.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo [2/3] Committing changes...
echo ============================================
git add .
git commit -m "v3.7: Code Red mode + BGM synth + Wave hit test fix"

echo.
echo ============================================
echo [3/3] Pushing to origin main...
echo ============================================
git push origin main

echo.
echo Done. If push failed, check proxy and GitHub token.
pause
