const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const HIRA_FARM_ID = 'f88d29aa-c34a-47a5-9e6a-a00c45986cb7';

async function restoreClients() {
    console.log("🩹 [bkit] 'clients' 테이블에서 데이터 복원 시도...");

    // 1. 구 'clients' 테이블 데이터 가져오기 (희라농장 것만)
    const { data: oldClients, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('farm_id', HIRA_FARM_ID);

    if (fetchError) {
        console.error("❌ 구 데이터 가져오기 실패:", fetchError);
        return;
    }

    console.log(`🔍 복원 대상 데이터 발견: ${oldClients.length}건`);

    let restoredCustomers = 0;
    let restoredPartners = 0;

    for (const client of oldClients) {
        // B2B 유형인 경우 (농협, 가공공장, 시장 등) -> partners로 복원
        if (['nonghyup', 'factory', 'market'].includes(client.client_type)) {
            const { error: pError } = await supabase.from('partners').upsert({
                id: client.id, // 원본 ID 유지
                farm_id: client.farm_id,
                company_name: client.name,
                manager_contact: client.contact,
                delivery_address: client.address,
                special_notes: client.notes,
                created_at: client.created_at,
                updated_at: client.updated_at
            });
            if (!pError) restoredPartners++;
        }
        // B2C 유형인 경우 (개인 등) -> customers로 복원
        else {
            const { error: cError } = await supabase.from('customers').upsert({
                id: client.id, // 원본 ID 유지
                farm_id: client.farm_id,
                name: client.name,
                contact: client.contact,
                address: client.address,
                is_vip: client.is_vip,
                special_notes: client.notes,
                created_at: client.created_at,
                updated_at: client.updated_at
            });
            if (!cError) restoredCustomers++;
        }
    }

    console.log(`✅ 복구 완료: 고객 ${restoredCustomers}명, 거래처 ${restoredPartners}곳`);
    console.log("✨ 긴급 데이터 심폐소생술이 성공적으로 완료되었습니다.");
}

restoreClients();
