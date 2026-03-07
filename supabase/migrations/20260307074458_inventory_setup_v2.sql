
ALTER TABLE public.farms
ADD COLUMN IF NOT EXISTS inventory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS inventory_warn_only BOOLEAN NOT NULL DEFAULT TRUE;

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

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_farm_id
ON public.inventory_adjustments(farm_id);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_farm_crop
ON public.inventory_adjustments(farm_id, crop_name);

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
