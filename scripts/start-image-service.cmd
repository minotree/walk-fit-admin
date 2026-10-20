@echo off
setlocal
cd /d "%~dp0.."
if not exist .venv-images\Scripts\python.exe (
  echo Run: python -m venv .venv-images
  echo Then: .venv-images\Scripts\python.exe -m pip install -r image-service\requirements.txt
  exit /b 1
)
.venv-images\Scripts\python.exe -m uvicorn app:app --app-dir image-service --host 127.0.0.1 --port 8765
