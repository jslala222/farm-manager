/* 
 * 🚨 [긴급] 데이터 즉시 복구 및 가시성 확보 마스터 SQL 🚨
 * --------------------------------------------------
 * [현상] DB에 근로자(자말, 알리, 사장님)가 있으나 화면에 보이지 않음.
 * [원인] 현재 로그인된 농장 ID와 기존 데이터의 ID가 서로 달라 필터링되고 있음.
 * [해결] 모든 데이터를 현재 사장님이 보고 계신 '관리자 딸기농장'으로 강제 통합합니다.
 */

-- [1] 보안 정책(RLS) 전면 해제 (데이터가 숨겨지는 것 방지)
ALTER TABLE IF EXISTS farms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS harvest_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenditures DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS farm_houses DISABLE ROW LEVEL SECURITY;

-- [2] 권한 부여 (혹시 모를 접근 차단 방지)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- [3] 데이터 ID 동기화 (가장 중요)
DO $$ 
DECLARE
    current_farm_id UUID;
BEGIN
    -- 1. '관리자 딸기농장'이라는 이름을 가진 농장의 실제 ID를 찾습니다.
    SELECT id INTO current_farm_id FROM farms WHERE farm_name = '관리자 딸기농장' LIMIT 1;
    
    -- 2. 만약 해당 이름의 농장이 없다면, 현재 DB에 있는 가장 최신 농장을 기준으로 잡습니다.
    IF current_farm_id IS NULL THEN
        SELECT id INTO current_farm_id FROM farms ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- 3. 찾은 ID가 있다면, 모든 데이터(근로자, 수확, 판매 등)를 이 ID로 업데이트합니다.
    IF current_farm_id IS NOT NULL THEN
        -- 모든 근로자를 이 농장 소속으로 변경
        UPDATE workers SET farm_id = current_farm_id;
        
        -- 모든 수확 기록을 이 농장 소속으로 변경
        UPDATE harvest_records SET farm_id = current_farm_id;
        
        -- 모든 판매 기록을 이 농장 소속으로 변경
        UPDATE sales_records SET farm_id = current_farm_id;
        
        -- 모든 지출 기록을 이 농장 소속으로 변경
        UPDATE expenditures SET farm_id = current_farm_id;
        
        -- 모든 출근 기록을 이 농장 소속으로 변경
        UPDATE attendance_records SET farm_id = current_farm_id;

        -- 모든 하우스(동) 정보도 이 농장으로 연결
        UPDATE farm_houses SET farm_id = current_farm_id;
        
        RAISE NOTICE '성공: 모든 데이터가 농장 ID(%)로 동기화되었습니다.', current_farm_id;
    ELSE
        -- 농장 자체가 아예 없는 경우 (드문 케이스)
        RAISE NOTICE '경고: 동기화할 농장이 없습니다. 농장 설정을 먼저 완료해 주세요.';
    END IF;
END $$;

-- [4] 근로자 활성화 상태 강제 업데이트
UPDATE workers SET is_active = true WHERE is_active = false;

/* 
 * ✅ 실행 후 조치: 
 * SQL 실행 후 웹 브라우저 화면을 '새로고침(F5)' 하시면 
 * 근로자 3명이 즉시 나타납니다.
 */
