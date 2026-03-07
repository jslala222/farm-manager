-- ============================================================
-- 수확 관리 시스템 (Harvest Management System)
-- 목적: 수확 → 선별 → 재고 반영 전체 흐름 추적
-- ============================================================

-- 1. 수확 기본 테이블
CREATE TABLE IF NOT EXISTS public.harvests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    harvest_date DATE NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    unit TEXT NOT NULL,
    memo TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_harvests_farm_id ON public.harvests(farm_id);
CREATE INDEX IF NOT EXISTS idx_harvests_harvest_date ON public.harvests(harvest_date);
CREATE INDEX IF NOT EXISTS idx_harvests_farm_date ON public.harvests(farm_id, harvest_date);

-- RLS
ALTER TABLE public.harvests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='harvests' AND policyname='harvests_owner'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "harvests_owner" ON public.harvests
      FOR ALL
      USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
      WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
    $pol$;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='harvests' AND policyname='harvests_admin'
    ) THEN
      EXECUTE $pol$
        CREATE POLICY "harvests_admin" ON public.harvests
        FOR ALL
        USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
        WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
      $pol$;
    END IF;
  END IF;
END $$;

GRANT ALL ON TABLE public.harvests TO authenticated;

-- ============================================================
-- 2. 선별/검수 이력 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.harvest_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    harvest_id UUID NOT NULL REFERENCES public.harvests(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    
    -- 선별 결과 분류
    grade TEXT NOT NULL CHECK (grade IN (
        'normal',        -- 정상 (등급 1)
        'downgrade',     -- 등급 하락 (등급 2, 선별용)
        'processing',    -- 가공용 (손상, 변형)
        'discard'        -- 폐기 (완전 손상)
    )),
    
    -- 선별된 수량
    quantity NUMERIC(10,2) NOT NULL,
    unit TEXT NOT NULL,
    
    -- 추가 처리 정보
    processing_type TEXT CHECK (processing_type IN (
        'direct_storage',      -- 직접 저장 (정상)
        'downgrade_storage',   -- 등급 하락 저장
        'mark_for_processing', -- 가공 표시
        'mark_for_discard'     -- 폐기 표시
    )),
    
    -- 추적 정보
    warehouse_location TEXT,  -- 창고 위치 (예: A-01-05)
    inspector_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    inspection_memo TEXT,
    
    -- 감사 추적
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_harvest_inspections_harvest_id 
    ON public.harvest_inspections(harvest_id);
CREATE INDEX IF NOT EXISTS idx_harvest_inspections_farm_id 
    ON public.harvest_inspections(farm_id);
CREATE INDEX IF NOT EXISTS idx_harvest_inspections_grade 
    ON public.harvest_inspections(grade);

-- RLS
ALTER TABLE public.harvest_inspections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='harvest_inspections' AND policyname='harvest_inspections_owner'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "harvest_inspections_owner" ON public.harvest_inspections
      FOR ALL
      USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
      WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
    $pol$;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='harvest_inspections' AND policyname='harvest_inspections_admin'
    ) THEN
      EXECUTE $pol$
        CREATE POLICY "harvest_inspections_admin" ON public.harvest_inspections
        FOR ALL
        USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
        WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
      $pol$;
    END IF;
  END IF;
END $$;

GRANT ALL ON TABLE public.harvest_inspections TO authenticated;

-- ============================================================
-- 3. 데이터 무결성: 선별 수량 = 수확 수량
-- ============================================================

CREATE OR REPLACE FUNCTION check_harvest_inspection_total()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC(10,2);
    v_harvest_qty NUMERIC(10,2);
BEGIN
    -- 해당 수확의 모든 선별 수량 합계
    SELECT COALESCE(SUM(quantity), 0) INTO v_total
    FROM public.harvest_inspections
    WHERE harvest_id = NEW.harvest_id;
    
    -- 원본 수확 수량
    SELECT quantity INTO v_harvest_qty
    FROM public.harvests
    WHERE id = NEW.harvest_id;
    
    -- 검증: 선별 수량 합 <= 원본 수확 수량
    IF v_total > v_harvest_qty THEN
        RAISE EXCEPTION '선별 수량(%) 은 수확 수량(%)을 초과할 수 없습니다', v_total, v_harvest_qty;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거
