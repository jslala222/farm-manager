const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcobiyhdyk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY29iaXloZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg4OTY4ODIsImV4cCI6MjA1NDQ3Mjg4Mn0.R-I5Xf0X9-z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9'; // [bkit] 실제 키 사용 필요 (검열됨)
// 실제 키는 .env.local 에서 가져옵니다.

const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function inspectCourierData() {
    console.log("🔍 [bkit] 개별 택배 주문 데이터 점검 시작...");

    // 1. 전체 판매 기록 수량
    const { count: totalCount } = await supabase.from('sales_records').select('*', { count: 'exact', head: true });
    console.log(`📊 전체 판매 기록 수: ${totalCount}건`);

    // 2. 개별 택배(etc) 수량
    const { data: courierRecords, count: courierCount } = await supabase
        .from('sales_records')
        .select('*, customer:customers(name)')
        .eq('sale_type', 'etc')
        .order('recorded_at', { ascending: false });

    console.log(`📦 개별 택배(etc) 기록 수: ${courierCount}건`);

    if (courierCount > 0) {
        console.log("\n📋 최근 개별 택배 데이터 (최대 10건):");
        courierRecords.slice(0, 10).forEach(r => {
            console.log(`- [${r.recorded_at.split('T')[0]}] 고객: ${r.customer?.name || r.customer_name || '미상'}, 수량: ${r.quantity}박스, 금액: ${r.price}원`);
        });
    } else {
        console.log("⚠️ 개별 택배 데이터가 하나도 없습니다.");
    }

    // 3. 삭제된 데이터 유추 (키워드로 확인)
    const junkKeywords = ['박지성', '서울청과', '손흥민', '이영희', '김철수', '테스트'];
    console.log(`\n🧹 이전에 소거된 키워드 조건: ${junkKeywords.join(', ')}`);
    console.log("💡 위 키워드가 포함된 택배 기록은 삭제되었을 가능성이 큽니다.");
}

inspectCourierData();
