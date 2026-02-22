const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const KYUNG_JUN_FARM_ID = 'ba155f1e-a8fc-4ecf-9524-7d1c8e32b025';

async function setupCrops() {
    console.log("🚀 [bkit] 경준 싱심농장 작물 설정 마법사 실행 중...");

    const crops = [
        { house: 1, crop: "딸기", active: true },
        { house: 2, crop: "딸기", active: true },
        { house: 3, crop: "딸기", active: true },
        { house: 4, crop: "휴작중", active: false },
        { house: 5, crop: "휴작중", active: false },
        { house: 6, crop: "고구마", active: true },
        { house: 7, crop: "감자", active: true },
        { house: 8, crop: "샤인머스켓", active: true },
    ];

    for (const item of crops) {
        const { error } = await supabase
            .from('farm_houses')
            .update({
                current_crop: item.crop,
                is_active: item.active
            })
            .eq('farm_id', KYUNG_JUN_FARM_ID)
            .eq('house_number', item.house);

        if (error) {
            console.error(`${item.house}동 설정 실패:`, error);
        } else {
            console.log(`✅ ${item.house}동: ${item.crop} (${item.active ? '운영중' : '휴작'}) 설정 완료`);
        }
    }

    console.log("\n✨ 모든 설정이 완료되었습니다! 사장님, 브라우저를 새로고침 해보세요.");
}

setupCrops();
