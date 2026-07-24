@echo off
setlocal
cd /d "%~dp0.."

set "IMAGE=docker.io/matt7046/password-manager:1.0.0"

echo Building %IMAGE% ...
docker build -t %IMAGE% .
if errorlevel 1 exit /b %errorlevel%

echo.
echo Build OK. Per pubblicare: PUSH.BAT
exit /b 0
