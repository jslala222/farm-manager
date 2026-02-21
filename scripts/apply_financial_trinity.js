const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../.env.local');
let env = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            env[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ 에러: 환경변수(URL 또는 SERVICE_KEY)를 로드할 수 없습니다.");
    console.log("현재 env 파일 경로:", envPath);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySql() {
    const sqlPath = path.join(__dirname, 'financial_trinity_v21.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("🚀 [Financial Trinity v2.1] SQL 적용을 시작합니다...");

    // SQL을 개별 명령어로 분리 (간단히 처리)
    const commands = sql.split(';').filter(cmd => cmd.trim().length > 0);

    for (let cmd of commands) {
        console.log(`📡 실행 중: ${cmd.trim().substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: cmd.trim() + ';' });

        if (error) {
            console.warn(`⚠️ 경고 (RPC 실패): ${error.message}`);
            console.log("💡 RPC 'exec_sql'이 없거나 권한이 부족할 수 있습니다. 수동 실행이 권장됩니다.");
            break;
        }
    }

    console.log("✅ 작업 종료. 결과가 반영되지 않았다면 Supabase SQL Editor에서 수동 실행해 주세요.");
}

applySql();
