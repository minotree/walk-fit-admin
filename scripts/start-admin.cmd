@echo off
setlocal
cd /d "%~dp0.."
if not exist package.json (
  echo Copy this scripts folder into the generated admin project first.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Dependencies are missing. Run npm.cmd ci or npm.cmd install first.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:5173 after Vite starts.
call npm.cmd run dev
endlocal
