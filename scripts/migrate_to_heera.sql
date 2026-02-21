
/* 🍓 데이터 긴급 이관 SQL (관리자 -> 희라) 🍓 */

DO $$
DECLARE
    source_farm_id UUID;
    target_farm_id UUID;
    client_count INT;
    sales_count INT;
    exp_count INT;
BEGIN
    -- 1. '관리자' 농장 찾기 (데이터가 잘못 들어간 곳)
    SELECT id INTO source_farm_id FROM farms WHERE farm_name LIKE '%관리자%' LIMIT 1;
    
    -- 2. '희라' 농장 찾기 (데이터를 받을 곳)
    SELECT id INTO target_farm_id FROM farms WHERE farm_name LIKE '%희라%' LIMIT 1;

    -- 농장 ID 확인
    IF source_farm_id IS NULL THEN
        RAISE EXCEPTION '❌ 관리자 농장을 찾을 수 없습니다.';
    END IF;
    
    IF target_farm_id IS NULL THEN
        RAISE EXCEPTION '❌ 희라 농장을 찾을 수 없습니다.';
    END IF;

    RAISE NOTICE '🚀 데이터 이관 시작: % (관리자) -> % (희라)', source_farm_id, target_farm_id;

    -- 3. 거래처(Clients) 이동
    UPDATE clients 
    SET farm_id = target_farm_id 
    WHERE farm_id = source_farm_id;
    
    GET DIAGNOSTICS client_count = ROW_COUNT;
    RAISE NOTICE '✅ 거래처 %건 이동 완료', client_count;

    -- 4. 판매 기록(Sales Records) 이동
    UPDATE sales_records 
    SET farm_id = target_farm_id 
    WHERE farm_id = source_farm_id;
    
    GET DIAGNOSTICS sales_count = ROW_COUNT;
    RAISE NOTICE '✅ 판매 기록 %건 이동 완료', sales_count;

    -- 5. 지출 기록(Expenditures) 이동
    UPDATE expenditures 
    SET farm_id = target_farm_id 
    WHERE farm_id = source_farm_id;
    
    GET DIAGNOSTICS exp_count = ROW_COUNT;
    RAISE NOTICE '✅ 지출 기록 %건 이동 완료', exp_count;
    
    RAISE NOTICE '✨ 모든 데이터 이관이 완료되었습니다! 화면을 새로고침 해주세요.';
    
END $$;
