-- 🍓 Financial Trinity v2.1 엔터프라이즈 하이브리드 확장 SQL 🍓
-- ----------------------------------------------------------------
-- 1. 근로자 테이블 확장: 기본 일당 필드 추가
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS default_daily_wage INTEGER DEFAULT 0;

-- 2. 출근 기록 테이블 확장: 실질 임금 및 현장 메모 필드 추가
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS actual_wage INTEGER;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS memo TEXT;

-- 3. 판매 기록 테이블 확장: 현장 수확 특이사항 및 정산 필드 추가
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS harvest_note TEXT;
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;

-- 4. 농장 설정 테이블 확장: 기본 택배비/자재비 세팅 (기업형 기본값)
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS default_shipping_fee INTEGER DEFAULT 4000;
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS default_packaging_fee INTEGER DEFAULT 2000;

COMMENT ON COLUMN public.workers.default_daily_wage IS '근로자별 기본 일당 (기업형 노무 관리용)';
COMMENT ON COLUMN public.attendance_records.actual_wage IS '그날 실제 지급하거나 확정된 임금';
COMMENT ON COLUMN public.sales_records.harvest_note IS '수확 당시의 환경이나 품종 특이사항 기록 (현장 일기 연동)';
