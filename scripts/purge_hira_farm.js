const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const HIRA_FARM_ID = 'f88d29aa-c34a-47a5-9e6a-a00c45986cb7';

async function purgeHiraFarmData() {
    console.log(`🧹 [bkit] '행복한 희라딸기' (${HIRA_FARM_ID}) 데이터 소거 시작...`);

    const tables = ['sales_records', 'harvest_records', 'house_diaries', 'customers'];

    for (const table of tables) {
        console.log(`- ${table} 삭제 시도...`);
        const { error, count } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .eq('farm_id', HIRA_FARM_ID);

        if (error) {
            console.error(`❌ ${table} 삭제 실패:`, error);
        } else {
            console.log(`✅ ${table} 삭제 완료: ${count || 0}건`);
        }
    }

    console.log("\n✨ 소거 작업이 완료되었습니다.");
}

purgeHiraFarmData();
