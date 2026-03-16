-- farms 테이블에 detail_address(나머지 주소) 컬럼 추가
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS detail_address TEXT;
COMMENT ON COLUMN public.farms.detail_address IS '농장 상세 주소 (나머지 주소)';
