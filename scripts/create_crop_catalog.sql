-- ============================================================
-- 작물/가공품 사진 카탈로그 시스템 (1:N 하이브리드)
-- crop_key: 같은 작물의 여러 사진을 하나의 그룹으로 묶는 키
-- ============================================================

-- 1. crop_catalog 테이블 생성 (신규 설치용 - 기존 테이블 있으면 스킵)
CREATE TABLE IF NOT EXISTS public.crop_catalog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    crop_key TEXT,                   -- 그룹 키 (예: '딸기', '고구마라떼')
    crop_name TEXT NOT NULL,         -- 표시명
    crop_icon TEXT DEFAULT '🌱',
    image_url TEXT NOT NULL,
    category TEXT DEFAULT 'crop' CHECK (category IN ('crop', 'processed')),
    display_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 기존 테이블에 컬럼 추가 (순서 중요: ADD COLUMN → UPDATE → INDEX)
ALTER TABLE public.farm_crops
    ADD COLUMN IF NOT EXISTS crop_image_url TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS image_source TEXT DEFAULT 'emoji'
        CHECK (image_source IN ('emoji', 'catalog', 'custom'));

ALTER TABLE public.crop_catalog
    ADD COLUMN IF NOT EXISTS crop_key TEXT;

-- 3. crop_key 기본값 채우기 (기존 데이터 마이그레이션)
UPDATE public.crop_catalog
    SET crop_key = crop_name
    WHERE crop_key IS NULL;

-- 4. 인덱스 (컬럼 추가 후에 생성)
CREATE INDEX IF NOT EXISTS idx_crop_catalog_crop_key ON public.crop_catalog(crop_key);
CREATE INDEX IF NOT EXISTS idx_crop_catalog_category ON public.crop_catalog(category);
CREATE INDEX IF NOT EXISTS idx_crop_catalog_published ON public.crop_catalog(is_published);
CREATE INDEX IF NOT EXISTS idx_crop_catalog_display_order ON public.crop_catalog(display_order);
CREATE INDEX IF NOT EXISTS idx_farm_crops_image_source ON public.farm_crops(image_source);

-- 5. RLS 활성화
ALTER TABLE public.crop_catalog ENABLE ROW LEVEL SECURITY;

-- 6. RLS 정책: 로그인한 사용자는 공개된 카탈로그 읽기 가능
DROP POLICY IF EXISTS "catalog_read_authenticated" ON public.crop_catalog;
CREATE POLICY "catalog_read_authenticated" ON public.crop_catalog
    FOR SELECT TO authenticated
    USING (is_published = true);

-- 7. RLS 정책: admin 계정만 쓰기 가능
DROP POLICY IF EXISTS "catalog_admin_all" ON public.crop_catalog;
CREATE POLICY "catalog_admin_all" ON public.crop_catalog
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 8. Storage 버킷 생성 (crop-photos, 300KB 제한)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'crop-photos',
    'crop-photos',
    true,
    307200,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 307200,
    public = true;

-- 9. Storage RLS 정책
DROP POLICY IF EXISTS "catalog_images_public_read" ON storage.objects;
CREATE POLICY "catalog_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'crop-photos');

DROP POLICY IF EXISTS "catalog_images_admin_upload" ON storage.objects;
CREATE POLICY "catalog_images_admin_upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'crop-photos'
        AND (
            (
                name LIKE 'catalog/%'
                AND EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role = 'admin'
                )
            )
            OR
            (
                name LIKE 'farms/%'
                AND EXISTS (
                    SELECT 1 FROM public.farms
                    WHERE id::text = split_part(name, '/', 2)
                    AND owner_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "catalog_images_admin_delete" ON storage.objects;
CREATE POLICY "catalog_images_admin_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'crop-photos'
        AND (
            (
                name LIKE 'catalog/%'
                AND EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role = 'admin'
                )
            )
            OR
            (
                name LIKE 'farms/%'
                AND EXISTS (
                    SELECT 1 FROM public.farms
                    WHERE id::text = split_part(name, '/', 2)
                    AND owner_id = auth.uid()
                )
            )
        )
    );
