/* 
 * 🍓 판매/거래처 시스템 고도화 통합 SQL 🍓
 * ----------------------------------------------------------------
 * 1. `clients` 테이블 신설: 주요 거래처, 단골, 일회성 고객 통합 관리
 * 2. `sales_records` 구조 변경: `client_id` 연결, 배송 타입, 자재비 등 추가
 * 3. 데이터 마이그레이션: 기존 판매 기록 보존
 * 4. 모의 데이터 생성: '행복한 희라딸기' 농장에 맞춤형 데이터 주입
 */

-- [1] clients 테이블 생성
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact TEXT,
    address TEXT,
    client_type TEXT CHECK (client_type IN ('nonghyup', 'factory', 'individual', 'market')),
    is_vip BOOLEAN DEFAULT false, -- 단골 여부
    default_price INTEGER, -- 이 거래처 전용 단가 (옵션)
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화 및 정책 설정 (공개 허용)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
create policy "Public clients are viewable by everyone." on public.clients for select using (true);
create policy "Users can insert their own clients." on public.clients for insert with check (true);
create policy "Users can update own clients." on public.clients for update using (true);

-- [2] sales_records 테이블 구조 변경
-- 기존 sale_type은 유지하되, client_id와 delivery_method를 추가하여 점진적으로 전환
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS delivery_method TEXT CHECK (delivery_method IN ('direct', 'courier', 'nonghyup'));
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS shipping_cost INTEGER DEFAULT 0; -- 택배비
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS packaging_cost INTEGER DEFAULT 0; -- 포장자재비

-- [3] 모의 데이터 생성 (행복한 희라딸기)
DO $$
DECLARE
    target_farm_id UUID;
BEGIN
    -- '행복한 희라딸기' 또는 활성 농장 ID 찾기
    SELECT id INTO target_farm_id FROM farms WHERE farm_name LIKE '%희라%' OR is_active = true LIMIT 1;

    IF target_farm_id IS NOT NULL THEN
        -- 3-1. 주요 거래처 (10개)
        INSERT INTO clients (farm_id, name, client_type, is_vip, contact) VALUES
        (target_farm_id, '논산농협 공판장', 'nonghyup', true, '041-730-1234'),
        (target_farm_id, '서울 가락시장 청과', 'market', true, '02-3435-1234'),
        (target_farm_id, '딸기사랑 가공공장', 'factory', true, '041-111-2222'),
        (target_farm_id, '행복 주스나라', 'factory', true, '041-333-4444'),
        (target_farm_id, '논산 로컬푸드', 'market', true, '041-555-6666'),
        (target_farm_id, '대전 오정동 농수산', 'market', true, '042-622-7777'),
        (target_farm_id, '세종 싱싱장터', 'market', true, '044-866-9999'),
        (target_farm_id, '쿠팡 프레시 납품', 'market', true, '1577-7011'),
        (target_farm_id, '이마트 에브리데이', 'market', true, '02-380-5678'),
        (target_farm_id, 'GS더프레시 논산점', 'market', true, '041-733-8888');

        -- 3-2. 단골 VIP 고객 (20명)
        INSERT INTO clients (farm_id, name, client_type, is_vip, contact, address)
        SELECT 
            target_farm_id, 
            '단골손님_' || i, 
            'individual', 
            true, 
            '010-1234-' || lpad(i::text, 4, '0'),
            '충남 논산시 단골로 ' || i || '번길'
        FROM generate_series(1, 20) AS i;

        -- 3-3. 택배 일회성 고객 (250명)
        -- 대량 데이터지만 화면에 노출되지 않도록 검색 전용으로 활용
        INSERT INTO clients (farm_id, name, client_type, is_vip, contact, address)
        SELECT 
            target_farm_id, 
            CASE (floor(random() * 5)::int)
                WHEN 0 THEN '김'
                WHEN 1 THEN '이'
                WHEN 2 THEN '박'
                WHEN 3 THEN '최'
                ELSE '정'
            END || '지인_' || i, 
            'individual', 
            false, 
            '010-' || (1000 + i) || '-' || (2000 + i), 
            CASE (floor(random() * 4)::int)
                WHEN 0 THEN '서울시 강남구 역삼동 ' || i || '번지'
                WHEN 1 THEN '경기도 성남시 분당구 ' || i || '번지'
                WHEN 2 THEN '부산시 해운대구 우동 ' || i || '번지'
                ELSE '대전시 유성구 봉명동 ' || i || '번지'
            END
        FROM generate_series(1, 250) AS i;

        RAISE NOTICE '성공: 희라딸기 농장에 거래처 데이터 280건이 생성되었습니다.';
    ELSE
        RAISE NOTICE '경고: 데이터를 넣을 농장을 찾지 못했습니다. 농장을 먼저 등록해주세요.';
    END IF;
END $$;
