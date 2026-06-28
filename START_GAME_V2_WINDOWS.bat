@echo off
chcp 65001 >nul
cls
echo =========================================
echo  Legend Of Indle RPG V2 - Local MMORPG
echo =========================================
echo.
echo Instalando dependencias, se necessario...
call npm install
if errorlevel 1 (
  echo.
  echo Falha no npm install. Verifique se o Node.js esta instalado.
  pause
  exit /b 1
)
echo.
echo Iniciando servidor local em http://localhost:3000
echo Para fechar, pressione CTRL+C nesta janela.
echo.
start "Legend Of Indle V2" http://localhost:3000
call npm start
pause
