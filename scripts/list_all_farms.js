const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllFarms() {
    console.log("🧐 [bkit] 현재 데이터베이스에 등록된 모든 농장 목록을 조회합니다.\n");

    const { data: farms, error } = await supabase
        .from('farms')
        .select('id, name, created_at');

    if (error) {
        console.error("❌ farms 테이블 조회 오류:", error.message);
        return;
    }

    if (farms && farms.length > 0) {
        console.log(`✅ 총 ${farms.length}개의 농장이 발견되었습니다:`);
        farms.forEach(f => {
            console.log(`   - [농장]: ${f.name} (ID: ${f.id}, 생성일: ${f.created_at})`);
        });
    } else {
        console.log("⚠️  농장(farms) 테이블이 비어있습니다.");
    }

    // 추가로 customers 테이블에서 '농장' 키워드로 검색
    const { data: customers } = await supabase.from('customers').select('id, name').ilike('name', '%농장%');
    if (customers && customers.length > 0) {
        console.log(`\n✅ customers 테이블에서 '농장' 키워드로 발견된 데이터:`);
        customers.forEach(c => console.log(`   - [고객명]: ${c.name} (ID: ${c.id})`));
    }

    console.log("\n✨ 조회 완료.");
}

listAllFarms();
