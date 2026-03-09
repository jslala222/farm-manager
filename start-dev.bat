@echo off
setlocal
cd /d "c:\Users\User\Desktop\제미나이 3\연습\claude\projects_001\farm-manager"
taskkill /F /IM node.exe >nul 2>&1
if exist ".next" rmdir /s /q ".next"
call npm run dev
endlocal