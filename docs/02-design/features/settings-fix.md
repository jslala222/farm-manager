# PDCA 설계서 (Design - D)

## 1. 개요
설정 페이지의 버튼 작동 문제를 해결하기 위한 구체적인 기술적 수정안을 설계합니다.

## 2. 주요 설계 변경 사항

### 2.1 UI/UX 개선
- **버튼 상태 가시화**: `saving` 상태일 때 버튼 텍스트를 "처리 중..."으로 변경하고 투명도를 낮추어 시각적 피드백 제공.
- **콘솔 로그 강화**: 버튼 클릭 시 `handleSaveFarm` 진입 여부와 `user` 정보를 즉시 출력하여 디버깅 용이성 확보.
- **모바일 최적화**: 버튼 주위의 여백을 충분히 확보하여 터치 미스 방지.

### 2.2 로직 보강
- **Supabase Query**: `insert` 시 `returning: 'minimal'` 대신 `select().single()`을 사용하여 생성된 데이터 확인.
- **초기화 동기화**: `useAuthStore`의 `initialized` 상태 외에도 `user` 로딩 여부를 면밀히 체크.
- **에러 핸들링**: `try-catch` 블록 내에서 Supabase 에러뿐만 아니라 런타임 에러도 모두 `alert`으로 노출.

## 3. 구현 파일
- [settings/page.tsx](file:///e:/Antigravity/strawberry-farm-manager/app/settings/page.tsx)

## 4. 검증 계획 (Design Verification)
- [ ] 버튼 클릭 시 `alert` 창이 최소 한 번 이상 뜨는지 확인.
- [ ] 농장 등록 성공 후 `initialize()`가 호출되어 UI가 '수정' 모드로 전환되는지 확인.
- [ ] `farm_houses` 테이블에 입력한 개수만큼 레코드가 생성되는지 확인.

---
*bkit Vibecoding Kit v1.5.2 적용*
