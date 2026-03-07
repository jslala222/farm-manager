import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase 설정이 없습니다' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 경준싱싱농장 찾기
    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .select('id')
      .eq('farm_name', '경준싱싱농장')
      .single();

    if (farmError || !farm) {
      return NextResponse.json(
        { error: '농장을 찾을 수 없습니다', details: farmError },
        { status: 404 }
      );
    }

    const farmId = farm.id;

    // 2. 첫 번째 사용자 찾기
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('farm_id', farmId)
      .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const userId = profiles[0].user_id;

    // 3. 기존 수확 데이터 확인
    const { data: existingHarvests } = await supabase
      .from('harvests')
      .select('id')
      .eq('farm_id', farmId);

    if (existingHarvests && existingHarvests.length > 0) {
      return NextResponse.json({
        message: '테스트 데이터가 이미 존재합니다',
        harvestCount: existingHarvests.length,
      });
    }

    // 4. 테스트 수확 데이터 추가
    const harvestData = [
      {
        farm_id: farmId,
        crop_name: '딸기',
        harvest_date: '2026-03-08',
        quantity: 100,
        unit: 'kg',
        memo: '오늘 수확',
        created_by: userId,
      },
      {
        farm_id: farmId,
        crop_name: '딸기',
        harvest_date: '2026-03-07',
        quantity: 80,
        unit: 'kg',
        memo: '어제 수확',
        created_by: userId,
      },
    ];

    const { data: harvests, error: harvestInsertError } = await supabase
      .from('harvests')
      .insert(harvestData)
      .select();

    if (harvestInsertError) {
      return NextResponse.json(
        { error: '수확 데이터 추가 실패', details: harvestInsertError },
        { status: 500 }
      );
    }

    // 5. 첫 번째 수확에 선별 데이터 추가
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

      const { data: inspections, error: inspectionError } = await supabase
        .from('harvest_inspections')
        .insert(inspectionData)
        .select();

      if (inspectionError) {
        return NextResponse.json(
          { error: '선별 데이터 추가 실패', details: inspectionError },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '테스트 데이터가 추가되었습니다',
        harvests: harvests.length,
        inspections: inspections?.length || 0,
      });
    }

    return NextResponse.json({ success: true, harvests: harvests?.length || 0 });
  } catch (error) {
    console.error('테스트 데이터 추가 중 오류:', error);
    return NextResponse.json(
      { error: '서버 오류', details: String(error) },
      { status: 500 }
    );
  }
}
