const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function checkAllFarmsAndSales() {
    console.log("🕵️ [bkit] 농장 및 판매 기록 전수 대조 감사...");

    // 1. 모든 농장 목록
    const { data: farms } = await supabase.from('farms').select('*');
    console.log("\n🚜 [농장 목록]");
    farms?.forEach(f => console.log(`- ${f.name} (ID: ${f.id})`));

    // 2. 관리자/경준 농장의 판매 기록 개수 확인
    const farmIdsToKeep = [
        '8791c53b-e0ac-4b68-b3d9-953bb47401d7', // 관리자 딸기농장
        '9ac2b34e-000c-45a7-8cd2-54075677051b'  // 경준 딸기농장
    ];

    for (const fid of farmIdsToKeep) {
        const { count } = await supabase
            .from('sales_records')
            .select('*', { count: 'exact', head: true })
            .eq('farm_id', fid);
        const name = farms?.find(f => f.id === fid)?.name || '알 수 없는 농장';
        console.log(`\n📍 ${name} (${fid})의 판매 기록: ${count || 0}건`);
    }

    // 3. 기록이 남아있는 농장 조회
    const { data: remainingSales } = await supabase.from('sales_records').select('farm_id');
    const remainingFarmIds = [...new Set(remainingSales?.map(s => s.farm_id))];
    console.log("\n📊 현재 판매 기록이 남아있는 농장 ID들:");
    remainingFarmIds.forEach(id => {
        const name = farms?.find(f => f.id === id)?.name || '이름 없음';
        console.log(`- ${name} (${id})`);
    });
}

checkAllFarmsAndSales();
