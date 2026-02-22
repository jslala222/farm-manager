const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';
const supabase = createClient(supabaseUrl, supabaseKey);

const junkKeywords = ['박지성', '손흥민', '이영희', '김철수', '서울청과', '정지인', '단골', '혐동', '테스트', 'test'];

async function checkTable(table, column, description) {
    console.log(`🔍 [bkit] ${description} (${table}.${column}) 확인 중...`);
    const orCondition = junkKeywords.map(k => `${column}.ilike.%${k}%`).join(',');

    const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .or(orCondition);

    if (error) {
        console.error(`❌ ${table} 조회 오류:`, error.message);
        return;
    }

    if (count > 0) {
        console.log(`⚠️  ${table} 테이블에 아직 ${count}개의 데이터가 남아있습니다!`);
        data.forEach(item => {
            console.log(`   - [남아있는 데이터]: ${item[column]} (ID: ${item.id})`);
        });
    } else {
        console.log(`✅ ${table} 테이블은 깨끗합니다.`);
    }
}

async function checkB2BSales() {
    console.log(`🔍 [bkit] B2B 관련 판매 기록 잔류 확인 중...`);
    // partner_id가 있거나 sale_type이 nonghyup인 데이터 확인
    const { data, error, count } = await supabase
        .from('sales_records')
        .select('*', { count: 'exact' })
        .or('partner_id.not.is.null,sale_type.eq.nonghyup,delivery_method.eq.nonghyup');

    if (error) {
        console.error(`❌ sales_records B2B 조회 오류:`, error.message);
        return;
    }

    if (count > 0) {
        console.log(`⚠️  sales_records에 아직 ${count}개의 B2B 관련 기록이 남아있습니다!`);
    } else {
        console.log(`✅ sales_records의 B2B 데이터는 모두 삭제되었습니다.`);
    }
}

async function runVerification() {
    console.log("🚀 데이터 삭제 검증을 시작합니다...\n");

    await checkTable('customers', 'name', '일반 고객');
    await checkTable('partners', 'company_name', '거래처/B2B');
    await checkTable('sales_records', 'customer_name', '판매 기록 이름');
    await checkB2BSales();

    console.log("\n✨ 검증 완료.");
}

runVerification();
