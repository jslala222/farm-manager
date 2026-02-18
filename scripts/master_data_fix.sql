/* 
 * bkit Strawberry Farm Manager - 마스터 데이터 복구 및 RLS 해제 스크립트
 * ------------------------------------------------------------------
 * [목적]
 * 1. 데이터베이스 내 모든 테이블의 RLS(보안 정책)를 해제하여 데이터 유실/미표시 문제를 방지합니다.
 * 2. '관리자 딸기농장'의 존재를 확인하고, 모든 근로자/수확/판매 데이터를 해당 농장 ID로 통합합니다.
 * 3. 기 등록된 근로자 3명(자말, 알리, 사장님)이 화면에 즉시 표시되도록 정합성을 맞춥니다.
 */

-- 1. 모든 주요 테이블 RLS(Row Level Security) 강제 해제
ALTER TABLE IF EXISTS farms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS harvest_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenditures DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS farm_houses DISABLE ROW LEVEL SECURITY;

-- 2. 데이터 동기화 로직 실행
DO $$ 
DECLARE
    target_farm_id UUID;
BEGIN
    -- '관리자 딸기농장' 이름을 가진 농장 ID 찾기 (없으면 가장 최근 농장 사용)
    SELECT id INTO target_farm_id FROM farms WHERE farm_name = '관리자 딸기농장' LIMIT 1;
    
    IF target_farm_id IS NULL THEN
        SELECT id INTO target_farm_id FROM farms ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- 농장 ID가 발견된 경우, 모든 잃어버린 데이터들을 이 농장으로 연결
    IF target_farm_id IS NOT NULL THEN
        -- 근로자 데이터 동기화
        UPDATE workers SET farm_id = target_farm_id WHERE farm_id != target_farm_id OR farm_id IS NULL;
        
        -- 수확 기록 동기화
        UPDATE harvest_records SET farm_id = target_farm_id WHERE farm_id != target_farm_id OR farm_id IS NULL;
        
        -- 판매 기록 동기화
        UPDATE sales_records SET farm_id = target_farm_id WHERE farm_id != target_farm_id OR farm_id IS NULL;
        
        -- 지출 기록 동기화
        UPDATE expenditures SET farm_id = target_farm_id WHERE farm_id != target_farm_id OR farm_id IS NULL;
        
        -- 출근 기록 동기화
        UPDATE attendance_records SET farm_id = target_farm_id WHERE farm_id != target_farm_id OR farm_id IS NULL;

        -- 농장 하우스 동기화
        UPDATE farm_houses SET farm_id = target_farm_id WHERE farm_id != target_farm_id OR farm_id IS NULL;
        
        RAISE NOTICE 'SUCCESS: All data synced to Farm ID: %', target_farm_id;
    ELSE
        RAISE NOTICE 'WARNING: No target farm found. Please create a farm first.';
    END IF;
END $$;

-- 3. 근로자 3인방 상세 매칭 (확인 사살)
-- 만약 farm_id가 여전히 'e1c57114-6072-410d-b9d3-030978851312'인 경우를 대비한 보험용 쿼리
UPDATE workers 
SET farm_id = (SELECT id FROM farms ORDER BY created_at DESC LIMIT 1)
WHERE farm_id = 'e1c57114-6072-410d-b9d3-030978851312';
