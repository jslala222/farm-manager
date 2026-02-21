# 데이터 연결성 및 통합성 복구 설계서 (Data Connectivity Recovery)

> 버전: 1.0.0 | 작성일: 2026-02-19 | 상태: 초안 (Draft)

## 1. 개요 (Overview)
본 설계서는 데이터 로딩 실패 및 DB 제약 조건 오류를 해결하기 위한 기술적 세부 사항을 다룹니다.

## 2. 데이터 모델 및 스키마 (Data Model)
### 2.1 테이블 제약 조건 수정
`attendance_records` 테이블의 `role` 컬럼 제약 조건을 업데이트하여 `staff` 역할을 수용합니다.

```sql
-- attendance_records 테이블의 역학 체크 제약 조건 업데이트
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_role_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_role_check 
    CHECK (role IN ('family', 'foreign', 'part_time', 'staff'));
```

## 3. 애플리케이션 로직 (Logic)
### 3.1 연결 확인 쿼리 (Login Page)
- **변경 전**: `.select('count')`
- **변경 후**: `.select('*', { count: 'exact', head: true })`
- **목적**: Supabase에서 지원하지 않는 `count` 컬럼 선택 대신 공식적인 카운트 조회 방식을 사용하여 연결 상태를 검증합니다.

### 3.2 데이터 로딩 안정화 (Auth Store)
- `loadUserData` 함수 내에서 `profiles` 조회 시 에러가 발생하더라도 `initialized: true`를 설정하여 무한 로딩을 방지합니다.
- 프로필이 없을 경우 `profile: null` 상태를 유지하고, UI에서 "승인 대기 중" 또는 "관리자에게 문의" 메시지를 표시하도록 유도합니다.

### 3.3 대시보드 페칭 (Harvest/Attendance)
- `farm_id`가 `undefined`인 경우 쿼리를 실행하지 않도록 가드 로직을 강화합니다.
- 데이터 로딩 중(`/`) 상태와 데이터가 없는 경우를 명확히 구분하여 사용자 경험을 개선합니다.

## 4. 테스트 계획 (Test Plan)
| 테스트 케이스 | 기대 결과 |
|-----------|-----------------|
| 연결 상태 확인 버튼 클릭 | "성공" 팝업 노출 |
| staff 역할 직원 출근 체크 | `attendance_records` 테이블에 정상 저장 |
| 농장 정보 없는 계정 로그인 | 대시보드 진입 시 "승인 대기" 안내 노출 |
