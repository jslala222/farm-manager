-- =============================================
-- [안3] 가공품 + 기타수입 전용 섹션 마이그레이션
-- farm_crops에 category 컬럼 추가 + other_incomes 테이블 생성
-- =============================================

-- 1. farm_crops 테이블에 category 컬럼 추가
-- 'crop' = 원물 (딸기, 고구마 등), 'processed' = 가공품 (딸기잼, 포도주스 등)
ALTER TABLE public.farm_crops 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'crop' 
CHECK (category IN ('crop', 'processed'));

-- 2. other_incomes 테이블 생성 (기타수입 관리)
CREATE TABLE IF NOT EXISTS public.other_incomes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 0,
    income_type TEXT NOT NULL DEFAULT '기타',
    description TEXT,
    income_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS 정책 설정
ALTER TABLE public.other_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "other_incomes_select" ON public.other_incomes
    FOR SELECT USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "other_incomes_insert" ON public.other_incomes
    FOR INSERT WITH CHECK (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "other_incomes_update" ON public.other_incomes
    FOR UPDATE USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "other_incomes_delete" ON public.other_incomes
    FOR DELETE USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. 권한 부여
GRANT ALL ON TABLE public.other_incomes TO authenticated;

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_other_incomes_farm_id ON public.other_incomes(farm_id);
CREATE INDEX IF NOT EXISTS idx_other_incomes_date ON public.other_incomes(income_date);
CREATE INDEX IF NOT EXISTS idx_farm_crops_category ON public.farm_crops(category);
