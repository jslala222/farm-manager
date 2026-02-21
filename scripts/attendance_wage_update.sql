-- [1] 출근 기록 테이블에 일당 및 근무시간 컬럼 추가
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS daily_wage int DEFAULT NULL;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS work_hours numeric DEFAULT NULL;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS headcount int DEFAULT 1;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

-- [2] 기존 데이터 제약 조건 업데이트 (이미 이전 단계에서 staff 추가됨)
-- 혹시 안되어 있을 경우를 대비해 다시 한 번 실행
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_role_check;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_role_check CHECK (role IN ('family', 'staff', 'foreign', 'part_time'));
