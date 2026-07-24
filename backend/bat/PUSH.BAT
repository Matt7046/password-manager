@echo off
setlocal
cd /d "%~dp0.."

set "IMAGE=docker.io/matt7046/password-manager:1.0.0"

echo Pushing %IMAGE% ...
docker push %IMAGE%
if errorlevel 1 (
  echo.
  echo Push fallito. Sei loggato?  docker login
  exit /b %errorlevel%
)

echo.
echo Push OK. Sul server:
echo   cd .../Password-Manager/backend
echo   docker compose pull
echo   docker compose up -d
echo.
echo URL: https://password.colorsdev.tech
exit /b 0
