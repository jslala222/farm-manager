-- =============================================
-- [bkit] 경준싱싱농장 작물 정리
-- 취급 품목: 딸기, 고구마, 감자, 샤인머스캣 (4개만 유지)
-- 나머지 전부 삭제
-- =============================================

-- 1. 우리 농장이 취급하지 않는 작물 삭제
DELETE FROM public.farm_crops
WHERE crop_name NOT IN ('딸기', '고구마', '감자', '샤인머스캣');

-- 2. 아이콘 및 단위 확실하게 세팅
UPDATE public.farm_crops SET crop_icon = '🍓', default_unit = '박스', available_units = ARRAY['박스', 'kg', '다라'], sort_order = 0 WHERE crop_name = '딸기';
UPDATE public.farm_crops SET crop_icon = '�', default_unit = 'kg', available_units = ARRAY['kg', '박스', '포대'], sort_order = 1 WHERE crop_name = '고구마';
UPDATE public.farm_crops SET crop_icon = '🥔', default_unit = 'kg', available_units = ARRAY['kg', '박스', '포대'], sort_order = 2 WHERE crop_name = '감자';
UPDATE public.farm_crops SET crop_icon = '🍇', default_unit = 'kg', available_units = ARRAY['kg', '박스', '송이'], sort_order = 3 WHERE crop_name = '샤인머스캣';

-- 3. 하우스 동 작물 지정 정리 (사장님 말씀대로)
UPDATE public.farm_houses SET current_crop = '딸기' WHERE house_number IN (1, 2, 3);
UPDATE public.farm_houses SET current_crop = '고구마' WHERE house_number = 6;
UPDATE public.farm_houses SET current_crop = '감자' WHERE house_number = 7;
UPDATE public.farm_houses SET current_crop = '샤인머스캣' WHERE house_number = 8;

-- 4. 결과 확인
SELECT '=== 작물 목록 ===' AS section;
SELECT crop_name, crop_icon, default_unit, array_to_string(available_units, ', ') AS units, sort_order
FROM public.farm_crops ORDER BY sort_order;

SELECT '=== 하우스 배치 ===' AS section;
SELECT house_number AS 동, current_crop AS 작물, is_active AS 활성
FROM public.farm_houses ORDER BY house_number;
