const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

async function verify() {
    console.log('--- Supabase 연결 검증 시작 ---');

    const envPath = path.resolve(__dirname, '../.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('.env.local 파일이 없습니다!');
        process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) {
            env[parts[0].trim()] = parts[1].trim();
        }
    });

    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error('환경변수(URL/Key)를 찾을 수 없습니다.');
        process.exit(1);
    }

    console.log(`URL: ${url}`);
    const supabase = createClient(url, key);

    try {
        // 1. 단순 연결 테스트
        const { data: profileCheck, error: profileError } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (profileError) {
            console.error('❌ DB 연결 실패:', profileError.message);
        } else {
            console.log('✅ DB 연결 성공!');
        }

        // 2. 로그인 테스트
        const email = 'admin@farm.com';
        const password = '050827';
        console.log(`로그인 시도: ${email}...`);

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            console.error('❌ 로그인 실패:', authError.message);
        } else {
            console.log('✅ 로그인 성공! User ID:', authData.user.id);

            const { data: profile, error: roleError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', authData.user.id)
                .single();

            if (roleError) {
                console.error('❌ 프로필 조회 실패:', roleError.message);
            } else {
                console.log(`✅ 프로필 역할: ${profile.role}`);
            }
        }
    } catch (err) {
        console.error('치명적 오류:', err.message);
    }

    console.log('--- 검증 종료 ---');
}

verify();
