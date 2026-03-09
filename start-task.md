@echo off
setlocal

cd /d "c:\Users\User\Desktop\제미나이 3\연습\claude\projects_001\farm-manager"

echo [farm-manager] node 프로세스 정리...
taskkill /F /IM node.exe >nul 2>&1

echo [farm-manager] .next 캐시 정리...
if exist ".next" rmdir /s /q ".next"

echo [farm-manager] dev server start (5555)...
call npm run dev

endlocal