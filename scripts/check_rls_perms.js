const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function checkRLS() {
    console.log("🔍 [bkit] 'farms' 테이블 RLS 정책 정밀 스캔 중...");

    // exec_sql 대신 프로파일 정보를 통해 권한 추론
    const { data: farms, error } = await supabase.from('farms').select('id, owner_id, farm_name');
    console.log("현재 등록된 농장 목록 및 소유자 ID:");
    console.log(JSON.stringify(farms, null, 2));

    const { data: profiles } = await supabase.from('profiles').select('*');
    console.log("\n전체 사용자 프로필 (역할 확인용):");
    console.log(JSON.stringify(profiles, null, 2));
}

checkRLS();
