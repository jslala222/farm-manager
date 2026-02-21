-- [bkit 긴급 복구] 정산 오류 해결을 위한 만능 SQL
-- 사장님, 아래 내용을 통째로 복사해서 Supabase SQL Editor에 붙여넣고 [Run]을 눌러주세요!

-- 1. 정산 금액 및 날짜 칸 추가
ALTER TABLE public.sales_records 
ADD COLUMN IF NOT EXISTS settled_amount BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

-- 2. 등급(Grade) 필드 누락 대비 추가
ALTER TABLE public.sales_records 
ADD COLUMN IF NOT EXISTS grade TEXT DEFAULT '미지정';

-- 3. 파트너 ID 누락 대비 추가 (B2B 연동용)
ALTER TABLE public.sales_records 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id);

-- 4. 배송 방법 누락 대비 추가
ALTER TABLE public.sales_records 
ADD COLUMN IF NOT EXISTS delivery_method TEXT;

-- 도움말: 이 스크립트를 실행하시면 "데이터 저장 오류"가 말끔히 사라지고 정산이 시원하게 완료될 것입니다. 🍓✅
