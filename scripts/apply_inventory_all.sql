-- ============================================================
-- 재고관리 기능 활성화를 위한 통합 마이그레이션 SQL
-- Supabase SQL Editor에서 전체 복사 후 실행하세요.
-- ============================================================

-- 1. farms 테이블에 재고관리 컬럼 추가
ALTER TABLE public.farms
ADD COLUMN IF NOT EXISTS inventory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS inventory_warn_only BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. farm_crops 테이블에 category 컬럼 추가
ALTER TABLE public.farm_crops
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'crop'
CHECK (category IN ('crop', 'processed'));

-- 기존 데이터 기본값 설정
UPDATE public.farm_crops
SET category = 'crop'
WHERE category IS NULL;

-- 3. farm_crops 테이블에 is_temporary 컬럼 추가
ALTER TABLE public.farm_crops
ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.farm_crops
SET is_temporary = FALSE
WHERE is_temporary IS DISTINCT FROM FALSE;

-- 4. inventory_adjustments 테이블 생성
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    adjustment_type TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    reason TEXT,
    adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_farm_id
ON public.inventory_adjustments(farm_id);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_farm_crop
ON public.inventory_adjustments(farm_id, crop_name);

CREATE INDEX IF NOT EXISTS idx_farm_crops_category
ON public.farm_crops(category);

-- 5. RLS 설정
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='inventory_adjustments'
      AND policyname='inventory_adjustments_owner'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "inventory_adjustments_owner" ON public.inventory_adjustments
      FOR ALL
      USING (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
      )
      WITH CHECK (
        farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid())
      )
    $pol$;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public'
        AND tablename='inventory_adjustments'
        AND policyname='inventory_adjustments_admin'
    ) THEN
      EXECUTE $pol$
        CREATE POLICY "inventory_adjustments_admin" ON public.inventory_adjustments
        FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
      $pol$;
    END IF;
  END IF;
END $$;

GRANT ALL ON TABLE public.inventory_adjustments TO authenticated;

-- 6. 적용 확인 (아래 쿼리 결과로 성공 여부 확인)
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='farms' AND column_name='inventory_enabled') AS farms_inventory_enabled,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='farm_crops' AND column_name='category') AS farm_crops_category,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='farm_crops' AND column_name='is_temporary') AS farm_crops_is_temporary,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='inventory_adjustments') AS inventory_adjustments_table;
-- 모든 값이 1 이면 적용 성공
