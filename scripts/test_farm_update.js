const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const KYUNG_JUN_FARM_ID = 'ba155f1e-a8fc-4ecf-9524-7d1c8e32b025';

async function updateFarmInfo() {
    console.log("🚀 [bkit] '경준 싱싱농장' 정보 강제 업데이트 시도...");

    const { data, error } = await supabase
        .from('farms')
        .update({
            farm_name: "경준 싱싱농장",
            address: "사장님께서 입력하신 새 주소" // 실제 주소를 알 수 없어 예시로 작성
        })
        .eq('id', KYUNG_JUN_FARM_ID)
        .select();

    if (error) {
        console.error("❌ 업데이트 실패:", error);
    } else {
        console.log("✅ 업데이트 결과:", JSON.stringify(data, null, 2));
        if (data && data.length === 0) {
            console.warn("⚠️ 경고: 업데이트된 행이 0개입니다. RLS(보안 정책)에 의해 차단되었을 가능성이 높습니다.");
        }
    }
}

updateFarmInfo();
