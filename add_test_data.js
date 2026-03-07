const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addTestData() {
  try {
    console.log('🔄 경준싱싱농장 ID 조회 중...');
    
    // 1. 경준싱싱농장 ID 조회
    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .select('id')
      .eq('farm_name', '경준싱싱농장')
      .single();

    if (farmError || !farm) {
      console.error('❌ 농장 조회 실패:', farmError);
      process.exit(1);
    }

    const farmId = farm.id;
    console.log('✅ 농장 ID:', farmId);

    // 2. 사용자 ID 조회 (auth.users에서)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ 사용자 조회 실패:', userError);
      process.exit(1);
    }

    const userId = user.id;
    console.log('✅ 사용자 ID:', userId);

    // 3. 테스트 수확 데이터 추가
    const harvestData = [
      {
        farm_id: farmId,
        crop_name: '딸기',
        harvest_date: '2026-03-08',
        quantity: 100,
        unit: 'kg',
        memo: '테스트 수확',
        created_by: userId,
      },
      {
        farm_id: farmId,
        crop_name: '딸기',
        harvest_date: '2026-03-07',
        quantity: 80,
        unit: 'kg',
        memo: '전일 수확',
        created_by: userId,
      },
    ];

    console.log('🔄 수확 데이터 추가 중...');
    const { data: harvests, error: harvestError } = await supabase
      .from('harvests')
      .insert(harvestData)
      .select();

    if (harvestError) {
      console.error('❌ 수확 데이터 추가 실패:', harvestError);
      process.exit(1);
    }

    console.log('✅ 수확 데이터 추가됨:', harvests?.length || 0, '건');

    // 4. 선별 데이터 추가
    if (harvests && harvests.length > 0) {
      const firstHarvest = harvests[0];
      
      const inspectionData = [
        {
          harvest_id: firstHarvest.id,
          farm_id: farmId,
          grade: 'normal',
          quantity: 60,
          unit: 'kg',
          processing_type: 'direct_storage',
        },
        {
          harvest_id: firstHarvest.id,
          farm_id: farmId,
          grade: 'downgrade',
          quantity: 30,
          unit: 'kg',
          processing_type: 'downgrade_storage',
        },
        {
          harvest_id: firstHarvest.id,
          farm_id: farmId,
          grade: 'discard',
          quantity: 10,
          unit: 'kg',
          processing_type: 'mark_for_discard',
        },
      ];

      console.log('🔄 선별 데이터 추가 중...');
      const { data: inspections, error: inspError } = await supabase
        .from('harvest_inspections')
        .insert(inspectionData)
        .select();

      if (inspError) {
        console.error('❌ 선별 데이터 추가 실패:', inspError);
        process.exit(1);
      }

      console.log('✅ 선별 데이터 추가됨:', inspections?.length || 0, '건');
    }

    console.log('\n✅ 모든 테스트 데이터가 성공적으로 추가되었습니다!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exit(1);
  }
}

addTestData();
