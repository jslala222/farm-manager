# 데이터 연결성 및 통합성 복구 계획서 (Data Connectivity Recovery)

> 버전: 1.1.0 | 작성일: 2026-02-19 | 상태: 초안 (Draft)

## 1. 개요 (Executive Summary)
애플리케이션 전반에서 발생하는 데이터 로딩 실패(로그인, 수확 대시보드) 및 데이터 저장 에러(출근부 제약 조건 위반)를 bkit 방법론에 따라 체계적으로 해결합니다. Supabase(BaaS) 환경의 RLS 설정과 스키마 제약 조건을 정합성에 맞게 조정하는 것이 핵심입니다.

## 2. 목표 (Goals and Objectives)
- 로그인 페이지의 연결 확인 및 인증 데이터 로딩 로직 정상화
- 수확 대시보드의 `farm_id` 기반 데이터 페칭 안정화
- 출근부 저장 시 발생하는 `attendance_records_role_check` 위반 해결
- 전체적인 데이터 통합성(Data Integrity) 확보

## 3. 범위 (Scope)
### 포함 범위 (In Scope)
- `app/login/page.tsx`: 연결 확인 쿼리 문법 수정
- `store/authStore.ts`: 농장/프로필 데이터 로딩 예외 처리 강화
- `app/harvest/page.tsx`: 수확 데이터 페칭 및 로딩 상태 개선
- `app/attendance/page.tsx`: 출근부 저장 로직 및 에러 처리 보완
- Supabase SQL: `attendance_records` 테이블 제약 조건 수정

### 제외 범위 (Out of Scope)
- 신규 UI 기능 추가
- 인프라 레벨의 Supabase 환경 설정 변경

## 4. 성공 기준 (Success Criteria)
| 기준 | 지표 | 목표 |
|-----------|--------|--------|
| 연결 확인 정상화 | 로그인 페이지 체크 버튼 | 오류 없이 "성공" 메시지 출력 |
| 데이터 노출 여부 | 수확/출근부 페이지 | 기존 데이터가 누락 없이 로드됨 |
| 저장 무결성 | 출근부 저장 시도 | 제약 조건 위반 없이 저장 완료 |

## 5. 리스크 (Risks)
| 리스크 | 영향도 | 완화 방안 |
|------|--------|------------|
| 잘못된 SQL 적용 | 데이터 손실 | 작업 전 백업 스크립트(Check) 실행 및 트랜잭션 주의 |
| RLS 설정 오류 | 보안 취약점 | RLS 비활성화 상태를 유지하되 권한 부여(Grant) 확인 |

## 6. 구현 상세 (Design Preview)
### [DB 스키마 수정]
```sql
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_role_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_role_check 
    CHECK (role IN ('family', 'foreign', 'part_time', 'staff'));
```

### [FE 로직 수정]
- `authStore`: `profile` 로딩 실패 시 재시도 또는 상세 로그 출력
- `login page`: `select('*', { count: 'exact', head: true })` 사용
