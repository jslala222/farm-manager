const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function checkRemainingFarmId() {
    const { data } = await supabase.from('sales_records').select('farm_id, customer_name, sale_type, delivery_method');
    console.log("📍 잔류 판매 기록의 Farm ID 및 유형:");
    data.forEach(d => {
        console.log(`- Farm: ${d.farm_id}, 고객명: ${d.customer_name}, 유형: ${d.sale_type}, 배송: ${d.delivery_method}`);
    });

    const { data: farms } = await supabase.from('farms').select('id, name');
    console.log("\n🚜 농장 목록:");
    farms.forEach(f => console.log(`- ${f.name} (${f.id})`));
}

checkRemainingFarmId();
