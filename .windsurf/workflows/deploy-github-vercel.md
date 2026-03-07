---
description: Commit → GitHub Push → Vercel Deploy (farm-manager)
---

이 워크플로우는 **farm-manager** 프로젝트에서 변경사항을 커밋하고 GitHub에 푸시한 뒤, Vercel에 배포하는 표준 절차입니다.

아래 내용은 **처음 보는 사람도 그대로 따라 할 수 있게** 주석/설명을 많이 포함합니다.

용어 정리(중요):
- **커밋(Commit) = 로컬 저장**
  - 내 PC에만 변경 이력이 저장됩니다.
  - GitHub/Vercel은 아직 아무 변화도 모릅니다.
  - 따라서 **커밋만으로는 배포가 발생하지 않습니다.**
- **푸시(Push) = GitHub 업로드**
  - 로컬 커밋을 GitHub에 올리는 동작입니다.
- **배포(Deploy) = (이 프로젝트 기준) 푸시로 트리거되는 자동 배포**
  - 이 프로젝트는 Vercel Git 연동 자동 배포를 사용합니다.
  - 즉, **GitHub에 푸시가 되면 Vercel이 자동으로 배포를 시작**합니다.
  - 실무에서는 이 프로젝트에서 “배포한다” = “푸시한다”로 말해도 됩니다.

전제:
- Git remote `origin`이 설정되어 있어야 합니다.
- Vercel CLI가 설치되어 있어야 합니다(`vercel --version`).
- 이 프로젝트는 **Vercel Git 연동 자동 배포**를 사용합니다.
  - `git push origin main`만 해도 Vercel이 자동으로 Production 배포를 만듭니다.

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
  - 역할: **GitHub push**만 수행
  - 실행: CMD에서 `배포`
  - 안전장치: 커밋 안 된 변경사항이 있으면 중단(실수 배포 방지)

즉, 평소에는 이렇게만 하면 됩니다.

1. `커밋`
2. `배포`

정리:
- `커밋` = 로컬 저장
- `배포` = 푸시(=GitHub 업로드)
- 푸시가 되면 Vercel 자동배포

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
### 기본(권장): Git 연동 자동 배포
- 푸시가 끝나면 Vercel Dashboard에서 배포가 자동으로 시작됩니다.
- 이 모드에서는 **`vercel --prod`를 추가로 실행하지 마세요.**
  - `git push`로 이미 Production 배포가 하나 생성되는데,
  - `vercel --prod`까지 실행하면 Production 배포가 **2개** 생길 수 있습니다.

### (선택) Vercel CLI로 수동 운영 배포
Git 연동 자동 배포를 쓰지 않거나, 특별히 CLI 배포가 필요할 때만 사용합니다.

1. 최초 1회(환경별로 필요):
   - `vercel link`
2. 운영 배포:
   - `vercel deploy --prod`

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
