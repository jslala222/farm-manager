# [Design] 출근부 고도화 및 변동 급여 시스템 설계

## 1. 데이터베이스 설계 (DB Schema)
`attendance_records` 테이블에 다음 컬럼을 추가하여 데이터 영속성을 보장합니다.

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `daily_wage` | `integer` | 실제 지급된 일당 (알바용) |
| `work_hours` | `numeric` | 근무 시간 (알바용) |
| `headcount` | `integer` | 출근 인원수 (기본값: 1, 팀 단위 기록용) |
| `notes` | `text` | 특이사항 메모 (전체 공통) |

### 제약 조건 (Constraint)
- `role` 체크 제약 조건에 `staff`(일반직원)가 포함되어야 함.
- (완료) `role IN ('family', 'staff', 'foreign', 'part_time')`

## 2. UI/UX 설계
### 출근 기록 화면 (Record Tab)
- 상단: 날짜 선택 Date Picker.
- 리스트: 카드형 UI로 변경하여 가독성 증대.
- 입력창: 
  - `part_time` 직군: 일당, 시간, 인원수 입력창 + 메모 입력창 노출.
  - `family`, `staff`, `foreign` 직군: 이름 하단에 메모(특이사항) 입력창 공통 노출.

### 통계 화면 (Stats Tab)
- 주간/월간 단위로 그룹화하여 총 인원과 총 지출(노무비) 표시.
- 개인별 출근 현황 리스트 출력.

## 3. 로직 설계
- `handleSave`: 
  1. 선택된 `work_date`에 해당하는 기존 데이터를 삭제(Re-write 방식).
  2. 현재 화면의 모든 인원 상태(출근/결근, 일당, 시간, 메모)를 일괄 Insert.
- `fetchWorkersAndAttendance`:
  - `selectedDate`가 바뀔 때마다 해당 날짜의 데이터를 Supabase에서 다시 로드.

---
*bkit Feature Usage Report*
- workflow: pdca
- status: design
- data_integrity: manual_input_consistency_check
