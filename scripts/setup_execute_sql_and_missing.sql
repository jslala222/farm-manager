-- ============================================================
-- [1단계] Supabase Dashboard > SQL Editor에서 먼저 이것만 실행
-- execute_sql 함수가 생성되면, 이후 마이그레이션은 스크립트로 자동 실행됩니다.
-- ============================================================

CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  EXECUTE sql_query;
  RETURN json_build_object('status', 'success');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;

-- ============================================================
-- [2단계] 위 실행 후 터미널에서:
--   cd farm-manager/supabase-mcp
--   node run-inventory-migration.js
-- ============================================================

-- ============================================================
-- 또는 지금 당장 is_temporary 컬럼 하나만 추가하려면:
-- ============================================================

ALTER TABLE public.farm_crops
ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT FALSE;
