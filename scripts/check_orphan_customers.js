const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function checkOrphanCustomers() {
    console.log("🕵️ [bkit] 고객-주문 연결 상태 전수 조사...");

    // 1. 모든 고객 ID 가져오기
    const { data: customers } = await supabase.from('customers').select('id, name');
    const customerIds = customers.map(c => c.id);

    // 2. 이 고객들이 가진 주문 수 집계
    const { data: salesCounts, error } = await supabase
        .from('sales_records')
        .select('customer_id');

    if (error) {
        console.error("❌ 에러:", error);
        return;
    }

    const countMap = {};
    salesCounts.forEach(s => {
        if (s.customer_id) {
            countMap[s.customer_id] = (countMap[s.customer_id] || 0) + 1;
        }
    });

    console.log(`\n👥 전체 고객 ${customers.length}명 중 주문이 있는 고객:`);
    let orderCount = 0;
    customers.forEach(c => {
        if (countMap[c.id]) {
            console.log(`- ${c.name}: ${countMap[c.id]}건`);
            orderCount++;
        }
    });

    if (orderCount === 0) {
        console.log("⚠️ 주문이 연결된 고객이 단 한 명도 없습니다.");
    }

    // 3. 주문은 있지만 고객이 없는 경우 (직접 입력 등)
    const directSales = salesCounts.filter(s => !s.customer_id).length;
    console.log(`\n📝 고객 연결 없이 직접 입력된 주문: ${directSales}건`);
}

checkOrphanCustomers();
