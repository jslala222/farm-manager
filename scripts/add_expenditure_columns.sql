-- 지출 분류 고도화를 위한 컬럼 추가 및 마이그레이션
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS main_category TEXT DEFAULT '농작관리';
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- 기존 category 데이터를 sub_category로 이동 및 대분류 매핑
UPDATE expenditures 
SET 
  sub_category = category,
  main_category = CASE 
    WHEN category IN ('자재/비료', '공과금(전기/물)', '유류비') THEN '농작관리'
    WHEN category = '인건비' THEN '인건비'
    ELSE '농작관리'
  END;
