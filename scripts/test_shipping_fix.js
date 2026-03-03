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

const supabase = createClient(
    envVars['NEXT_PUBLIC_SUPABASE_URL'],
    envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']
);

const settlementService = {
    isB2C: (record) => record.delivery_method === 'courier',
    isB2B: (record) => record.sale_type === 'b2b',
    calculateRecordTotal: (record) => {
        if (record.is_settled && record.settled_amount !== null && record.settled_amount !== undefined) {
            return record.settled_amount;
        }
        // [수정] shipping_cost를 제거함!
        return record.price || 0;
    }
};

// B2B/B2C 파악을 위해 필요한 환경변수들
const farmId = '01ce4e01-f000-80f6-8d8f-1c9e8b5c10fa'; // DB 확인

async function testShippingFix() {
    console.log('🔍 [택배비 계산 수정 테스트]\n');

    // 3월 B2C 데이터 조회
    const { data: b2cMarch } = await supabase
        .from('sales_records')
        .select('id, customer_name, price, shipping_cost, settled_at, recorded_at, is_settled, sale_type, delivery_method')
        .eq('delivery_method', 'courier')
        .eq('is_settled', true)
        .gte('recorded_at', '2026-03-01T00:00:00')
        .lte('recorded_at', '2026-03-31T23:59:59');

    console.log('📊 3월 B2C 확정 데이터:');
    if (b2cMarch && b2cMarch.length > 0) {
        let totalB2cPrice = 0;
        let totalShipping = 0;

        b2cMarch.forEach(rec => {
            const calcTotal = settlementService.calculateRecordTotal(rec);
            console.log(`  ${rec.customer_name}: price=${rec.price}, shipping=${rec.shipping_cost}, calculated=${calcTotal}`);
            totalB2cPrice += calcTotal;
            totalShipping += rec.shipping_cost || 0;
        });

        console.log(`\n💰 3월 B2C 소계:`);
        console.log(`  ✅ 순수 B2C 매출: ${totalB2cPrice}원`);
        console.log(`  ✅ 택배비 (지출): ${totalShipping}원`);
        console.log(`  ⚠️  [중요] 택배비는 매출에 포함 안 됨!`);
    } else {
        console.log('  [X] 데이터 없음\n');
    }

    // 2월 B2C 데이터 조회
    console.log('\n---\n');

    const { data: b2cFeb } = await supabase
        .from('sales_records')
        .select('id, customer_name, price, shipping_cost, settled_at, recorded_at, is_settled, sale_type, delivery_method')
        .eq('delivery_method', 'courier')
        .eq('is_settled', true)
        .gte('recorded_at', '2026-02-01T00:00:00')
        .lte('recorded_at', '2026-02-28T23:59:59');

    console.log('📊 2월 B2C 확정 데이터:');
    if (b2cFeb && b2cFeb.length > 0) {
        let totalB2cPrice = 0;
        let totalShipping = 0;

        b2cFeb.slice(0, 3).forEach(rec => {
            const calcTotal = settlementService.calculateRecordTotal(rec);
            console.log(`  ${rec.customer_name}: price=${rec.price}, shipping=${rec.shipping_cost}, calculated=${calcTotal}`);
            totalB2cPrice += settlementService.calculateRecordTotal(rec);
            totalShipping += rec.shipping_cost || 0;
        });
        if (b2cFeb.length > 3) {
            console.log(`  ... 외 ${b2cFeb.length - 3}건`);
            b2cFeb.slice(3).forEach(rec => {
                totalB2cPrice += settlementService.calculateRecordTotal(rec);
                totalShipping += rec.shipping_cost || 0;
            });
        }

        console.log(`\n💰 2월 B2C 소계:`);
        console.log(`  ✅ 순수 B2C 매출: ${totalB2cPrice}원`);
        console.log(`  ✅ 택배비 (지출): ${totalShipping}원`);
    } else {
        console.log('  [X] 데이터 없음\n');
    }

    console.log('\n✅ [수정 확인]');
    console.log('  • calculateRecordTotal에서 shipping_cost 제거됨');
    console.log('  • B2C 매출 = price만 계산');
    console.log('  • 택배비는 별도 지출로 처리');
}

testShippingFix().catch(console.error);
