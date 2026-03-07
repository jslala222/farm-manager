@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ==========================================================
REM 배포.cmd
REM 목적:
REM   - "배포" 한 번으로:
REM       1) GitHub push (origin/main)
REM       2) (Vercel Git 연동 자동 배포 사용) -> push 후 Vercel이 자동 배포
REM
REM 사용법:
REM   1) (권장) 먼저 "커밋.cmd"로 로컬 커밋을 만든다.
REM   2) CMD에서 아래처럼 실행
REM        배포
REM
REM 동작 방식:
REM   - 커밋되지 않은 변경사항이 있으면, 실수 방지를 위해 중단합니다.
REM   - 원격(origin)과 브랜치(main)는 고정입니다.
REM   - Vercel은 Git 연동 자동 배포를 사용합니다. (중복 배포 방지)
REM
REM 주의:
REM   - 이 스크립트는 원격 리소스(GitHub/Vercel)에 영향을 주므로 실행 시 주의하세요.
REM ==========================================================

echo.
echo.
echo [0/2] 사전 체크...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: 이 폴더는 Git 저장소가 아닙니다. farm-manager 루트에서 실행하세요.
  endlocal & exit /b 1
)

echo.
echo [1/2] 작업 트리 깨끗한지 확인(커밋 안된 변경 있으면 중단)...
REM 1) tracked 변경 확인
git diff --quiet
if errorlevel 1 (
  echo ERROR: 커밋되지 않은 변경사항(추적 파일 수정)이 있습니다. 먼저 커밋하세요.
  git status --porcelain
  endlocal & exit /b 1
)

REM 2) staged 변경 확인
git diff --cached --quiet
if errorlevel 1 (
  echo ERROR: 스테이징된 변경사항이 있습니다. 먼저 커밋하세요.
  git status --porcelain
  endlocal & exit /b 1
)

REM 3) untracked 확인
for /f "delims=" %%U in ('git ls-files --others --exclude-standard') do (
  echo ERROR: 커밋되지 않은 변경사항(미추적 파일)이 있습니다. 먼저 커밋하세요.
  git status --porcelain
  endlocal & exit /b 1
)

echo.
echo [2/2] GitHub 푸시: git push origin main
git push origin main
if errorlevel 1 (
  echo ERROR: git push 실패
  endlocal & exit /b 1
)

echo.
echo DONE: GitHub push 완료. Vercel이 Git 연동으로 자동 배포를 시작합니다.
echo - Vercel Dashboard -> Deployments에서 진행 상황을 확인하세요.
endlocal & exit /b 0
