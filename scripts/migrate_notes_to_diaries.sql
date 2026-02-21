-- 🍓 기존 수확 메모 -> 현장 일지 테이블 이관 SQL 🍓
-- ----------------------------------------------------------------
-- [1] 기존 harvest_records의 메모를 house_diaries로 복사 (최신본 기준)
INSERT INTO public.house_diaries (farm_id, house_number, date, note)
SELECT DISTINCT ON (farm_id, house_number, recorded_at::date)
    farm_id,
    house_number,
    recorded_at::date as date,
    harvest_note as note
FROM public.harvest_records
WHERE harvest_note IS NOT NULL AND harvest_note != ''
ORDER BY farm_id, house_number, recorded_at::date, recorded_at DESC
ON CONFLICT (farm_id, house_number, date) DO UPDATE
SET note = EXCLUDED.note;

-- [2] 이관 완료 안내
-- 성공적으로 실행되었습니다. 이제 페이지 하단 [일일 현장 일지 요약]에서 확인 가능합니다.
