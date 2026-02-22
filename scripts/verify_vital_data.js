const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';
const supabase = createClient(supabaseUrl, supabaseKey);

const vitalFarms = ['관리자 딸기농장', '경준 딸기농장'];

async function verifyFarmData() {
    console.log("🧐 [bkit] 사장님의 실제 농장 데이터 보존 상태를 확인합니다.\n");

    for (const farmName of vitalFarms) {
        console.log(`🔎 '${farmName}' 검색 중...`);

        // 1. farms 테이블 확인
        const { data: farms, error: fError } = await supabase
            .from('farms')
            .select('*')
            .ilike('name', `%${farmName}%`);

        if (farms && farms.length > 0) {
            console.log(`✅ [확인] farms 테이블에 '${farmName}' 데이터가 존재합니다. (ID: ${farms[0].id})`);

            // 2. 해당 농장의 판매 기록 확인
            const { count, error: sError } = await supabase
                .from('sales_records')
                .select('*', { count: 'exact', head: true })
                .eq('farm_id', farms[0].id);

            console.log(`📊 [확인] 해당 농장에 연결된 판매 기록: ${count || 0}건`);
        } else {
            // customers나 partners 테이블에서도 검색 (혹시 이름이 다르게 들어갔을 경우)
            const { count: cCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).ilike('name', `%${farmName}%`);
            const { count: pCount } = await supabase.from('partners').select('*', { count: 'exact', head: true }).ilike('company_name', `%${farmName}%`);

            if (cCount > 0 || pCount > 0) {
                console.log(`✅ [확인] '${farmName}' 데이터가 고객/거래처 목록에 보존되어 있습니다.`);
            } else {
                console.log(`⚠️  [경고] '${farmName}' 관련 데이터를 찾을 수 없습니다!`);
            }
        }
    }
    console.log("\n✨ 농장 데이터 보존 확인 완료.");
}

verifyFarmData();
