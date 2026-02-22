const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase URL or Key is missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
    console.log('🔍 DB 스키마 정밀 검증 시작...');
    try {
        // expenditures 테이블에서 신규 컬럼을 포함하여 1건 조회 시도
        const { data, error } = await supabase
            .from('expenditures')
            .select('id, main_category, sub_category, payment_method')
            .limit(1);

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('✅ 컬럼은 존재하나 데이터가 없습니다 (정상).');
            } else if (error.message.includes('column') && error.message.includes('does not exist')) {
                console.error('❌ 검증 실패: 일부 컬럼이 아직 생성되지 않았습니다.');
                console.error('👉 에러 메시지:', error.message);
                process.exit(1);
            } else {
                console.error('❌ 예기치 않은 오류:', error.message);
                process.exit(1);
            }
        } else {
            console.log('✅ 모든 신규 컬럼(main_category, sub_category, payment_method)이 정상적으로 감지되었습니다!');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ 검증 중 치명적 오류 발생:', err.message);
        process.exit(1);
    }
}

verifySchema();
