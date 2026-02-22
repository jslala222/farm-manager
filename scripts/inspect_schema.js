const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log("🧐 [bkit] 데이터베이스 주요 테이블의 데이터 존재 여부를 대조합니다.\n");

    const tables = ['farms', 'partners', 'customers', 'sales_records', 'workers', 'houses'];

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`❌ [${table}]: 조회 실패 (${error.message})`);
        } else {
            console.log(`✅ [${table}]: ${count || 0}건의 데이터가 있습니다.`);

            if (count > 0) {
                const { data } = await supabase.from(table).select('*').limit(5);
                console.log(`   - 샘플 데이터:`, data.map(d => d.name || d.company_name || d.id).join(', '));
            }
        }
    }

    console.log("\n✨ 구조 조사 완료.");
}

inspectSchema();
