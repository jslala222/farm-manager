const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

async function testUpdate() {
    console.log('--- 관리자 권한 저장 기능 테스트 시작 ---');

    const envPath = path.resolve(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) env[parts[0].trim()] = parts[1].trim();
    });

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // 1. 관리자 로그인
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@farm.com',
        password: '050827'
    });

    if (authError) {
        console.error('로그인 실패:', authError.message);
        return;
    }
    console.log('✅ 관리자 로그인 성공');

    // 2. 임의의 농장 하나 가져오기
    const { data: farm } = await supabase.from('farms').select('*').limit(1).single();
    if (!farm) {
        console.error('테스트할 농장이 없습니다.');
        return;
    }
    console.log(`테스트할 농장: ${farm.farm_name} (ID: ${farm.id})`);

    // 3. 정보 수정 시도
    const newName = `테스트-${Math.floor(Math.random() * 1000)}`;
    console.log(`농장 이름을 "${newName}"으로 수정을 시도합니다...`);

    const { error: updateError } = await supabase
        .from('farms')
        .update({ notes: `관리자 수정 테스트 (${new Date().toLocaleTimeString()})` })
        .eq('id', farm.id);

    if (updateError) {
        console.error('❌ 저장 실패:', updateError.message);
        console.log('원인: RLS 정책(Update)이 관리자 권한을 허용하지 않고 있을 가능성이 큽니다.');
    } else {
        console.log('✅ 저장 성공! 관리자 권한으로 정보 수정이 가능합니다.');
    }

    console.log('--- 테스트 종료 ---');
}

testUpdate();
