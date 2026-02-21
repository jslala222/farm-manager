-- 🍓 수확 기록 테이블 보강: 현장 메모 컬럼 추가 🍓
-- ----------------------------------------------------------------
-- [1] harvest_records 테이블에 harvest_note 컬럼 추가
ALTER TABLE public.harvest_records ADD COLUMN IF NOT EXISTS harvest_note TEXT;

-- [2] 컬럼 설명 추가
COMMENT ON COLUMN public.harvest_records.harvest_note IS '수확 당시의 환경이나 품종 특이사항 기록 (현장 일기 연동)';

-- [3] (참고) 기존에 sales_records에 잘못 들어갔던 컬럼은 유지하거나 필요시 나중에 정리
-- (현재는 안전을 위해 건드리지 않음)
