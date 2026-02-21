-- [지능형 주소 자산화(Scenario C) 전사적 확장 통합본] 🍓
-- 거래처, 고객, 직원, 농장 정보를 모두 수용하는 통합 SQL입니다.

-- 1. partners(거래처) : 본사와 납품처 분리 보관
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS hq_postal_code VARCHAR(10);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS hq_latitude DOUBLE PRECISION;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS hq_longitude DOUBLE PRECISION;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS delivery_postal_code VARCHAR(10);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;

-- 2. customers(개인고객)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 3. workers(직원/알바)
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 4. farms(농장 정보)
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 5. sales_records (판매 기록)
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 주석 추가 (데이터 자산 정의)
COMMENT ON TABLE public.partners IS '거래처 위치 및 배송 자산 데이터 포함';
COMMENT ON COLUMN public.workers.postal_code IS '직원 거주지 우편번호';
COMMENT ON COLUMN public.farms.postal_code IS '농장 주소 우편번호';
