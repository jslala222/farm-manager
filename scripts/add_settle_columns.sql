-- [정밀 정산용] 정산 날짜 및 실제 입금액 필드 추가 SQL
-- 사장님, Supabase의 SQL Editor 보드에 복사해서 붙여넣고 [Run] 버튼을 눌러주세요.

ALTER TABLE public.sales_records 
ADD COLUMN IF NOT EXISTS settled_amount BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

-- 도움말: 
-- 이제 입금 날짜가 다르거나 입금액이 예상과 조금 달라도 꼼꼼하게 장부에 적으실 수 있습니다. 🍓💰
