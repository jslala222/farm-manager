-- inventory_adjustments 테이블에 grade 컬럼 추가
-- 원물 재고의 등급(상/중/하)별 구분을 위해 사용
-- 가공품은 NULL로 유지
ALTER TABLE public.inventory_adjustments
ADD COLUMN IF NOT EXISTS grade TEXT;

-- 유효값: 'sang' (상), 'jung' (중), 'ha' (하), NULL (가공품 or 등급없음)
-- CHECK 제약은 기존 데이터 호환성을 위해 추가하지 않음
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_grade
ON public.inventory_adjustments(farm_id, crop_name, grade)
WHERE grade IS NOT NULL;
