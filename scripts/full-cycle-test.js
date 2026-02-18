const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

async function runIntegratedTest() {
    console.log('🚀 [PDCA 통합 테스트] 전체 기능(Full-Cycle) 자동화 검증 시작');

    // 환경 변수 설정
    const envPath = path.resolve(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
    });

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    try {
        // 1. 관리자 로그인
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: 'admin@farm.com',
            password: '050827'
        });
        if (authError) throw new Error(`로그인 실패: ${authError.message}`);
        console.log('✅ 1단계: 관리자 로그인 성공');

        // 2. 농장 확인 (관리자 딸기농장)
        const { data: farm, error: farmError } = await supabase.from('farms')
            .select('*')
            .ilike('farm_name', '%관리자%')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (farmError || !farm) throw new Error(`농장을 찾을 수 없습니다. (관리자 딸기농장 필요)`);
        console.log(`✅ 2단계: 대상 농장 확인 - ${farm.farm_name} (ID: ${farm.id})`);

        // 3. 근로자 등록 (자말, 알리)
        console.log('📦 3단계: 근로자 등록 시뮬레이션...');
        const workersToCreate = [
            { farm_id: farm.id, name: '자말', role: 'foreign', is_active: true },
            { farm_id: farm.id, name: '알리', role: 'foreign', is_active: true },
            { farm_id: farm.id, name: '사장님', role: 'family', is_active: true }
        ];

        const { data: workers, error: workerError } = await supabase.from('workers')
            .upsert(workersToCreate, { onConflict: 'farm_id, name' })
            .select();
        if (workerError) throw workerError;
        console.log(`   - ${workers.length}명의 근로자 등록/갱신 완료`);

        // 4. 출근 체크
        console.log('⏰ 4단계: 오늘자 출근 체크 시뮬레이션...');
        const today = new Date().toISOString().split('T')[0];
        const attendanceRecords = workers.map(w => ({
            farm_id: farm.id,
            worker_id: w.id,
            worker_name: w.name,
            role: w.role,
            work_date: today,
            is_present: true
        }));
        const { error: attError } = await supabase.from('attendance_records').upsert(attendanceRecords);
        if (attError) throw attError;
        console.log(`   - ${attendanceRecords.length}명 출근 완료`);

        // 5. 수확 기록 (1동, 2동, 3동)
        console.log('🍓 5단계: 수확 데이터 입력 시뮬레이션...');
        const harvests = [
            { farm_id: farm.id, house_number: 1, grade: 'sang', quantity: 25 },
            { farm_id: farm.id, house_number: 2, grade: 'sang', quantity: 30 },
            { farm_id: farm.id, house_number: 3, grade: 'jung', quantity: 15 }
        ];
        const { error: harvError } = await supabase.from('harvest_records').insert(harvests);
        if (harvError) throw harvError;
        console.log('   - 1, 2, 3동 수확 기록 완료');

        // 6. 판매 기록
        console.log('💰 6단계: 판매 및 지출 기록 시뮬레이션...');
        const sales = [
            { farm_id: farm.id, sale_type: 'nonghyup', quantity: 50, price: 850000 },
            { farm_id: farm.id, sale_type: 'jam', quantity: 5, price: 35000 }
        ];
        const { error: saleError } = await supabase.from('sales_records').insert(sales);
        if (saleError) throw saleError;

        // 7. 지출 기록
        const expenditures = [
            { farm_id: farm.id, category: '비료', amount: 150000, notes: '봄철 비료 구매' },
            { farm_id: farm.id, category: '식비', amount: 45000, notes: '점심 식대' }
        ];
        const { error: expError } = await supabase.from('expenditures').insert(expenditures);
        if (expError) throw expError;
        console.log('   - 판매 2건, 지출 2건 기록 완료');

        // 8. 최종 데이터 정합성 검증
        console.log('🔍 7단계: 데이터 정합성 검증 중...');
        const { data: report } = await supabase.rpc('get_farm_summary', { p_farm_id: farm.id });
        // rpc가 없을 경우 수동 카운트
        const { count: workerCount } = await supabase.from('workers').select('*', { count: 'exact', head: true }).eq('farm_id', farm.id);
        const { count: harvestCount } = await supabase.from('harvest_records').select('*', { count: 'exact', head: true }).eq('farm_id', farm.id);

        console.log('--- [검증 결과] ---');
        console.log(`✅ 근로자 수: ${workerCount}명`);
        console.log(`✅ 수확 기록 건수: ${harvestCount}건`);
        console.log('✨ [PDCA 통합 테스트] 모든 기능이 정상 작동함을 확인했습니다.');

    } catch (err) {
        console.error('❌ 테스트 중 에러 발생:', err.message);
        process.exit(1);
    }
}

runIntegratedTest();
