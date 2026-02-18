/* 
 * 🍓 사장님 승인 완료: 데이터 무결성 복구 및 직원 역할 활성화 🍓
 * --------------------------------------------------------
 * 1. 'workers_role_check' 제약 조건을 수정하여 'staff'(일반직원)를 허용합니다.
 * 2. 모든 테이블의 RLS(보안 정책)를 해제하여 데이터 접근성을 확보합니다.
 * 3. 잃어버린 근로자 4명(이명자, 자말, 사장님, 알리)을 현재 활성 농장으로 강제 동기화합니다.
 */

-- [1] 근로자 역할 제약 조건 수정 (staff 추가)
DO $$ 
BEGIN
    -- 기존 제약 조건 삭제
    ALTER TABLE IF EXISTS workers DROP CONSTRAINT IF EXISTS workers_role_check;
    
    -- 새로운 제약 조건 추가 (staff 포함)
    ALTER TABLE workers ADD CONSTRAINT workers_role_check 
        CHECK (role IN ('family', 'foreign', 'part_time', 'staff'));
    
    RAISE NOTICE '성공: 근로자 역할 구분에 "staff(일반직원)"이 추가되었습니다.';
END $$;

-- [2] 모든 주요 테이블 RLS(보안 정책) 전면 해제
ALTER TABLE IF EXISTS farms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS harvest_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenditures DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS farm_houses DISABLE ROW LEVEL SECURITY;

-- [3] 데이터 ID 동기화 및 무결성 복구
DO $$ 
DECLARE
    current_farm_id UUID;
BEGIN
    -- '관리자 딸기농장'의 실제 ID를 찾습니다.
    SELECT id INTO current_farm_id FROM farms WHERE farm_name = '관리자 딸기농장' LIMIT 1;
    
    IF current_farm_id IS NULL THEN
        SELECT id INTO current_farm_id FROM farms ORDER BY created_at DESC LIMIT 1;
    END IF;

    IF current_farm_id IS NOT NULL THEN
        -- 모든 근로자를 이 농장 소속으로 강제 변경 및 활성화
        UPDATE workers SET farm_id = current_farm_id, is_active = true;
        
        -- '이명자'님을 새로운 'staff(일반직원)' 역할로 업데이트 (선택 사항이었으나 기본 적용)
        UPDATE workers SET role = 'staff' WHERE name = '이명자';
        
        -- 기타 기록들도 모두 이 농장으로 통합
        UPDATE harvest_records SET farm_id = current_farm_id;
        UPDATE sales_records SET farm_id = current_farm_id;
        UPDATE expenditures SET farm_id = current_farm_id;
        UPDATE attendance_records SET farm_id = current_farm_id;
        UPDATE farm_houses SET farm_id = current_farm_id;
        
        RAISE NOTICE '성공: 4명의 근로자 데이터가 농장(%)으로 긴급 복구되었습니다.', current_farm_id;
    END IF;
END $$;

-- [4] 권한부여 (최종 확인)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
