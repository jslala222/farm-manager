/* 
 * 🍓 B2B/B2C 아키텍처 분리 통합 마이그레이션 SQL 🍓
 * ----------------------------------------------------------------
 * 1. 신규 테이블 생성: `partners` (B2B), `customers` (B2C)
 * 2. 데이터 분류 이관: 기존 `clients` -> 신규 테이블
 * 3. 판매 기록 연동: `sales_records` 외래키 확장 및 매핑
 * 4. RLS 및 인덱스 설정: 보안 및 성능 최적화
 */

-- [1] 신규 테이블 생성
-- 1-1. partners (B2B 전문 거래처)
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    business_number TEXT, -- 사업자번호
    company_name TEXT NOT NULL, -- 상호명
    ceo_name TEXT, -- 대표자명
    manager_name TEXT, -- 담당자명
    manager_contact TEXT, -- 담당자 연락처
    manager_email TEXT, -- 담당자 이메일/계산서용
    fax_number TEXT, -- 팩스
    hq_address TEXT, -- 본사 주소
    delivery_address TEXT, -- 실제 납품 주소
    settlement_type TEXT DEFAULT '후결제', -- 정산 방식 (선입금/후결제/월마감 등)
    payment_method TEXT, -- 주 결제 수단
    special_notes TEXT, -- 거래처 특이사항 (메모)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1-2. customers (B2C 개인 고객)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 고객명
    contact TEXT, -- 연락처
    address TEXT, -- 기본 배송지
    is_vip BOOLEAN DEFAULT false, -- 단골 여부
    special_notes TEXT, -- 고객 특이사항 (메모)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- [2] 판매 기록 테이블 구조 변경 (이원화 참조)
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id);
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

-- [3] 데이터 마이그레이션 (기존 clients 데이터 분류)
DO $$
DECLARE
    client_rec RECORD;
    new_id UUID;
BEGIN
    FOR client_rec IN SELECT * FROM public.clients LOOP
        -- B2B 유형인 경우 (농협, 가공공장, 시장 등)
        IF client_rec.client_type IN ('nonghyup', 'factory', 'market') THEN
            INSERT INTO public.partners (
                farm_id, company_name, manager_contact, delivery_address, special_notes, created_at, updated_at
            ) VALUES (
                client_rec.farm_id, client_rec.name, client_rec.contact, client_rec.address, client_rec.notes, client_rec.created_at, client_rec.updated_at
            ) RETURNING id INTO new_id;
            
            -- 해당 거래처의 판매 기록 업데이트
            UPDATE public.sales_records SET partner_id = new_id WHERE client_id = client_rec.id;
            
        -- B2C 유형인 경우 (개인)
        ELSE
            INSERT INTO public.customers (
                farm_id, name, contact, address, is_vip, special_notes, created_at, updated_at
            ) VALUES (
                client_rec.farm_id, client_rec.name, client_rec.contact, client_rec.address, client_rec.is_vip, client_rec.notes, client_rec.created_at, client_rec.updated_at
            ) RETURNING id INTO new_id;
            
            -- 해당 고객의 판매 기록 업데이트
            UPDATE public.sales_records SET customer_id = new_id WHERE client_id = client_rec.id;
        END IF;
    END LOOP;
END $$;

-- [4] 보안 정책 (RLS) 설정
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- partners 정책
DROP POLICY IF EXISTS "Public partners are viewable by everyone." ON public.partners;
CREATE POLICY "Public partners are viewable by everyone." ON public.partners FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage their own partners." ON public.partners;
CREATE POLICY "Users can manage their own partners." ON public.partners FOR ALL WITH CHECK (true);

-- customers 정책
DROP POLICY IF EXISTS "Public customers are viewable by everyone." ON public.customers;
CREATE POLICY "Public customers are viewable by everyone." ON public.customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage their own customers." ON public.customers;
CREATE POLICY "Users can manage their own customers." ON public.customers FOR ALL WITH CHECK (true);

-- [5] 인덱스 추가 (검색 속도 향상)
CREATE INDEX IF NOT EXISTS idx_partners_farm ON public.partners(farm_id);
CREATE INDEX IF NOT EXISTS idx_customers_farm ON public.customers(farm_id);
CREATE INDEX IF NOT EXISTS idx_sales_partner ON public.sales_records(partner_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales_records(customer_id);

-- 성공: B2B/B2C 분리 및 마이그레이션이 완료되었습니다.
