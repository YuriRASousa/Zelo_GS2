@echo off
REM Abre o app Zelo no navegador (Expo web, porta 8082).
cd /d "%~dp0..\mobile\ZeloApp"
if not exist node_modules call npm install
npx expo start --web --port 8082
