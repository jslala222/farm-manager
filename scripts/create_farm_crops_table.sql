-- =============================================
-- [bkit] 하이브리드 다품종 작물 시스템 마이그레이션
-- 1,000개 농장을 위한 엔터프라이즈 작물 관리
-- =============================================

-- 1. farm_crops 테이블 생성 (농장별 재배 작물 관리)
CREATE TABLE IF NOT EXISTS public.farm_crops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    crop_icon TEXT DEFAULT '🌱',
    default_unit TEXT DEFAULT 'kg',
    available_units TEXT[] DEFAULT ARRAY['kg', '박스'],
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(farm_id, crop_name)
);

-- 2. RLS 정책 (1,000개 농장 보안 격리)
ALTER TABLE public.farm_crops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farm_crops_select" ON public.farm_crops
    FOR SELECT USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "farm_crops_insert" ON public.farm_crops
    FOR INSERT WITH CHECK (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "farm_crops_update" ON public.farm_crops
    FOR UPDATE USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "farm_crops_delete" ON public.farm_crops
    FOR DELETE USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. 권한 부여
GRANT ALL ON TABLE public.farm_crops TO authenticated;

-- 4. 기존 farm_houses.current_crop 데이터를 farm_crops로 자동 이관
-- (중복 제거하여 농장별 고유 작물 목록 생성)
INSERT INTO public.farm_crops (farm_id, crop_name, crop_icon, default_unit, available_units, sort_order)
SELECT DISTINCT ON (fh.farm_id, fh.current_crop)
    fh.farm_id,
    fh.current_crop,
    CASE
        WHEN fh.current_crop = '딸기' THEN '🍓'
        WHEN fh.current_crop = '감자' THEN '🥔'
        WHEN fh.current_crop = '고구마' THEN '🍠'
        WHEN fh.current_crop = '참외' THEN '🍈'
        WHEN fh.current_crop = '메론' THEN '🍈'
        WHEN fh.current_crop = '토마토' THEN '🍅'
        WHEN fh.current_crop = '오이' THEN '🥒'
        WHEN fh.current_crop = '고추' THEN '🌶️'
        WHEN fh.current_crop = '상추' THEN '🥬'
        WHEN fh.current_crop = '배추' THEN '🥬'
        ELSE '🌱'
    END,
    CASE
        WHEN fh.current_crop = '딸기' THEN '박스'
        ELSE 'kg'
    END,
    CASE
        WHEN fh.current_crop = '딸기' THEN ARRAY['박스', 'kg', '다라']
        ELSE ARRAY['kg', '박스', '포대']
    END,
    ROW_NUMBER() OVER (PARTITION BY fh.farm_id ORDER BY fh.house_number)
FROM public.farm_houses fh
WHERE fh.current_crop IS NOT NULL AND fh.current_crop != ''
ON CONFLICT (farm_id, crop_name) DO NOTHING;

-- 5. 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_farm_crops_farm_id ON public.farm_crops(farm_id);
