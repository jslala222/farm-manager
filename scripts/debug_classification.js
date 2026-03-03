const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        envVars[key.trim()] = valueParts.join('=').trim();
    }
});

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function debugClassification() {
    console.log('🔍 B2B vs B2C 분류 검증 (3월)\n');
    console.log('=' .repeat(70));

    // 1. 3월 모든 정산된 거래 조회 (B2C 쿼리 결과)
    console.log('\n1️⃣  3월 B2C 쿼리 결과');
    const { data: b2cQuery } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, sale_type, partner_id, is_settled, price, shipping_cost')
        .eq('delivery_method', 'courier')
        .gte('recorded_at', '2026-03-01T00:00:00')
        .lte('recorded_at', '2026-03-31T23:59:59');

    console.log(`조회: ${b2cQuery?.length || 0}개\n`);
    b2cQuery?.forEach(rec => {
        const isB2B = rec.sale_type === 'b2b' || !!rec.partner_id;
        const isB2C = rec.sale_type === 'b2c' || rec.delivery_method === 'courier';
        console.log(`ID: ${rec.id.slice(0,8)}, 고객: ${rec.customer_name}`);
        console.log(`  sale_type=${rec.sale_type}, partner_id=${rec.partner_id || 'NULL'}`);
        console.log(`  분류: isB2B=${isB2B}, isB2C=${isB2C}`);
        console.log(`  가격=${rec.price}, 배송비=${rec.shipping_cost}\n`);
    });

    // 2. 3월 B2B 쿼리 결과 (B2B가 제대로 나가는지 확인)
    console.log('\n2️⃣  3월 B2B 쿼리 결과');
    const { data: b2bQuery } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, sale_type, partner_id, is_settled, price')
        .eq('sale_type', 'b2b')
        .eq('is_settled', true)
        .gte('settled_at', '2026-03-01')
        .lte('settled_at', '2026-03-31');

    console.log(`조회: ${b2bQuery?.length || 0}개\n`);
    let b2bTotal = 0;
    b2bQuery?.slice(0, 3).forEach(rec => {
        b2bTotal += rec.price || 0;
        console.log(`  ${rec.customer_name || '미지정'}: ${rec.price}원`);
    });
    if (b2bQuery && b2bQuery.length > 3) {
        b2bQuery.slice(3).forEach(rec => {
            b2bTotal += rec.price || 0;
        });
        console.log(`  외 ${b2bQuery.length - 3}개...`);
    }
    console.log(`합계: ${b2bTotal}원\n`);

    // 3. 3월 미정산 데이터
    console.log('3️⃣  3월 미정산 데이터 (is_settled=false)');
    const { data: unsettled } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, sale_type, partner_id, is_settled, price')
        .eq('is_settled', false)
        .gte('recorded_at', '2026-03-01T00:00:00')
        .lte('recorded_at', '2026-03-31T23:59:59');

    console.log(`조회: ${unsettled?.length || 0}개`);
    if (unsettled && unsettled.length > 0) {
        unsettled.forEach(rec => {
            const isB2C = rec.sale_type === 'b2c' || rec.delivery_method === 'courier';
            console.log(`  - ${rec.customer_name}: ${rec.price}원 (B2C=${isB2C})`);
        });
    }

    // 4. 혹시 settled_at이 있는 미정산이 있나?
    console.log('\n4️⃣  이상 데이터 확인: is_settled=false인데 settled_at이 있나?');
    const { data: anomaly } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, sale_type, is_settled, settled_at, price')
        .eq('is_settled', false)
        .not('settled_at', 'is', null)
        .gte('recorded_at', '2026-03-01T00:00:00')
        .lte('recorded_at', '2026-03-31T23:59:59');

    console.log(`조회: ${anomaly?.length || 0}개`);
    if (anomaly && anomaly.length > 0) {
        anomaly.forEach(rec => {
            console.log(`  ⚠️  ${rec.customer_name}: is_settled=false인데 settled_at=${rec.settled_at}`);
        });
    } else {
        console.log('  정상: 없음');
    }

    // 5. 총합 계산
    console.log('\n5️⃣  3월 전체 총합');
    console.log('-'.repeat(70));
    const b2cTotal = b2cQuery?.reduce((acc, rec) => acc + (rec.price || 0), 0) || 0;
    console.log(`B2B (settled_at 기준): ${b2bTotal}원`);
    console.log(`B2C (recorded_at 기준): ${b2cTotal}원`);
    console.log(`총매출: ${b2bTotal + b2cTotal}원`);
    console.log(`\n화면 표시: 7,443,500원`);
    console.log(`예상: 7,471,000원 (+ 27,500 차이?)`);
}

debugClassification();
