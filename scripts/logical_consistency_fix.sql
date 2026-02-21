-- [1] 근로자(workers) 테이블의 직군 제약 조건에 'staff' 추가
ALTER TABLE public.workers DROP CONSTRAINT IF EXISTS workers_role_check;
ALTER TABLE public.workers ADD CONSTRAINT workers_role_check CHECK (role IN ('family', 'staff', 'foreign', 'part_time'));

-- [2] 출근 기록(attendance_records) 테이블의 직군 제약 조건에 'staff' 추가
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_role_check;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_role_check CHECK (role IN ('family', 'staff', 'foreign', 'part_time'));

-- [3] 혹시 모를 기존 '박영록'님 등 일반 직원의 데이터 정합성 보정
-- (만약 잘못된 타입으로 들어가 있었다면 'staff'로 교정합니다)
UPDATE public.workers SET role = 'staff' WHERE role NOT IN ('family', 'foreign', 'part_time') AND is_active = true;
UPDATE public.attendance_records SET role = 'staff' WHERE role NOT IN ('family', 'foreign', 'part_time');
