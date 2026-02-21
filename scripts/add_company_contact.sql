-- partners 테이블에 본사 대표번호 컬럼 추가
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='company_contact') THEN
        ALTER TABLE public.partners ADD COLUMN company_contact TEXT;
    END IF;
END $$;
