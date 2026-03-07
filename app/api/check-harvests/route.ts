import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
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

    // 경준싱싱농장 데이터 확인
    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .select('id')
      .eq('farm_name', '경준싱싱농장')
      .single();

    if (farmError || !farm) {
      return NextResponse.json({ error: '농장 없음' }, { status: 404 });
    }

    // 해당 농장의 수확 데이터 확인
    const { data: harvests, error: harvestError } = await supabase
      .from('harvests')
      .select('*')
      .eq('farm_id', farm.id)
      .order('harvest_date', { ascending: false });

    if (harvestError) {
      return NextResponse.json({ error: harvestError.message }, { status: 500 });
    }

    return NextResponse.json({
      farmId: farm.id,
      harvestCount: harvests?.length || 0,
      harvests: harvests || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
