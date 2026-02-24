# PDCA 설계서 - 깃허브 업로드 (GitHub Push)

## 1. 구성 요소 (Components)
- **로컬 저장소**: `e:\Antigravity\strawberry-farm-manager`
- **원격 저장소**: GitHub (URL 필요)
- **제외 파일**: `.gitignore`에 정의된 파일 (node_modules, .env, .next 등)

## 2. 보안 정책 (Security)
- **`.env` 파일**: 절대 업로드 금지. 대신 `.env.example` 파일을 생성하여 필요한 환경변수 목록만 공유.
- **Supabase 인증 정보**: 코드 내 직설적인 키 값 노출 금지. 모두 환경 변수 처리 확인.

## 3. 원격 연결 사양 (Remote Specs)
- **Remote Name**: `origin`
- **Branch**: `master` (또는 `main`)
- **Protocol**: HTTPS 또는 SSH

## 4. 수행 로직 (Workflow)
1. `git status`로 현재 상태 재확인
2. `.env.example` 파일 생성 (협업용 템플릿)
3. 사용자에게 깃허브 저장소 URL 요청
4. `git remote add origin [URL]`
5. `git push -u origin master`
