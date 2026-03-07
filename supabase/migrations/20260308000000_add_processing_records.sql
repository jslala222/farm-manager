-- processing_records 테이블 신설 (가공 처리 이력 완전 추적)
CREATE TABLE IF NOT EXISTS public.processing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    processed_date DATE NOT NULL,
    output_crop_name TEXT NOT NULL,
    output_quantity NUMERIC(10,2) NOT NULL,
    output_unit TEXT NOT NULL DEFAULT '개',
    inputs JSONB NOT NULL DEFAULT '[]',  -- [{crop_name, quantity, unit}]
    memo TEXT,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- inventory_adjustments에 processing_record_id 컬럼 추가 (롤백 추적용)
ALTER TABLE public.inventory_adjustments
ADD COLUMN IF NOT EXISTS processing_record_id UUID REFERENCES public.processing_records(id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_processing_records_farm_id
    ON public.processing_records(farm_id);
CREATE INDEX IF NOT EXISTS idx_processing_records_farm_date
    ON public.processing_records(farm_id, processed_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_adj_processing_id
    ON public.inventory_adjustments(processing_record_id);

-- RLS
ALTER TABLE public.processing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processing_records_owner" ON public.processing_records
FOR ALL
USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()));

CREATE POLICY "processing_records_admin" ON public.processing_records
FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT ALL ON TABLE public.processing_records TO authenticated;
