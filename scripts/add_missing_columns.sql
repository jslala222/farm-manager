/* 🍓 [보강] 누락된 DB 컬럼(created_at) 일괄 추가 및 정합성 강화 SQL 🍓 */

-- [1] workers 테이블 보강
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workers' AND column_name='created_at') THEN
        ALTER TABLE workers ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- [2] harvest_records 테이블 보강
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='harvest_records' AND column_name='created_at') THEN
        ALTER TABLE harvest_records ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- [3] sales_records 테이블 보강
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_records' AND column_name='created_at') THEN
        ALTER TABLE sales_records ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- [4] attendance_records 테이블 보강
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance_records' AND column_name='created_at') THEN
        ALTER TABLE attendance_records ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- [5] expenditures 테이블 보강
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenditures' AND column_name='created_at') THEN
        ALTER TABLE expenditures ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- [6] 최종 데이터 정합성 확인 알림
RAISE NOTICE '성공: 모든 테이블에 누락된 "created_at" 컬럼이 보강되었습니다.';
