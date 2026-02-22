-- 🍓 B2B/B2C 상세 주소(나머지 주소) 지원 마이그레이션 🍓

-- [1] partners (B2B) 테이블 컬럼 확장
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS hq_detail_address TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS delivery_detail_address TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS hq_postal_code TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT;

-- [2] customers (B2C) 테이블 컬럼 확장
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS detail_address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- [3] 주석 추가 (관리 편의성)
COMMENT ON COLUMN public.partners.hq_detail_address IS '본사 상세 주소';
COMMENT ON COLUMN public.partners.delivery_detail_address IS '납품 상세 주소';
COMMENT ON COLUMN public.customers.detail_address IS '고객 상세 주소';
