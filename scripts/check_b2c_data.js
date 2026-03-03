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

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase 환경변수 없음');
    console.error(`URL: ${supabaseUrl ? '✅' : '❌'}`);
    console.error(`KEY: ${supabaseKey ? '✅' : '❌'}`);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkB2CData() {
    console.log('🔍 B2C 데이터 확인 중...\n');

    try {
        // 1. 모든 B2C 관련 데이터 조회 (delivery_method='courier')
        const { data: b2cRecords, error: b2cError } = await supabase
            .from('sales_records')
            .select('id, customer_name, delivery_method, sale_type, is_settled, settled_at, recorded_at, price, shipping_cost, packaging_cost')
            .eq('delivery_method', 'courier');

        if (b2cError) {
            console.error('❌ B2C 쿼리 오류:', b2cError.message);
        } else {
            console.log(`✅ delivery_method='courier' 레코드: ${b2cRecords.length}개\n`);
            
            if (b2cRecords.length > 0) {
                b2cRecords.forEach(rec => {
                    console.log(`  - ${rec.customer_name || '미지정'}`);
                    console.log(`    안정.settled: ${rec.is_settled}, settled_at: ${rec.settled_at || 'NULL'}`);
                    console.log(`    가격: ${rec.price}, 배송비: ${rec.shipping_cost}`);
                    console.log(`    recorded_at: ${rec.recorded_at}\n`);
                });
            } else {
                console.log('  ⚠️ delivery_method="courier" 레코드 없음\n');
            }
        }

        // 2. sale_type='b2c'인 데이터 확인
        const { data: b2cSaleType, error: b2cError2 } = await supabase
            .from('sales_records')
            .select('id, customer_name, delivery_method, sale_type, is_settled, settled_at, recorded_at, price')
            .eq('sale_type', 'b2c');

        if (b2cError2) {
            console.error('❌ sale_type=b2c 쿼리 오류:', b2cError2.message);
        } else {
            console.log(`✅ sale_type='b2c' 레코드: ${b2cSaleType.length}개`);
            if (b2cSaleType.length > 0) {
                console.log('  (주의: delivery_method와 확인 필요)\n');
                b2cSaleType.forEach(rec => {
                    console.log(`  - ${rec.customer_name}: delivery_method='${rec.delivery_method}'`);
                });
                console.log();
            }
        }

        // 3. 3월(2026-03) 정산 데이터 확인
        const { data: marchSettled, error: marchError } = await supabase
            .from('sales_records')
            .select('id, customer_name, delivery_method, sale_type, price, shipping_cost, settled_at')
            .gte('settled_at', '2026-03-01')
            .lte('settled_at', '2026-03-31')
            .eq('is_settled', true);

        if (marchError) {
            console.error('❌ 3월 정산 쿼리 오류:', marchError.message);
        } else {
            console.log(`\n✅ 3월(03) 정산 완료 레코드: ${marchSettled.length}개`);
            let totalPrice = 0;
            let totalShipping = 0;
            
            if (marchSettled.length > 0) {
                marchSettled.forEach(rec => {
                    totalPrice += rec.price || 0;
                    totalShipping += rec.shipping_cost || 0;
                    const type = rec.delivery_method === 'courier' ? 'B2C' : (rec.sale_type === 'b2b' ? 'B2B' : '?');
                    console.log(`  ${type}: ${rec.customer_name || '미지정'} - ${rec.price}, 배송비: ${rec.shipping_cost}`);
                });
                console.log(`\n  합계: ${totalPrice} (배송비: ${totalShipping})\n`);
            }
        }

    } catch (err) {
        console.error('❌ 오류:', err.message);
    }
}

checkB2CData();
