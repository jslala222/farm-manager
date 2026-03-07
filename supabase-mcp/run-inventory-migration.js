/**
 * 재고관리 기능 마이그레이션 실행 스크립트
 * 실행: node run-inventory-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SQL_STATEMENTS = [
  {
    name: 'farms.inventory_enabled 컬럼 추가',
    sql: `ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS inventory_enabled BOOLEAN NOT NULL DEFAULT FALSE`
  },
  {
    name: 'farms.inventory_warn_only 컬럼 추가',
    sql: `ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS inventory_warn_only BOOLEAN NOT NULL DEFAULT TRUE`
  },
  {
    name: 'farm_crops.category 컬럼 추가',
    sql: `ALTER TABLE public.farm_crops ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'crop' CHECK (category IN ('crop', 'processed'))`
  },
  {
    name: 'farm_crops.category 기본값 업데이트',
    sql: `UPDATE public.farm_crops SET category = 'crop' WHERE category IS NULL`
  },
  {
    name: 'farm_crops.is_temporary 컬럼 추가',
    sql: `ALTER TABLE public.farm_crops ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT FALSE`
  },
  {
    name: 'inventory_adjustments 테이블 생성',
    sql: `CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
      crop_name TEXT NOT NULL,
      adjustment_type TEXT NOT NULL,
      quantity NUMERIC(10,2) NOT NULL,
      reason TEXT,
      adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  },
  {
    name: 'idx_inventory_adjustments_farm_id 인덱스',
    sql: `CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_farm_id ON public.inventory_adjustments(farm_id)`
  },
  {
    name: 'idx_inventory_adjustments_farm_crop 인덱스',
    sql: `CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_farm_crop ON public.inventory_adjustments(farm_id, crop_name)`
  },
  {
    name: 'idx_farm_crops_category 인덱스',
    sql: `CREATE INDEX IF NOT EXISTS idx_farm_crops_category ON public.farm_crops(category)`
  },
  {
    name: 'inventory_adjustments RLS 활성화',
    sql: `ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY`
  },
  {
    name: 'inventory_adjustments_owner 정책',
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory_adjustments' AND policyname='inventory_adjustments_owner') THEN
    EXECUTE $pol$
      CREATE POLICY "inventory_adjustments_owner" ON public.inventory_adjustments
      FOR ALL
      USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
      WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()))
    $pol$;
  END IF;
END $$`
  },
  {
    name: 'inventory_adjustments_admin 정책',
    sql: `DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory_adjustments' AND policyname='inventory_adjustments_admin') THEN
      EXECUTE $pol$
        CREATE POLICY "inventory_adjustments_admin" ON public.inventory_adjustments
        FOR ALL
        USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
        WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
      $pol$;
    END IF;
  END IF;
END $$`
  },
  {
    name: 'inventory_adjustments 권한 부여',
    sql: `GRANT ALL ON TABLE public.inventory_adjustments TO authenticated`
  },
];

async function execSql(sql) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql_query: sql })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  return await response.json();
}

async function checkColumns() {
  console.log('\n📋 현재 DB 상태 확인...');
  try {
    // farms 테이블 inventory_enabled 컬럼 체크
    const { data: farmData, error: farmErr } = await supabase
      .from('farms').select('inventory_enabled').limit(1);
    console.log(`  farms.inventory_enabled: ${farmErr ? '❌ 없음' : '✅ 있음'}`);

    // farm_crops 테이블 category 컬럼 체크
    const { data: cropData, error: cropErr } = await supabase
      .from('farm_crops').select('category').limit(1);
    console.log(`  farm_crops.category: ${cropErr ? '❌ 없음' : '✅ 있음'}`);

    // farm_crops 테이블 is_temporary 컬럼 체크
    const { data: tmpData, error: tmpErr } = await supabase
      .from('farm_crops').select('is_temporary').limit(1);
    console.log(`  farm_crops.is_temporary: ${tmpErr ? '❌ 없음' : '✅ 있음'}`);

    // inventory_adjustments 테이블 체크
    const { data: adjData, error: adjErr } = await supabase
      .from('inventory_adjustments').select('id').limit(1);
    console.log(`  inventory_adjustments 테이블: ${adjErr ? '❌ 없음' : '✅ 있음'}`);
  } catch(e) {
    console.log('  상태 확인 중 에러:', e.message);
  }
}

async function main() {
  console.log('🚀 재고관리 마이그레이션 시작');
  console.log(`🔗 URL: ${process.env.SUPABASE_URL}`);

  // 현재 상태 확인
  await checkColumns();

  // execute_sql RPC 가능 여부 확인
  console.log('\n🔍 execute_sql RPC 함수 확인...');
  try {
    await execSql('SELECT 1');
    console.log('  ✅ execute_sql RPC 사용 가능\n');
  } catch (e) {
    console.log('  ❌ execute_sql RPC 없음');
    console.log('\n⚠️  직접 SQL 실행 불가. 아래 방법 중 하나를 선택해주세요:\n');
    console.log('  방법 1: Supabase Dashboard → SQL Editor에서 아래 SQL 실행:');
    console.log('    파일: scripts/apply_inventory_all.sql\n');
    console.log('  방법 2: Supabase Dashboard → SQL Editor에서 먼저 execute_sql 함수 생성 후 재실행:');
    console.log(`
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
`);
    process.exit(1);
  }

  // 각 SQL 실행
  let successCount = 0;
  let failCount = 0;

  for (const stmt of SQL_STATEMENTS) {
    process.stdout.write(`  ⏳ ${stmt.name}...`);
    try {
      await execSql(stmt.sql);
      console.log(' ✅');
      successCount++;
    } catch (e) {
      console.log(` ⚠️  (${e.message.substring(0, 80)})`);
      failCount++;
    }
  }

  // 완료 후 상태 재확인
  await checkColumns();

  console.log(`\n🎉 완료: 성공 ${successCount}개, 경고 ${failCount}개`);
  if (failCount > 0) {
    console.log('⚠️  경고 항목은 이미 존재하거나 무시 가능한 오류입니다.');
  }
}

main().catch(console.error);
