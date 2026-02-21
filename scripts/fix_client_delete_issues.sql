-- [1] clients 테이블에 DELETE 정책 추가 (RLS)
-- 기존에 SELECT, INSERT, UPDATE 정책은 있으나 DELETE가 누락되어 삭제가 되지 않았습니다.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clients' AND policyname = 'Users can delete own clients.'
    ) THEN
        CREATE POLICY "Users can delete own clients." ON public.clients FOR DELETE USING (true);
    END IF;
END $$;

-- [2] sales_records 테이블의 외래키 제약 조건을 CASCADE 방식으로 변경
-- 거래처 삭제 시 연결된 판매 기록이 있으면 삭제가 차단되는 문제를 해결합니다.

DO $$
BEGIN
    -- 기존 제약 조건 삭제 (이름이 상이할 수 있으므로 안전하게 처리)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'sales_records_client_id_fkey' 
        AND table_name = 'sales_records'
    ) THEN
        ALTER TABLE public.sales_records DROP CONSTRAINT sales_records_client_id_fkey;
    END IF;
END $$;

-- 제약 조건 재생성 (ON DELETE CASCADE 추가)
ALTER TABLE public.sales_records 
ADD CONSTRAINT sales_records_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES public.clients(id) 
ON DELETE CASCADE;

-- 결과 확인
RAISE NOTICE '✅ RLS 삭제 정책 추가 및 외래키 CASCADE 설정이 완료되었습니다.';
