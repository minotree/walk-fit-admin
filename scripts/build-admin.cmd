@echo off
setlocal
cd /d "%~dp0.."
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
call npm.cmd run tauri:build
exit /b %errorlevel%
