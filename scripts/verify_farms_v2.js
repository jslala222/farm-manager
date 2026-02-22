const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findFarmsCorrectly() {
    console.log("🧐 [bkit] 'farm_name' 컬럼을 사용하여 농장 데이터를 검색합니다.\n");

    const { data: farms, error } = await supabase
        .from('farms')
        .select('*');

    if (error) {
        console.error("❌ farms 조회 오류:", error.message);
        return;
    }

    if (farms && farms.length > 0) {
        console.log(`✅ ${farms.length}개의 농장이 발견되었습니다:`);
        farms.forEach(f => {
            console.log(`   - [농장명]: ${f.farm_name} (ID: ${f.id})`);
        });

        const targetNames = ['관리자', '경준'];
        targetNames.forEach(tn => {
            const found = farms.find(f => f.farm_name.includes(tn));
            if (found) {
                console.log(`\n🎉 [보존 확인] '${tn}' 관련 데이터가 무사히 남아있습니다: ${found.farm_name}`);
            } else {
                console.log(`\n⚠️  [주의] '${tn}' 관련 농장을 명시적으로 찾을 수 없습니다.`);
            }
        });
    } else {
        console.log("⚠️  농장 데이터가 하나도 없습니다.");
    }
}

findFarmsCorrectly();
