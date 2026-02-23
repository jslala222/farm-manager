-- [bkit] 사장님 요청에 따른 택배 정보 고도화 마이그레이션
-- 1. customers 테이블에 상세주소 컬럼 실재화
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS detail_address TEXT;

-- 2. sales_records 테이블에 택배비 구분(선불/착불) 컬럼 추가
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS shipping_fee_type TEXT DEFAULT '선불';

-- 3. 기존 데이터 무결성 체크 (null 값 방지)
UPDATE public.sales_records SET shipping_fee_type = '선불' WHERE shipping_fee_type IS NULL OR shipping_fee_type = '';
