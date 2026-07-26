@echo off
rem =============================================================================
rem DEPLOY API Password Manager (come Activity Manager deploy)
rem   1) docker build immagine Hub
rem   2) docker push
rem   3) sul VPS: compose pull + up --force-recreate (solo password-manager)
rem
rem Uso: DEPLOY-API.BAT
rem Skip: set DEPLOY_SKIP_BUILD=1 / DEPLOY_SKIP_PUSH=1 / DEPLOY_SKIP_SERVER=1
rem =============================================================================
setlocal EnableDelayedExpansion
call "%~dp0_load-config.bat"
if errorlevel 1 exit /b 1

echo.
echo ############################################
echo # DEPLOY API  %DEPLOY_HUB_IMAGE%
echo ############################################

if /i "%DEPLOY_SKIP_BUILD%"=="1" goto :skip_build
echo.
echo === BUILD ===
cd /d "%BACKEND_DIR%"
if errorlevel 1 exit /b 1
set DOCKER_BUILDKIT=1
echo docker build -t %DEPLOY_HUB_IMAGE% .
docker build -t %DEPLOY_HUB_IMAGE% .
if errorlevel 1 (
  echo Build fallita.
  exit /b 1
)
echo [OK] Build
goto :after_build
:skip_build
echo [SKIP] build
:after_build

if /i "%DEPLOY_SKIP_PUSH%"=="1" goto :skip_push
echo.
echo === PUSH %DEPLOY_HUB_IMAGE% ===
docker push %DEPLOY_HUB_IMAGE%
if errorlevel 1 (
  echo Push fallito. Sei loggato? docker login
  exit /b 1
)
echo [OK] Push
goto :after_push
:skip_push
echo [SKIP] push
:after_push

if /i "%DEPLOY_SKIP_SERVER%"=="1" goto :skip_server
rem Usa env DEPLOY_REMOTE_CMD (niente arg con "=" che CALL spezza)
set "DEPLOY_REMOTE_CMD=cd %DEPLOY_API_PATH% ; COMPOSE_NETWORK=%DEPLOY_COMPOSE_NETWORK% docker compose -f %DEPLOY_COMPOSE_FILE% pull password-manager ; COMPOSE_NETWORK=%DEPLOY_COMPOSE_NETWORK% docker compose -f %DEPLOY_COMPOSE_FILE% up -d --force-recreate password-manager"
call "%~dp0_ssh.bat"
if errorlevel 1 (
  echo.
  echo [ERRORE] SSH/pull/up fallito.
  echo Verifica DEPLOY_API_PATH / rete %DEPLOY_COMPOSE_NETWORK% in config.bat
  exit /b 1
)
echo [OK] Server API aggiornato
goto :after_server
:skip_server
echo [SKIP] server
:after_server

echo.
echo [DONE] Deploy API completato.
echo URL: https://password.colorsdev.tech
exit /b 0
