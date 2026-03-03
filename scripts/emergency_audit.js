const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://slguawnxxdmcscxkzwdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI'
);

async function auditEmergency() {
  console.log('\n========== 🚨 긴급 데이터 감사 시작 ==========\n');

  try {
    // farm_id 자동 탐지 (RLS 우회 - anon key로 직접 조회)
    // 기존 스크립트처럼 인증 없이 조회 (RLS가 열려있으면 가능)
    
    // 먼저 sales_records에서 farm_id 확인
    const { data: sampleRec } = await supabase
      .from('sales_records')
      .select('farm_id')
      .limit(1)
      .single();
    
    const farmId = sampleRec?.farm_id;
    if (!farmId) {
      console.log('farm_id를 찾을 수 없습니다. RLS 정책 확인 필요.');
      return;
    }
    console.log(`Farm ID: ${farmId}\n`);

    // 【1】 3월 전체 B2C (택배) 조회 - recorded_at 기준
    console.log('【1】3월 B2C (delivery_method=courier) 전체 조회 (recorded_at 기준)...');
    const { data: marchB2C, error: e1 } = await supabase
      .from('sales_records')
      .select('id, recorded_at, settled_at, is_settled, price, shipping_cost, delivery_method, sale_type, customer_name')
      .eq('farm_id', farmId)
      .eq('delivery_method', 'courier')
      .gte('recorded_at', '2026-03-01T00:00:00')
      .lte('recorded_at', '2026-03-31T23:59:59')
      .order('recorded_at', { ascending: false });
    
    if (e1) { console.error('에러:', e1); return; }
    
    console.log(`3월 B2C 거래: ${marchB2C.length}건`);
    let m3Price = 0, m3Ship = 0, m3SettledPrice = 0, m3UnsettledPrice = 0;
    marchB2C.forEach(r => {
      m3Price += r.price || 0;
      m3Ship += r.shipping_cost || 0;
      if (r.is_settled) m3SettledPrice += r.price || 0;
      else m3UnsettledPrice += r.price || 0;
      console.log(`  [${r.is_settled ? '정산O' : '미정산'}] ${r.customer_name || '(고객명없음)'} | price: ${r.price}원 | 택배비: ${r.shipping_cost || 0}원 | recorded: ${r.recorded_at} | settled: ${r.settled_at || 'NULL'}`);
    });
    console.log(`  ▶ 3월 B2C 합계: 전체 ${m3Price}원 (정산완료: ${m3SettledPrice}원 / 미정산: ${m3UnsettledPrice}원)`);
    console.log(`  ▶ 3월 택배비 합계: ${m3Ship}원`);
    console.log(`  ▶ 3월 정산된 거래 택배비: ${marchB2C.filter(r=>r.is_settled).reduce((s,r)=>s+(r.shipping_cost||0),0)}원`);

    // 【2】 2월 전체 B2C 조회 - recorded_at 기준 + partner_id 포함
    console.log('\n【2】2월 B2C 전체 조회 (recorded_at 기준)...');
    const { data: febB2C, error: e2 } = await supabase
      .from('sales_records')
      .select('id, recorded_at, settled_at, is_settled, price, shipping_cost, customer_name, partner_id, sale_type, settled_amount, packaging_cost')
      .eq('farm_id', farmId)
      .eq('delivery_method', 'courier')
      .gte('recorded_at', '2026-02-01T00:00:00')
      .lte('recorded_at', '2026-02-28T23:59:59')
      .order('recorded_at', { ascending: false });
    
    if (e2) { console.error('에러:', e2); return; }
    
    console.log(`2월 B2C 거래: ${febB2C.length}건`);
    let f2Price = 0, f2Ship = 0;
    febB2C.forEach(r => {
      f2Price += r.price || 0;
      f2Ship += r.shipping_cost || 0;
      const hasPartner = !!r.partner_id;
      // calculateRecordTotal 시뮬레이션
      let calcTotal;
      if (r.is_settled && r.settled_amount !== null && r.settled_amount !== undefined) {
        calcTotal = r.settled_amount;
      } else {
        calcTotal = r.price || 0;
      }
      const shippingCalc = (r.shipping_cost || 0) + (r.packaging_cost || 0);
      console.log(`  [${r.is_settled ? '정산O' : '미정산'}] ${r.customer_name || '(고객명없음)'} | price: ${r.price} | settled_amount: ${r.settled_amount} | calcTotal: ${calcTotal} | 택배비: ${r.shipping_cost || 0} | pkg: ${r.packaging_cost || 0} | shippingCalc: ${shippingCalc}`);
    });
    console.log(`  ▶ 2월 B2C 합계: ${f2Price}원, 택배비: ${f2Ship}원`);

    // 【3】 2월 판매건 중 3월에 입금처리된 것 (settled_at이 3월)
    console.log('\n【3】2월 기록 but 3월에 입금된 거래...');
    const { data: delayed, error: e3 } = await supabase
      .from('sales_records')
      .select('id, recorded_at, settled_at, is_settled, price, shipping_cost, customer_name, delivery_method')
      .eq('farm_id', farmId)
      .gte('recorded_at', '2026-02-01T00:00:00')
      .lte('recorded_at', '2026-02-28T23:59:59')
      .gte('settled_at', '2026-03-01')
      .lte('settled_at', '2026-03-31');
    
    if (e3) { console.error('에러:', e3); return; }
    
    console.log(`2월판매→3월입금: ${delayed.length}건`);
    delayed.forEach(r => {
      console.log(`  ${r.customer_name || '(미지정)'} | price: ${r.price}원 | 택배비: ${r.shipping_cost || 0}원 | recorded: ${r.recorded_at} | settled: ${r.settled_at} | delivery: ${r.delivery_method}`);
    });

    // 【4】 3월 미정산(is_settled=false) B2C만
    console.log('\n【4】3월 미정산 B2C...');
    const unsettledMarch = marchB2C.filter(r => !r.is_settled);
    console.log(`3월 미정산 B2C: ${unsettledMarch.length}건`);
    unsettledMarch.forEach(r => {
      console.log(`  ${r.customer_name || '(미지정)'} | price: ${r.price}원 | 택배비: ${r.shipping_cost || 0}원`);
    });

    // 【5】 3월 B2B 정산(settled_at 기준)
    console.log('\n【5】3월 B2B 정산완료 (settled_at 기준)...');
    const { data: marchB2B, error: e5 } = await supabase
      .from('sales_records')
      .select('id, recorded_at, settled_at, is_settled, price, settled_amount, sale_type, customer_name, partner:partners(company_name)')
      .eq('farm_id', farmId)
      .eq('sale_type', 'b2b')
      .eq('is_settled', true)
      .gte('settled_at', '2026-03-01')
      .lte('settled_at', '2026-03-31')
      .order('settled_at', { ascending: false });
    
    if (e5) { console.error('에러:', e5); return; }
    
    let m3B2B = 0;
    console.log(`3월 B2B 정산완료: ${marchB2B.length}건`);
    marchB2B.forEach(r => {
      const amt = (r.settled_amount != null) ? r.settled_amount : (r.price || 0);
      m3B2B += amt;
      console.log(`  ${r.partner?.company_name || r.customer_name || '(미지정)'} | 금액: ${amt}원 | settled: ${r.settled_at}`);
    });
    console.log(`  ▶ 3월 B2B 합계: ${m3B2B}원`);

    // 【결론】
    console.log('\n========================================');
    console.log('【결론 요약】');
    console.log(`  3월 B2C 전체(recorded_at): ${m3Price}원 (${marchB2C.length}건)`);
    console.log(`    - 정산완료: ${m3SettledPrice}원`);
    console.log(`    - 미정산(입금전): ${m3UnsettledPrice}원`);
    console.log(`  3월 B2C 택배비(전체): ${m3Ship}원`);
    console.log(`  3월 B2B 정산완료(settled_at): ${m3B2B}원`);
    console.log(`  ※ 현재 코드가 표시하는 총매출: B2B ${m3B2B} + B2C ${m3Price} = ${m3B2B + m3Price}원`);
    console.log(`  ※ 정확한 총매출(미정산 제외): B2B ${m3B2B} + B2C ${m3SettledPrice} = ${m3B2B + m3SettledPrice}원`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ 에러:', error);
  }
}

auditEmergency();
