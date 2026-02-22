const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';
const supabase = createClient(supabaseUrl, supabaseKey);

// 삭제 대상 키워드 (사장님 승인 기반)
const customerKeywords = ['단골손님', '정지인', '박지성', '손흥민', '이영희', '김철수', '테스트', '단골1'];
const partnerKeywords = ['상주 농협협동조합', '농업협동조합', '서울청과'];

async function executeCleanup() {
    console.log("🧹 [bkit] 사장님의 승인에 따라 최종 데이터 소거를 시작합니다.\n");

    // 1. 가짜 고객 삭제
    console.log("👤 가짜 고객 데이터 삭제 중...");
    const customerOr = customerKeywords.map(k => `name.ilike.%${k}%`).join(',');
    const { count: cCount, error: cError } = await supabase
        .from('customers')
        .delete({ count: 'exact' })
        .or(customerOr);

    if (cError) {
        console.error("❌ 고객 삭제 오류:", cError.message);
    } else {
        console.log(`✅ 가짜 고객 ${cCount || 0}건 삭제 완료.`);
    }

    // 2. 상주 농협 및 기타 가짜 거래처 삭제
    console.log("🏢 가짜 거래처 데이터 삭제 중...");
    const partnerOr = partnerKeywords.map(k => `company_name.ilike.%${k}%`).join(',');
    const { count: pCount, error: pError } = await supabase
        .from('partners')
        .delete({ count: 'exact' })
        .or(partnerOr);

    if (pError) {
        console.error("❌ 거래처 삭제 오류:", pError.message);
    } else {
        console.log(`✅ 가짜 거래처 ${pCount || 0}건 삭제 완료.`);
    }

    // 3. ID 기반 강제 삭제 (혹시 모를 잔류 데이터)
    console.log("🎯 ID 기반 강제 삭제 진행 중...");
    const targetIds = {
        customers: ['52033b1b-e23c-4c4b-b913-01915254bf57'],
        partners: ['37de71df-11c1-4ff5-bd1d-8b8a00a8488c']
    };

    for (const [table, ids] of Object.entries(targetIds)) {
        const { count, error } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .in('id', ids);

        if (!error && count > 0) {
            console.log(`✅ ${table} ID ${ids.join(', ')} 삭제 완료.`);
        }
    }

    console.log("\n✨ 모든 가짜 데이터가 소거되었습니다. 사장님의 진짜 장부만 남았습니다.");
}

executeCleanup();
