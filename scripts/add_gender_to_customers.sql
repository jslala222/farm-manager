-- 🍓 개인 고객(B2C) 성별 컬럼 추가 SQL
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '미지정';

-- 주석 추가
COMMENT ON COLUMN public.customers.gender IS '고객 성별 (남/여/미지정)';
