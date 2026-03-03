const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// .env.local 파일 읽기
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const envVars = {};
envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        envVars[key.trim()] = valueParts.join('=').trim();
    }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugB2C() {
    console.log('🔍 B2C 쿼리 디버깅\n');

    // 현재 쿼리 시뮬레이션 (finance page와 동일)
    const selectedMonth = '2026-03';
    const cashStartDate = '2026-03-01';
    const cashEndDate = '2026-03-31';

    console.log(`📅 검색 기간: ${selectedMonth}`);
    console.log(`  - cashStartDate: ${cashStartDate}`);
    console.log(`  - cashEndDate: ${cashEndDate}`);
    console.log(`  - recorded_at 범위: ${cashStartDate} ~ ${cashEndDate}T23:59:59\n`);

    // 현재 쿼리와 동일하게 실행
    console.log('1️⃣  현재 B2C 쿼리 (finance page 코드):');
    const { data: b2cCurrent, error: errorCurrent } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, is_settled, recorded_at, settled_at, price, shipping_cost')
        .eq('delivery_method', 'courier')
        .eq('is_settled', true)
        .gte('recorded_at', cashStartDate)
        .lte('recorded_at', `${selectedMonth}-31T23:59:59`)
        .order('recorded_at', { ascending: false });

    console.log(`  결과: ${b2cCurrent?.length || 0}개\n`);
    if (b2cCurrent && b2cCurrent.length > 0) {
        b2cCurrent.forEach(rec => {
            console.log(`  - ${rec.customer_name}: ${rec.price}, recorded=${rec.recorded_at.split('T')[0]}`);
        });
    }

    // 개선된 쿼리 1: is_settled 상관없이
    console.log('\n2️⃣  개선안1: is_settled 조건 제거 (모든 B2C 조회):');
    const { data: b2cNoFilter } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, is_settled, recorded_at, settled_at, price, shipping_cost')
        .eq('delivery_method', 'courier')
        .gte('recorded_at', `${cashStartDate}T00:00:00`)
        .lte('recorded_at', `${cashEndDate}T23:59:59`)
        .order('recorded_at', { ascending: false });

    console.log(`  결과: ${b2cNoFilter?.length || 0}개\n`);
    let totalPrice = 0;
    let totalShip = 0;
    if (b2cNoFilter && b2cNoFilter.length > 0) {
        b2cNoFilter.forEach(rec => {
            totalPrice += rec.price || 0;
            totalShip += rec.shipping_cost || 0;
            console.log(`  - ${rec.customer_name}: ${rec.price}, recorded=${rec.recorded_at.split('T')[0]}, settled=${rec.settled_at || 'NULL'}`);
        });
        console.log(`  합계: ${totalPrice} (배송비: ${totalShip})\n`);
    }

    // 개선된 쿼리 2: settled_at과 recorded_at 모두 체크
    console.log('3️⃣  개선안2: settled_at OR recorded_at 기준');
    const { data: marchRecords1 } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, is_settled, recorded_at, settled_at, price, shipping_cost')
        .eq('delivery_method', 'courier')
        .eq('is_settled', true)
        .gte('settled_at', `${cashStartDate}T00:00:00`)
        .lte('settled_at', `${cashEndDate}T23:59:59`)
        .order('settled_at', { ascending: false });

    console.log(`  (settled_at 기준) 결과: ${marchRecords1?.length || 0}개`);

    // recorded_at 기준으로도 조회
    const { data: marchRecords2 } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, is_settled, recorded_at, settled_at, price, shipping_cost')
        .eq('delivery_method', 'courier')
        .eq('is_settled', true)
        .gte('recorded_at', `${cashStartDate}T00:00:00`)
        .lte('recorded_at', `${cashEndDate}T23:59:59`)
        .order('recorded_at', { ascending: false });

    console.log(`  (recorded_at 기준) 결과: ${marchRecords2?.length || 0}개\n`);

    // 2월 데이터도 확인
    console.log('\n📊 월별 B2C 현황:\n');
    const months = ['2026-02', '2026-03'];
    
    for (const month of months) {
        const monthStart = `${month}-01T00:00:00`;
        const monthEnd = `${month}-28T23:59:59`;  // 2월은 28일
        
        const { data: monthBudget } = await supabase
            .from('sales_records')
            .select('price, shipping_cost, is_settled, recorded_at, settled_at')
            .eq('delivery_method', 'courier')
            .gte('recorded_at', monthStart)
            .lte('recorded_at', monthEnd);

        const total = monthBudget?.reduce((acc, rec) => acc + (rec.price || 0), 0) || 0;
        const ship = monthBudget?.reduce((acc, rec) => acc + (rec.shipping_cost || 0), 0) || 0;
        
        console.log(`${month}: ${monthBudget?.length || 0}개 레코드`);
        console.log(`  매출: ${total}, 배송비: ${ship}`);
    }
}

debugB2C();
