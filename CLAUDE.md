# 농장 관리 프로그램 (strawberry-farm-manager) - Claude 규칙

## 포트 규칙
- **개발 서버는 항상 5555 포트 사용** (`npm run dev` → `next dev -p 5555`)
- 3000 포트 절대 사용 금지 (충돌 잦음)
- 서버 시작 시 반드시 `port: 5555` 명시

## 개발 서버 시작
```bash
# 올바른 방법
npm run dev  # 자동으로 5555 포트 사용

# mcp__dev-server-manager 사용 시
# cwd: c:/Users/User/Desktop/제미나이 3/연습/claude/projects_001/farm-manager
# port: 5555
```

## 프로젝트 스택
- Next.js 16, React 19
- Supabase (인증 + DB)
- Zustand (상태 관리)
- TailwindCSS v4
- TypeScript

## 주요 경로
- 앱 라우터: `app/`
- 컴포넌트: `components/`
- 스토어: `store/`
- 라이브러리: `lib/`

## 작업 규칙
- 새 파일 생성 전 기존 파일 먼저 확인
- Supabase 환경변수는 `.env.local` 참조
- 컴포넌트는 `components/` 폴더에 정리

## 한국 시간대(KST) 규칙 ⭐
**모든 시간/날짜는 한국 시간(UTC+9)으로 처리**
- `next.config.ts`에 `process.env.TZ = "Asia/Seoul"` 설정됨
- 항상 `lib/utils.ts`의 한국 시간 함수 사용:
  - `getNowKST()` - 현재 한국 시간
  - `formatKSTDate()` - 포맷 형식 (기본값: 'YYYY-MM-DD HH:mm:ss')
  - `toKSTDateString()` - 날짜만 ('YYYY-MM-DD')
  - `formatKSTLocale()` - 한국식 포맷 ('2026. 3. 3. 오후 1:45:30')
  - `toKSTDate(date)` - Date 객체를 한국 시간으로 변환
- **절대금지**: `new Date().toUTCString()`, `new Date().toISOString()` (UTC 시간)
- DB에 저장할 때도 KST 함수 사용 필수
