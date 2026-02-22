const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function thoroughAudit() {
    console.log("🕵️ [bkit] 개별 택배 데이터 정밀 감사...");

    // 1. 현재 모든 고객(Customer) 목록 확인
    const { data: customers, error: cError } = await supabase
        .from('customers')
        .select('id, name, contact');

    console.log(`\n👥 현재 등록된 고객 수: ${customers?.length || 0}명`);
    if (customers && customers.length > 0) {
        console.log("목록:");
        customers.forEach(c => console.log(`- ${c.name} (${c.contact || '연락처 없음'})`));
    }

    // 2. 현재 모든 판매 기록 확인 (필드별 상세)
    const { data: sales, error: sError } = await supabase
        .from('sales_records')
        .select('id, recorded_at, sale_type, delivery_method, customer_id, customer_name');

    console.log(`\n📊 현재 판매 기록 수: ${sales?.length || 0}건`);
    if (sales && sales.length > 0) {
        console.log("상세 유형:");
        sales.forEach(s => {
            console.log(`- [${s.recorded_at.split('T')[0]}] 유형:${s.sale_type}, 배송:${s.delivery_method}, 고객ID:${s.customer_id}, 직접입력명:${s.customer_name}`);
        });
    }

    // 3. 유실 가능성 체크
    console.log("\n⚠️ [유실 가능성 점검]");
    console.log("- '개별택배' 탭에서 보이지 않는다면, `delivery_method`가 'courier'가 아니거나 `sale_type`이 'etc'가 아닐 수 있습니다.");
    console.log("- 삭제 과정에서 '테스트' 등의 키워드가 포함된 고객명이 삭제되었을 수 있습니다.");
}

thoroughAudit();
