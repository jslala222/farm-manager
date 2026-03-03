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

async function runStrictTest() {
    console.log('🔬 엄격한 테스트: 방안 1 검증\n');
    console.log('=' .repeat(60));

    let passCount = 0;
    let failCount = 0;

    // ========================================
    // 테스트 1: 3월 B2C 데이터 (recorded_at 기준)
    // ========================================
    console.log('\n📊 테스트 1: 3월 B2C 데이터 검증');
    console.log('-'.repeat(60));

    const { data: marchB2C } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, recorded_at, settled_at, is_settled, price, shipping_cost')
        .eq('delivery_method', 'courier')
        // ← is_settled 조건 제거! (방안1)
        .gte('recorded_at', '2026-03-01T00:00:00')
        .lte('recorded_at', '2026-03-31T23:59:59')
        .order('recorded_at', { ascending: false });

    console.log(`조회된 B2C 레코드: ${marchB2C?.length || 0}개\n`);

    let marchPrice = 0;
    let marchShip = 0;
    if (marchB2C && marchB2C.length > 0) {
        marchB2C.forEach(rec => {
            marchPrice += rec.price || 0;
            marchShip += rec.shipping_cost || 0;
            console.log(`  - ${rec.customer_name || '미지정'}: ${rec.price}원, 배송비: ${rec.shipping_cost || 0}원`);
            console.log(`    (recorded_at: ${rec.recorded_at.split('T')[0]}, settled_at: ${rec.settled_at || 'NULL'})`);
        });
    }

    console.log(`\n예상값: 매출 120,000원, 배송비 12,000원`);
    console.log(`실제값: 매출 ${marchPrice}원, 배송비 ${marchShip}원`);

    if (marchPrice === 120000 && marchShip === 12000) {
        console.log('✅ 3월 B2C 테스트 성공!');
        passCount++;
    } else {
        console.log('❌ 3월 B2C 테스트 실패!');
        failCount++;
    }

    // ========================================
    // 테스트 2: 2월 B2C 데이터 (recorded_at 기준)
    // ========================================
    console.log('\n📊 테스트 2: 2월 B2C 데이터 검증');
    console.log('-'.repeat(60));

    const { data: febB2C } = await supabase
        .from('sales_records')
        .select('id, customer_name, delivery_method, recorded_at, settled_at, is_settled, price, shipping_cost')
        .eq('delivery_method', 'courier')
        // ← is_settled 조건 제거! (방안1)
        .gte('recorded_at', '2026-02-01T00:00:00')
        .lte('recorded_at', '2026-02-28T23:59:59')
        .order('recorded_at', { ascending: false });

    console.log(`조회된 B2C 레코드: ${febB2C?.length || 0}개\n`);

    let febPrice = 0;
    let febShip = 0;
    if (febB2C && febB2C.length > 0) {
        febB2C.slice(0, 5).forEach(rec => {  // 처음 5개만 출력
            febPrice += rec.price || 0;
            febShip += rec.shipping_cost || 0;
            console.log(`  - ${rec.customer_name || '미지정'}: ${rec.price}원`);
        });
        // 나머지 합계
        febB2C.slice(5).forEach(rec => {
            febPrice += rec.price || 0;
            febShip += rec.shipping_cost || 0;
        });
        console.log(`  (${febB2C.length > 5 ? '외 ' + (febB2C.length - 5) + '개' : ''})`);
    }

    console.log(`\n예상값: 매출 545,000원, 배송비 30,300원`);
    console.log(`실제값: 매출 ${febPrice}원, 배송비 ${febShip}원`);

    if (febPrice === 545000 && febShip === 30300) {
        console.log('✅ 2월 B2C 테스트 성공!');
        passCount++;
    } else {
        console.log('❌ 2월 B2C 테스트 실패!');
        failCount++;
    }

    // ========================================
    // 테스트 3: B2B settled_at 기준 (3월)
    // ========================================
    console.log('\n📊 테스트 3: 3월 B2B 데이터 검증 (settled_at 기준)');
    console.log('-'.repeat(60));

    const { data: marchB2B } = await supabase
        .from('sales_records')
        .select('id, customer_name, sale_type, settled_at, is_settled, price')
        .eq('sale_type', 'b2b')
        .eq('is_settled', true)
        .gte('settled_at', '2026-03-01')
        .lte('settled_at', '2026-03-31')
        .order('settled_at', { ascending: false });

    let marchB2BPrice = 0;
    if (marchB2B && marchB2B.length > 0) {
        marchB2B.forEach(rec => {
            marchB2BPrice += rec.price || 0;
        });
    }

    console.log(`조회된 B2B 레코드: ${marchB2B?.length || 0}개`);
    console.log(`합계: ${marchB2BPrice}원`);
    console.log(`예상값: 7,400,000원`);

    if (marchB2BPrice === 7400000) {
        console.log('✅ 3월 B2B 테스트 성공!');
        passCount++;
    } else {
        console.log('❌ 3월 B2B 테스트 실패!');
        failCount++;
    }

    // ========================================
    // 테스트 4: 통합 정산 (3월)
    // ========================================
    console.log('\n📊 테스트 4: 3월 통합 정산 검증');
    console.log('-'.repeat(60));

    const totalRev = marchPrice + marchB2BPrice;
    const totalCost = 1310000 + 117000 + marchShip;  // 인건비 + 식대 + 배송비
    const netProfit = totalRev - totalCost;

    console.log(`B2B 매출: ${marchB2BPrice}원`);
    console.log(`B2C 매출: ${marchPrice}원`);
    console.log(`총 매출액: ${totalRev}원`);
    console.log(`\n-인건비: 1,310,000원`);
    console.log(`-식대: 117,000원`);
    console.log(`-배송비: ${marchShip}원`);
    console.log(`총 지출액: ${totalCost}원`);
    console.log(`\n순이익: ${netProfit}원`);

    const expectedTotal = 7520000;
    const expectedNetProfit = 6081000;

    if (totalRev === expectedTotal) {
        console.log(`✅ 총 매출액 정확 (${totalRev}원)`);
        passCount++;
    } else {
        console.log(`❌ 총 매출액 오류 (예상: ${expectedTotal}, 실제: ${totalRev})`);
        failCount++;
    }

    if (netProfit === expectedNetProfit) {
        console.log(`✅ 순이익 정확 (${netProfit}원)`);
        passCount++;
    } else {
        console.log(`❌ 순이익 오류 (예상: ${expectedNetProfit}, 실제: ${netProfit})`);
        failCount++;
    }

    // ========================================
    // 최종 결과
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log(`\n📋 테스트 결과: ${passCount}개 성공, ${failCount}개 실패\n`);

    if (failCount === 0) {
        console.log('🎉 모든 테스트 성공! 방안 1이 정확하게 작동합니다.\n');
    } else {
        console.log('⚠️  일부 테스트 실패. 확인 필요합니다.\n');
    }
}

runStrictTest();
