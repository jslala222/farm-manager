-- [sales_records] 테이블의 [client_id] 외래키 제약 조건을 CASCADE 방식으로 변경합니다.
-- 1. 기존 제약 조건 이름을 찾아서 삭제합니다. (이름이 다를 수 있으므로 동적 SQL 사용 또는 수동 확인 필요)
-- Supabase에서 기본적으로 부여하는 이름인 'sales_records_client_id_fkey'를 가정합니다.

DO $$
BEGIN
    -- 제약 조건이 존재하면 삭제
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'sales_records_client_id_fkey' 
        AND table_name = 'sales_records'
    ) THEN
        ALTER TABLE public.sales_records DROP CONSTRAINT sales_records_client_id_fkey;
    END IF;
END $$;

-- 2. CASCADE 옵션을 추가하여 다시 생성
ALTER TABLE public.sales_records 
ADD CONSTRAINT sales_records_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES public.clients(id) 
ON DELETE CASCADE;

-- 확인용 메시지
RAISE NOTICE '✅ sales_records 테이블의 외래키 제약 조건에 ON DELETE CASCADE가 적용되었습니다.';
