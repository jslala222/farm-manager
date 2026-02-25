-- sale_type CHECK 제약 조건 정리
-- 기존: ('nonghyup', 'jam', 'etc') → 신규: ('b2b', 'b2c', 'etc')

-- 1. 기존 제약 조건 먼저 제거 (제약 있는 상태에서 UPDATE 불가)
ALTER TABLE sales_records
DROP CONSTRAINT sales_records_sale_type_check;

-- 2. 기존 데이터 마이그레이션
UPDATE sales_records SET sale_type = 'b2b' WHERE sale_type = 'nonghyup';
UPDATE sales_records SET sale_type = 'etc' WHERE sale_type = 'jam';

-- 3. 새 제약 조건 적용
ALTER TABLE sales_records
ADD CONSTRAINT sales_records_sale_type_check
CHECK (sale_type IN ('b2b', 'b2c', 'etc'));
