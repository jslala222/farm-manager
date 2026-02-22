/* 🍓 [멀티 크롭] 복합 작물 관리를 위한 스키마 보강 SQL 🍓 */

-- 1. 하우스(동) 테이블에 현재 작물 컬럼 추가
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farm_houses' AND column_name='current_crop') THEN
        ALTER TABLE farm_houses ADD COLUMN current_crop TEXT DEFAULT '딸기';
    END IF;
END $$;

-- 2. 수확 기록 테이블에 기록 시점 작물 컬럼 추가 (스냅샷용)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='harvest_records' AND column_name='crop_name') THEN
        ALTER TABLE harvest_records ADD COLUMN crop_name TEXT DEFAULT '딸기';
    END IF;
END $$;

-- 3. 기존 데이터 업데이트 (기존 기록은 모두 '딸기'로 간주)
UPDATE farm_houses SET current_crop = '딸기' WHERE current_crop IS NULL;
UPDATE harvest_records SET crop_name = '딸기' WHERE crop_name IS NULL;

RAISE NOTICE '성공: 복합 작물 관리를 위한 DB 컬럼 보강이 완료되었습니다.';