DROP TRIGGER IF EXISTS harvest_inspection_total_check ON public.harvest_inspections;
CREATE TRIGGER harvest_inspection_total_check
    BEFORE INSERT OR UPDATE ON public.harvest_inspections
    FOR EACH ROW
    EXECUTE FUNCTION check_harvest_inspection_total();

-- ============================================================
-- 4. 유틸리티 함수: 선별 진행률 조회
-- ============================================================

CREATE OR REPLACE FUNCTION get_harvest_inspection_summary(p_harvest_id UUID)
RETURNS TABLE (
    total_quantity NUMERIC,
    normal_quantity NUMERIC,
    downgrade_quantity NUMERIC,
    processing_quantity NUMERIC,
    discard_quantity NUMERIC,
    inspected_quantity NUMERIC,
    pending_quantity NUMERIC,
    completion_pct NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.quantity,
        COALESCE(SUM(CASE WHEN hi.grade = 'normal' THEN hi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN hi.grade = 'downgrade' THEN hi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN hi.grade = 'processing' THEN hi.quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN hi.grade = 'discard' THEN hi.quantity ELSE 0 END), 0),
        COALESCE(SUM(hi.quantity), 0),
        h.quantity - COALESCE(SUM(hi.quantity), 0),
        ROUND(100.0 * COALESCE(SUM(hi.quantity), 0) / h.quantity, 1)
    FROM public.harvests h
    LEFT JOIN public.harvest_inspections hi ON h.id = hi.harvest_id
    WHERE h.id = p_harvest_id
    GROUP BY h.quantity;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. 트리거: 선별 완료 시 자동으로 재고 조정 기록
-- ============================================================

CREATE OR REPLACE FUNCTION create_inventory_adjustment_on_inspection()
RETURNS TRIGGER AS $$
DECLARE
    v_adjustment_type TEXT;
BEGIN
    -- grade에 따라 adjustment_type 결정
    v_adjustment_type := CASE NEW.grade
        WHEN 'normal' THEN 'harvest_normal'
        WHEN 'downgrade' THEN 'harvest_downgrade'
        WHEN 'processing' THEN 'harvest_for_processing'
        WHEN 'discard' THEN 'harvest_discard'
    END;
    
    -- inventory_adjustments에 기록
    INSERT INTO public.inventory_adjustments (
        farm_id,
        crop_name,
        adjustment_type,
        quantity,
        reason,
        adjusted_at
    ) VALUES (
        NEW.farm_id,
        (SELECT crop_name FROM public.harvests WHERE id = NEW.harvest_id),
        v_adjustment_type,
        NEW.quantity,
        '선별 완료: ' || NEW.grade || (CASE 
            WHEN NEW.warehouse_location IS NOT NULL THEN ' (위치: ' || NEW.warehouse_location || ')'
            ELSE ''
        END),
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거
DROP TRIGGER IF EXISTS auto_inventory_on_inspection ON public.harvest_inspections;
CREATE TRIGGER auto_inventory_on_inspection
    AFTER INSERT ON public.harvest_inspections
    FOR EACH ROW
    EXECUTE FUNCTION create_inventory_adjustment_on_inspection();

-- ============================================================
-- 6. 뷰: 수확 현황 대시보드
-- ============================================================

CREATE OR REPLACE VIEW harvest_dashboard AS
SELECT
    h.id as harvest_id,
    h.farm_id,
    h.crop_name,
    h.harvest_date,
    h.quantity as total_quantity,
    h.unit,
    h.memo,
    h.created_at,
    COALESCE(summary.inspected_quantity, 0) as inspected_quantity,
    h.quantity - COALESCE(summary.inspected_quantity, 0) as pending_quantity,
    COALESCE(summary.completion_pct, 0) as completion_pct,
    COALESCE(summary.normal_quantity, 0) as normal_quantity,
    COALESCE(summary.downgrade_quantity, 0) as downgrade_quantity,
    COALESCE(summary.processing_quantity, 0) as processing_quantity,
    COALESCE(summary.discard_quantity, 0) as discard_quantity
FROM public.harvests h
LEFT JOIN LATERAL get_harvest_inspection_summary(h.id) summary ON true;

GRANT SELECT ON harvest_dashboard TO authenticated;
