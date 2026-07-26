@echo off
rem =============================================================================
rem DEPLOY WEB Password Manager (static Expo export)
rem   1) yarn + expo export --platform web (+ patch PWA HTML)
rem   2) upload dist/ -> /root/password-manager/web sul VPS
rem   3) reload nginx AM
rem
rem Uso: DEPLOY-WEB.BAT
rem Skip: set DEPLOY_SKIP_EXPORT=1 / DEPLOY_SKIP_UPLOAD=1 / DEPLOY_SKIP_RELOAD=1
rem =============================================================================
setlocal EnableDelayedExpansion
call "%~dp0_load-config.bat"
if errorlevel 1 exit /b 1

echo.
echo ############################################
echo # DEPLOY WEB  -^> %DEPLOY_WEB_PATH%
echo ############################################

set "DIST_DIR=%FRONTEND_DIR%\dist"
set "TAR_FILE=%TEMP%\pm-web-dist.tar"
set "SSH_TARGET=%DEPLOY_USER%@%DEPLOY_HOST%"
rem Quotare sempre: altrimenti Windows tratta "20:" nell'IP come drive letter
set "REMOTE_TAR=%SSH_TARGET%:/tmp/pm-web-dist.tar"

if /i "%DEPLOY_SKIP_EXPORT%"=="1" goto :skip_export
echo.
echo === EXPORT WEB ===
cd /d "%FRONTEND_DIR%"
if errorlevel 1 exit /b 1
call yarn.cmd install --ignore-scripts
if errorlevel 1 exit /b 1
call npx.cmd expo export --platform web
if errorlevel 1 exit /b 1
call node .\scripts\patch-web-html.mjs
if errorlevel 1 exit /b 1
if exist "public\favicon.ico" copy /Y "public\favicon.ico" "dist\favicon.ico" >nul
if exist "public\favicon.png" copy /Y "public\favicon.png" "dist\favicon.png" >nul
if exist "public\apple-touch-icon.png" copy /Y "public\apple-touch-icon.png" "dist\apple-touch-icon.png" >nul
if exist "public\manifest.webmanifest" copy /Y "public\manifest.webmanifest" "dist\manifest.webmanifest" >nul
if exist "public\sw.js" copy /Y "public\sw.js" "dist\sw.js" >nul
if exist "public\pwa" (
  if not exist "dist\pwa" mkdir "dist\pwa"
  xcopy /E /Y /Q "public\pwa\*" "dist\pwa\" >nul
)
echo [OK] Export in %DIST_DIR%
goto :after_export
:skip_export
echo [SKIP] export
:after_export

if not exist "%DIST_DIR%\index.html" (
  echo [ERRORE] Manca %DIST_DIR%\index.html — esegui export prima.
  exit /b 1
)

if /i "%DEPLOY_SKIP_UPLOAD%"=="1" goto :skip_upload
echo.
echo === UPLOAD -^> %SSH_TARGET%:%DEPLOY_WEB_PATH% ===
echo Dest scp: %REMOTE_TAR%
where tar >nul 2>&1
if errorlevel 1 (
  echo [ERRORE] serve tar.exe ^(Windows 10+^) oppure installa Git Bash.
  exit /b 1
)
if exist "%TAR_FILE%" del /F /Q "%TAR_FILE%" >nul 2>&1
pushd "%DIST_DIR%"
tar -cf "%TAR_FILE%" .
if errorlevel 1 (
  popd
  echo Creazione tar fallita.
  exit /b 1
)
popd
if not exist "%TAR_FILE%" (
  echo [ERRORE] tar non creato: %TAR_FILE%
  exit /b 1
)

if defined DEPLOY_SSH_KEY (
  scp -i "%DEPLOY_SSH_KEY%" -o StrictHostKeyChecking=accept-new "%TAR_FILE%" "%REMOTE_TAR%"
) else (
  scp -o StrictHostKeyChecking=accept-new "%TAR_FILE%" "%REMOTE_TAR%"
)
if errorlevel 1 (
  echo Upload scp fallito.
  echo Controlla: tar=%TAR_FILE%
  echo            dest=%REMOTE_TAR%
  exit /b 1
)

set "DEPLOY_REMOTE_CMD=mkdir -p %DEPLOY_WEB_PATH% ; tar -xf /tmp/pm-web-dist.tar -C %DEPLOY_WEB_PATH% ; rm -f /tmp/pm-web-dist.tar"
call "%~dp0_ssh.bat"
if errorlevel 1 (
  echo Estrazione sul server fallita.
  exit /b 1
)
del /F /Q "%TAR_FILE%" >nul 2>&1
echo [OK] Upload web
goto :after_upload
:skip_upload
echo [SKIP] upload
:after_upload

if /i "%DEPLOY_SKIP_RELOAD%"=="1" goto :skip_reload
echo.
echo === NGINX RELOAD ^(%DEPLOY_NGINX_CONTAINER%^) ===
set "DEPLOY_REMOTE_CMD=docker exec %DEPLOY_NGINX_CONTAINER% nginx -s reload"
call "%~dp0_ssh.bat"
if errorlevel 1 (
  echo [WARN] Reload nginx fallito — i file web sono comunque aggiornati.
) else (
  echo [OK] nginx reload
)
goto :after_reload
:skip_reload
echo [SKIP] reload
:after_reload

echo.
echo [DONE] Deploy WEB completato.
echo URL: https://password.colorsdev.tech
exit /b 0
