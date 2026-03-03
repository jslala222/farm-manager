-- [안3] 가공품 규격 관리 시스템
-- 실행: Supabase Dashboard → SQL Editor

-- 1. farm_crops에 available_specs 컬럼 추가 (규격 목록: ['350g', '1kg'] 등)
ALTER TABLE farm_crops 
ADD COLUMN IF NOT EXISTS available_specs text[] DEFAULT ARRAY[]::text[];

-- 2. sales_records에 product_spec 컬럼 추가 (판매 시 선택한 규격: '350g')
ALTER TABLE sales_records 
ADD COLUMN IF NOT EXISTS product_spec text DEFAULT NULL;

-- 3. (선택) execute_sql RPC 함수 생성 - 향후 MCP 서버에서 DDL 실행 가능
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS JSON AS $$
DECLARE 
  result JSON;
BEGIN
  EXECUTE sql_query;
  RETURN json_build_object('status', 'success');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'farm_crops' AND column_name = 'available_specs';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_records' AND column_name = 'product_spec';
