-- ============================================
-- 일일 인력 현황 테이블 (알바/용역 지급 내역)
-- ============================================

CREATE TABLE IF NOT EXISTS public.labor_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- 출처: 인력사무소 or 개별직접
    source TEXT NOT NULL DEFAULT '인력사무소' CHECK (source IN ('인력사무소', '개별직접')),
    agency_name TEXT,                    -- 사무소명 (인력사무소인 경우)

    -- 인력 구성
    grade TEXT NOT NULL DEFAULT '중급',  -- 오야지/상급/중급/하급/기타
    headcount INTEGER NOT NULL DEFAULT 1,
    daily_wage INTEGER NOT NULL DEFAULT 0,
    tip INTEGER DEFAULT 0,              -- 팁/추가지급

    -- 지급
    payment_method TEXT NOT NULL DEFAULT '현금' CHECK (payment_method IN ('현금', '계좌이체', '카드')),

    -- 작업 정보
    work_type TEXT,                      -- 딸기수확/시설관리/농약살포 등
    notes TEXT,

    -- 지출 연동
    expenditure_id UUID REFERENCES public.expenditures(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.labor_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labor_costs_all" ON public.labor_costs
    FOR ALL USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

GRANT ALL ON TABLE public.labor_costs TO authenticated;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_labor_costs_farm_date ON public.labor_costs(farm_id, work_date);
CREATE INDEX IF NOT EXISTS idx_labor_costs_expenditure ON public.labor_costs(expenditure_id);
