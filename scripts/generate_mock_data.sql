-- 🍓 Generate Random Data for Harvest & Sales (100 rows each)
-- 사장님의 요청에 따라 통계 확인용 테스트 데이터를 생성합니다. 
-- 직원(workers) 테이블은 건드리지 않습니다.

DO $$
DECLARE
    v_farm_id UUID;
    v_house_list INT[];
    v_house_count INT;
    v_random_house INT;
    v_random_date TIMESTAMPTZ;
    v_i INT;
BEGIN
    -- 1. Get the first farm ID (Assuming single user scenario or pick the first one)
    SELECT id INTO v_farm_id FROM farms LIMIT 1;
    
    IF v_farm_id IS NULL THEN
        RAISE NOTICE 'No farm found. Please create a farm first.';
        RETURN;
    END IF;

    -- 2. Get available house numbers for this farm
    SELECT ARRAY_AGG(house_number) INTO v_house_list 
    FROM farm_houses 
    WHERE farm_id = v_farm_id AND is_active = true;
    
    v_house_count := ARRAY_LENGTH(v_house_list, 1);
    
    IF v_house_count IS NULL THEN
        RAISE NOTICE 'No active houses found. Please add houses first.';
        RETURN;
    END IF;

    -- =============================================
    -- 3. Insert 100 Random Harvest Records
    -- =============================================
    FOR v_i IN 1..100 LOOP
        -- Random House
        v_random_house := v_house_list[1 + floor(random() * v_house_count)::INT];
        
        -- Random Date (Within last 90 days)
        v_random_date := NOW() - (random() * interval '90 days');
        
        INSERT INTO harvest_records (farm_id, house_number, grade, quantity, recorded_at)
        VALUES (
            v_farm_id,
            v_random_house,
            (ARRAY['sang', 'jung', 'ha'])[1 + floor(random() * 3)::INT]::text,  -- Random Grade
            1 + floor(random() * 50)::INT, -- Random Quantity (1-50 boxes)
            v_random_date
        );
    END LOOP;

    -- =============================================
    -- 4. Insert 100 Random Sales Records
    -- =============================================
    FOR v_i IN 1..100 LOOP
        -- Random Date (Within last 90 days)
        v_random_date := NOW() - (random() * interval '90 days');
        
        INSERT INTO sales_records (farm_id, sale_type, quantity, price, customer_name, address, recorded_at)
        VALUES (
            v_farm_id,
            (ARRAY['nonghyup', 'jam', 'etc'])[1 + floor(random() * 3)::INT]::text, -- Random Type
            1 + floor(random() * 100)::INT, -- Random Quantity (1-100)
            (floor(random() * 50) + 1) * 1000, -- Random Price (1000 - 50000)
            (ARRAY['하나로마트', '서울청과', '김철수', '이영희', '박지성', '손흥민'])[1 + floor(random() * 6)::INT], -- Random Customer
            (ARRAY['서울시 강남구', '경기도 성남시', '부산시 해운대구', '대구시 수성구'])[1 + floor(random() * 4)::INT], -- Random Address
            v_random_date
        );
    END LOOP;

    RAISE NOTICE 'Successfully generated 100 Harvest and 100 Sales records.';
END $$;
