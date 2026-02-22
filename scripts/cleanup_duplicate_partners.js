const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const HIRA_FARM_ID = 'f88d29aa-c34a-47a5-9e6a-a00c45986cb7';

async function cleanupDuplicatePartners() {
    console.log("🧹 [bkit] 중복 거래처 정리 시작...");

    const { data: partners, error } = await supabase
        .from('partners')
        .select('*')
        .eq('farm_id', HIRA_FARM_ID);

    if (error) {
        console.error("❌ 조회 에러:", error);
        return;
    }

    const nameGroups = {};
    partners.forEach(p => {
        if (!nameGroups[p.company_name]) nameGroups[p.company_name] = [];
        nameGroups[p.company_name].push(p);
    });

    for (const name in nameGroups) {
        const group = nameGroups[name];
        if (group.length > 1) {
            console.log(`\n📍 [${name}] 중복 발견 (${group.length}건)`);

            // 정보가 더 많은 항목(주소나 담당자가 있는 것)을 우선순위로 정렬
            group.sort((a, b) => {
                const aScore = (a.hq_address ? 10 : 0) + (a.manager_name ? 5 : 0) + (a.manager_contact ? 2 : 0);
                const bScore = (b.hq_address ? 10 : 0) + (b.manager_name ? 5 : 0) + (b.manager_contact ? 2 : 0);
                return bScore - aScore;
            });

            const winner = group[0];
            const losers = group.slice(1);

            console.log(`✅ 유지: ID ${winner.id} (정보 점수 우위)`);

            for (const loser of losers) {
                console.log(`🗑️ 삭제: ID ${loser.id}`);
                const { error: dError } = await supabase
                    .from('partners')
                    .delete()
                    .eq('id', loser.id);

                if (dError) console.error(`❌ ${loser.id} 삭제 실패:`, dError);
            }
        }
    }

    console.log("\n✨ 중복 정리가 완료되었습니다.");
}

cleanupDuplicatePartners();
