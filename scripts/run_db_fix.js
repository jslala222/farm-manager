const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ 에러: NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFix() {
    const sqlPath = path.join(__dirname, 'fix_client_delete_issues.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("🚀 DB 수정을 시작합니다...");

    // Supabase RPC 또는 직접 쿼리 실행 (단, rpc가 설정되어 있어야 함)
    // 여기서는 직접 쿼리를 실행할 수 있는 rpc가 없으므로 간단한 쿼리들로 나누어 실행하거나
    // 서비스 롤 키를 사용하여 직접 제약 조건을 건드리는 것이 어려울 수 있습니다.
    // 하지만 RLS 정책 추가는 가능합니다.

    // 1. RLS 정책 추가
    console.log("1️⃣ RLS 정책 추가 중...");
    const { error: rlsError } = await supabase.rpc('exec_sql', {
        sql_query: `
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'clients' AND policyname = 'Users can delete own clients.'
        ) THEN
            CREATE POLICY "Users can delete own clients." ON public.clients FOR DELETE USING (true);
        END IF;
    END $$;
  ` });

    if (rlsError) {
        console.error("❌ RLS 정책 추가 실패:", rlsError.message);
        console.log("💡 직접 Supabase SQL Editor에서 실행해야 할 수도 있습니다.");
    } else {
        console.log("✅ RLS 정책 추가 성공!");
    }

    // 2. CASCADE 설정
    console.log("2️⃣ 외래키 CASCADE 설정 중...");
    const { error: cascadeError } = await supabase.rpc('exec_sql', {
        sql_query: `
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE constraint_name = 'sales_records_client_id_fkey' 
            AND table_name = 'sales_records'
        ) THEN
            ALTER TABLE public.sales_records DROP CONSTRAINT sales_records_client_id_fkey;
        END IF;
    END $$;
    ALTER TABLE public.sales_records 
    ADD CONSTRAINT sales_records_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES public.clients(id) 
    ON DELETE CASCADE;
  ` });

    if (cascadeError) {
        console.error("❌ CASCADE 설정 실패:", cascadeError.message);
    } else {
        console.log("✅ CASCADE 설정 성공!");
    }
}

// 주의: 'exec_sql' RPC가 데이터베이스에 정의되어 있어야 합니다.
// 만약 없다면 이 스크립트는 작동하지 않습니다. 
// 사장님께 SQL Editor에서 실행하도록 안내하는 것이 가장 확실합니다.

runFix();
