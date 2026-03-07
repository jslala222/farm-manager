@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ==========================================================
REM 커밋.cmd
REM 목적:
REM   - "커밋" 한 번으로: 변경사항 스테이징 + 로컬 커밋만 수행
REM   - GitHub push / Vercel 배포는 하지 않음
REM
REM 사용법:
REM   1) CMD를 farm-manager 폴더에서 열기
REM   2) 아래처럼 실행
REM        커밋
REM   3) 커밋 메시지 입력 후 Enter
REM
REM 주의:
REM   - 커밋 메시지를 비우면 취소됩니다.
REM   - 커밋에 포함하면 안 되는 파일은 .gitignore로 제외하세요.
REM ==========================================================

echo.
echo [1/3] Git 상태 확인...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: 이 폴더는 Git 저장소가 아닙니다. farm-manager 루트에서 실행하세요.
  exit /b 1
)

echo.
echo [2/3] 변경사항 스테이징(git add -A)...
git add -A
if errorlevel 1 (
  echo ERROR: git add 실패
  exit /b 1
)

echo.
echo [3/3] 커밋 메시지를 입력하세요.
set "MSG=%~1"
if "%MSG%"=="" (
  set /p MSG=commit message: 
)
if "%MSG%"=="" (
  echo 취소: 커밋 메시지가 비어있습니다.
  endlocal & exit /b 0
)

git commit -m "%MSG%"
set "GIT_COMMIT_RC=%ERRORLEVEL%"
if not "%GIT_COMMIT_RC%"=="0" (
  echo INFO: 커밋이 생성되지 않았습니다.
  echo - 변경사항이 없거나(no changes)
  echo - 혹은 커밋 훅/설정 문제일 수 있습니다.
  endlocal & exit /b 1
)

echo.
echo DONE: 로컬 커밋 완료
endlocal & exit /b 0
