const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function listRemainingRecords() {
    console.log("📋 [bkit] 잔류 판매 기록 상세 리스트:");

    const { data, error } = await supabase
        .from('sales_records')
        .select('*, customer:customers(name), partner:partners(company_name)')
        .order('recorded_at', { ascending: false });

    if (error) {
        console.error("❌ 조회 에러:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("⚠️ 기록이 없습니다.");
        return;
    }

    data.forEach((r, idx) => {
        const type = r.sale_type === 'nonghyup' ? '대량(B2B)' : '개별(B2C/etc)';
        const name = r.partner?.company_name || r.customer?.name || r.customer_name || '미상';
        console.log(`${idx + 1}. [${r.recorded_at.split('T')[0]}] [${type}] ${name} | 수량: ${r.quantity} | 비고: ${r.harvest_note || '없음'}`);
    });
}

listRemainingRecords();
