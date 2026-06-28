@echo off
title Legend Of Indle - Servidor Local
cd /d "%~dp0"
echo ============================================
echo   Legend Of Indle - Modo Local V92
echo ============================================
echo.
if not exist node_modules (
  echo Instalando dependencias...
  npm install
)
echo.
echo Iniciando servidor local...
start "Legend Of Indle" http://localhost:3000
npm start
pause
