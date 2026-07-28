@echo off
cd /d "%~dp0"
start chrome http://localhost:3000
timeout /t 3 /nobreak
npm start
