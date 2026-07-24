@echo off
setlocal
cd /d "%~dp0.."

echo Building web...
call yarn.cmd install --ignore-scripts
if errorlevel 1 exit /b %errorlevel%
call npx.cmd expo export --platform web
if errorlevel 1 exit /b %errorlevel%

echo.
echo Build in frontend\dist
echo Copia sul server:
echo   scp -r dist/* root@SERVER:/root/password-manager/web/
echo   poi: docker exec nginx nginx -s reload
exit /b 0
