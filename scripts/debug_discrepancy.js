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

async function debugB2CDiscrepancy() {
    console.log('🔍 3월 B2C 데이터 불일치 원인 분석\n');
    console.log('=' .repeat(70));

    // 1. 현재 쿼리와 동일하게 3월 B2C 조회
    console.log('\n1️⃣  현재 쿼리 결과 (delivery_method="courier")');
    const { data: b2cCourier } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, sale_type, recorded_at, settled_at, is_settled, price, shipping_cost, packaging_cost')
        .eq('delivery_method', 'courier')
        .gte('recorded_at', '2026-03-01T00:00:00')
        .lte('recorded_at', '2026-03-31T23:59:59');

    console.log(`결과: ${b2cCourier?.length || 0}개\n`);
    let totalPrice1 = 0;
    let totalShip1 = 0;
    b2cCourier?.forEach(rec => {
        totalPrice1 += rec.price || 0;
        totalShip1 += rec.shipping_cost || 0;
        console.log(`  - ${rec.customer_name || '미지정'}: price=${rec.price}, shipping=${rec.shipping_cost}, packaging=${rec.packaging_cost}`);
    });
    console.log(`합계: 매출=${totalPrice1}, 배송비=${totalShip1}\n`);

    // 2. sale_type='b2c'인 데이터
    console.log('2️⃣  sale_type="b2c"인 데이터 (3월)');
    const { data: b2cSaleType } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, sale_type, recorded_at, settled_at, is_settled, price, shipping_cost, packaging_cost')
        .eq('sale_type', 'b2c')
        .gte('recorded_at', '2026-03-01T00:00:00')
        .lte('recorded_at', '2026-03-31T23:59:59');

    console.log(`결과: ${b2cSaleType?.length || 0}개\n`);
    let totalPrice2 = 0;
    let totalShip2 = 0;
    b2cSaleType?.forEach(rec => {
        totalPrice2 += rec.price || 0;
        totalShip2 += rec.shipping_cost || 0;
        console.log(`  - ${rec.customer_name || '미지정'}: price=${rec.price}, delivery_method=${rec.delivery_method}`);
    });
    console.log(`합계: 매출=${totalPrice2}, 배송비=${totalShip2}\n`);

    // 3. 미정산 B2C 데이터
    console.log('3️⃣  미정산 B2C 데이터 (is_settled=false)');
    const { data: unsettledB2C } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, sale_type, recorded_at, is_settled, price, shipping_cost')
        .eq('delivery_method', 'courier')
        .eq('is_settled', false)
        .gte('recorded_at', '2026-03-01T00:00:00')
        .lte('recorded_at', '2026-03-31T23:59:59');

    console.log(`결과: ${unsettledB2C?.length || 0}개\n`);
    if (unsettledB2C && unsettledB2C.length > 0) {
        unsettledB2C.forEach(rec => {
            console.log(`  - ${rec.customer_name || '미지정'}: ${rec.price}원, settled=${rec.is_settled}`);
        });
    }

    // 4. 화면에 보이는 수치 분석
    console.log('\n4️⃣  화면 표시 수치 vs 실제 데이터');
    console.log('-'.repeat(70));
    console.log(`화면: B2C=43,500원, 택배비=15,500원`);
    console.log(`실제 (courierㅗ): B2C=${totalPrice1}원, 택배비=${totalShip1}원`);
    console.log(`합 (courier+sale_type): B2C=${totalPrice1 + totalPrice2}원`);

    // 5. 혹시 shipping_cost가 price에 포함되어 있나?
    console.log('\n5️⃣  shipping_cost 중복 여부 확인');
    console.log('-'.repeat(70));
    if (b2cCourier && b2cCourier.length > 0) {
        b2cCourier.forEach(rec => {
            const calculatedTotal = rec.price + (rec.shipping_cost || 0) + (rec.packaging_cost || 0);
            console.log(`${rec.customer_name}: price=${rec.price} + shipping=${rec.shipping_cost} = ${calculatedTotal}`);
        });
    }

    // 6. 2월 데이터도 확인
    console.log('\n6️⃣  2월 B2C 데이터 (비교)');
    const { data: febB2C } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, price, shipping_cost')
        .eq('delivery_method', 'courier')
        .gte('recorded_at', '2026-02-01T00:00:00')
        .lte('recorded_at', '2026-02-28T23:59:59');

    let febPrice = 0;
    let febShip = 0;
    febB2C?.forEach(rec => {
        febPrice += rec.price || 0;
        febShip += rec.shipping_cost || 0;
    });
    console.log(`2월 B2C: 매출=${febPrice}원, 배송비=${febShip}원`);
    console.log(`화면 표시: B2C=87,000원, 택배비=38,100원`);
}

debugB2CDiscrepancy();
