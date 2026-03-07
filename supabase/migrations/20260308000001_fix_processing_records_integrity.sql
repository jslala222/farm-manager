-- 데이터 무결성 개선: FK + UNIQUE 제약 추가

-- 1. farm_crops에 UNIQUE 제약 (같은 팜 내 품목명 중복 불가)
ALTER TABLE public.farm_crops
ADD CONSTRAINT unique_farm_crop_name UNIQUE(farm_id, crop_name);

-- 2. processing_records에 output_crop_id FK 컬럼 추가
ALTER TABLE public.processing_records
ADD COLUMN IF NOT EXISTS output_crop_id UUID REFERENCES public.farm_crops(id) ON DELETE RESTRICT;

-- 3. 기존 마이그레이션된 farm_crops를 processing_records와 연결 (backward compatibility)
-- NOTE: 기존 데이터가 있다면 이 스크립트로 채워야 함
-- UPDATE processing_records pr
-- SET output_crop_id = (
--   SELECT id FROM farm_crops 
--   WHERE farm_id = pr.farm_id AND crop_name = pr.output_crop_name
--   LIMIT 1
-- )
-- WHERE output_crop_id IS NULL AND farm_id IS NOT NULL;

-- 4. 인덱스 추가 (성능 개선)
CREATE INDEX IF NOT EXISTS idx_processing_records_output_crop_id
    ON public.processing_records(output_crop_id);

-- 5. 주석 추가
COMMENT ON COLUMN processing_records.output_crop_id IS 'output_crop_name 참조용 FK (정규화, 데이터 무결성 강화)';
