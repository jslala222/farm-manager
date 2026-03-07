---
description: Commit → GitHub Push → Vercel Deploy (farm-manager)
---

이 워크플로우는 **farm-manager** 프로젝트에서 변경사항을 커밋하고 GitHub에 푸시한 뒤, Vercel에 배포하는 표준 절차입니다.

아래 내용은 **처음 보는 사람도 그대로 따라 할 수 있게** 주석/설명을 많이 포함합니다.

전제:
- Git remote `origin`이 설정되어 있어야 합니다.
- Vercel CLI가 설치되어 있어야 합니다(`vercel --version`).
- 배포는 아래 2가지 중 하나입니다.
  - Git 연동 자동 배포: `git push`만 하면 Vercel이 자동 배포
  - Vercel CLI 수동 배포: `vercel --prod` 실행

## 1) 변경사항 확인
1. `git status`
2. 커밋에 포함되면 안 되는 파일이 보이면 `.gitignore`를 먼저 정리합니다.

### (추천) 단축 명령 2개로만 쓰는 방법
프로젝트 루트에 아래 2개 파일이 있으면, 앞으로는 이 두 개만 쓰면 됩니다.

- `커밋.cmd`
  - 역할: **로컬 커밋만** 생성(저장)
  - 실행: CMD에서 `커밋`
  - 입력: 커밋 메시지 1줄

- `배포.cmd`
  - 역할: **GitHub push + Vercel 운영배포**
  - 실행: CMD에서 `배포`
  - 안전장치: 커밋 안 된 변경사항이 있으면 중단(실수 배포 방지)

즉, 평소에는 이렇게만 하면 됩니다.

1. `커밋`
2. `배포`

## 2) 커밋
1. 전체 스테이징:
   - `git add -A`
2. 커밋:
   - `git commit -m "<메시지>"`

권장 커밋 메시지 예시:
- `feat: inventory module + supabase migrations`
- `fix: inventory RLS + settings toggle`

## 3) GitHub 푸시
- `git push origin main`

## 4) Vercel 배포
### 옵션 A) Git 연동 자동 배포
- 푸시가 끝나면 Vercel Dashboard에서 배포가 자동으로 시작됩니다.

### 옵션 B) Vercel CLI로 운영 배포
1. 최초 1회(환경별로 필요):
   - `vercel link`
2. 운영 배포:
   - `vercel --prod`

#### `배포.cmd` 사용 시
`배포.cmd`는 내부적으로 다음을 수행합니다.

1. `git status --porcelain`로 작업트리 깨끗한지 확인
2. `git push origin main`
3. `vercel --prod`

## 5) 배포 확인
- Vercel 대시보드에서 배포 상태 확인
- 배포 URL에서 `/login`, `/settings`, `/inventory` 동작 확인

## Troubleshooting
- `vercel --prod`에서 환경변수 누락 경고가 나면:
  - Vercel Project Settings → Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 등이 설정되어 있는지 확인
- `git push` 권한 오류:
  - GitHub 로그인/토큰/SSH 설정 확인

### 자주 나는 케이스
- **`vercel --prod`가 "프로젝트가 link 안 됨"이라고 할 때**
  - 프로젝트 루트에서 `vercel link`를 1회 실행
- **배포는 됐는데 화면이 깨질 때**
  - Vercel의 Environment Variables에 Supabase URL/KEY가 들어있는지 확인
