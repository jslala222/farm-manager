// scripts/audit_settlement.js - 정산액 오류 데이터 검수 및 수정
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditSettlement() {
    console.log('🔍 정산액 오류 데이터 검수 중...\n');

    try {
        // 1. B2B 정산 완료 데이터 전체 조회
        const { data: records, error } = await supabase
            .from('sales_records')
            .select('id, partner_id, partners(company_name), recorded_at, settled_at, price, settled_amount, is_settled, sale_type, farm_id')
            .eq('is_settled', true)
            .eq('sale_type', 'b2b')
            .order('settled_at', { ascending: false });

        if (error) {
            console.error('❌ 데이터 조회 오류:', error);
            return;
        }

        console.log(`📊 총 정산 건수: ${records.length}건\n`);

        // 2. 같은 거래처 + 같은 정산일로 그룹화
        const groupedByPartnerDate = {};
        records.forEach(rec => {
            const key = `${rec.partner_id || 'unknown'}|${rec.settled_at}`;
            if (!groupedByPartnerDate[key]) {
                groupedByPartnerDate[key] = [];
            }
            groupedByPartnerDate[key].push(rec);
        });

        // 3. 이상한 패턴 찾기: 같은 날짜에 2건 이상, 첫 건만 정산액 있고 나머지는 NULL 또는 비정상적
        const suspiciousGroups = [];
        Object.entries(groupedByPartnerDate).forEach(([key, group]) => {
            if (group.length >= 2) {
                // 정산액이 부정상한 패턴 확인
                const settled_amounts = group.map(r => r.settled_amount);
                const has_nulls = settled_amounts.some(amt => amt === null || amt === 0);
                const has_values = settled_amounts.some(amt => amt !== null && amt > 0);
                
                // 패턴: NULL/0과 값이 섞여있는 경우 = 오류 가능성 높음
                if (has_nulls && has_values) {
                    suspiciousGroups.push({
                        key,
                        group,
                        totalPrice: group.reduce((sum, r) => sum + (r.price || 0), 0),
                        totalSettled: group.reduce((sum, r) => sum + (r.settled_amount || 0), 0),
                    });
                }
            }
        });

        if (suspiciousGroups.length === 0) {
            console.log('✅ 오류 패턴이 발견되지 않았습니다.\n');
            return;
        }

        console.log(`⚠️ 오류 가능성 있는 정산 그룹: ${suspiciousGroups.length}개\n`);
        console.log('=' .repeat(100));

        const suggestedUpdates = [];

        suspiciousGroups.forEach((group, idx) => {
            const [partnerId, settledDate] = group.key.split('|');
            const company = group.group[0].partners?.company_name || 'Unknown';
            
            console.log(`\n📌 #${idx + 1} ${company} | ${settledDate}`);
            console.log('-'.repeat(100));
            console.log(`예상금액 합: ${group.totalPrice.toLocaleString()}원 | 정산금액 합: ${group.totalSettled.toLocaleString()}원`);
            console.log(`건수: ${group.group.length}건\n`);

            group.group.forEach((rec, recIdx) => {
                console.log(`  [${recIdx + 1}] 예상금액: ${(rec.price || 0).toLocaleString()}원 → 정산금액: ${(rec.settled_amount || 0).toLocaleString()}원`);
            });

            // 비율 재계산
            console.log(`\n💡 추천 수정안 (비율 분배):`);
            
            // 정산액 합이 올바른지 확인 (첫 건에만 할당됨)
            const firstRecAmount = group.group[0].settled_amount || 0;
            const restAmounts = group.group.slice(1).map(r => r.settled_amount || 0);
            
            // 패턴 확인: 첫 번째만 금액 있고 나머지는 0인 경우
            const isFirstOnlyPattern = firstRecAmount > 0 && restAmounts.every(amt => amt === 0 || amt === null);
            
            if (isFirstOnlyPattern) {
                // 첫 번째 금액을 비율로 분배
                const totalToDistribute = firstRecAmount;
                const totalPrice = group.totalPrice;

                group.group.forEach((rec, recIdx) => {
                    if (totalPrice > 0) {
                        const ratio = (rec.price || 0) / totalPrice;
                        const suggestedAmount = Math.round(totalToDistribute * ratio);
                        const diff = suggestedAmount - (rec.settled_amount || 0);
                        
                        console.log(`  [${recIdx + 1}] ${(rec.price || 0).toLocaleString()}원 × ${(ratio * 100).toFixed(1)}% = ${suggestedAmount.toLocaleString()}원 (${diff >= 0 ? '+' : ''}${diff.toLocaleString()}원)`);
                        
                        suggestedUpdates.push({
                            id: rec.id,
                            company,
                            settledDate,
                            currentAmount: rec.settled_amount || 0,
                            suggestedAmount,
                            ratio: ratio.toFixed(4),
                        });
                    }
                });
            }
        });

        // 4. 수정 내용 요약
        if (suggestedUpdates.length > 0) {
            console.log('\n' + '='.repeat(100));
            console.log(`\n🔧 총 ${suggestedUpdates.length}건 수정 필요\n`);

            suggestedUpdates.forEach((update, idx) => {
                console.log(`${idx + 1}. ID: ${update.id}`);
                console.log(`   거래처: ${update.company} | 날짜: ${update.settledDate}`);
                console.log(`   수정: ${update.currentAmount.toLocaleString()}원 → ${update.suggestedAmount.toLocaleString()}원`);
            });

            // SQL 생성
            console.log('\n' + '='.repeat(100));
            console.log('\n📝 SQL 수정 쿼리:\n');
            
            suggestedUpdates.forEach(update => {
                console.log(`UPDATE sales_records SET settled_amount = ${update.suggestedAmount} WHERE id = '${update.id}';`);
            });

            // 자동 수정 여부 확인
            console.log('\n' + '='.repeat(100));
            console.log('\n🤖 자동 수정 진행 중...\n');

            let successCount = 0;
            let errorCount = 0;

            for (const update of suggestedUpdates) {
                const { error } = await supabase
                    .from('sales_records')
                    .update({ settled_amount: update.suggestedAmount })
                    .eq('id', update.id);

                if (error) {
                    console.log(`❌ ${update.id}: ${error.message}`);
                    errorCount++;
                } else {
                    console.log(`✅ ${update.id}: ${update.currentAmount.toLocaleString()}원 → ${update.suggestedAmount.toLocaleString()}원`);
                    successCount++;
                }
            }

            console.log('\n' + '='.repeat(100));
            console.log(`\n📊 수정 완료: ${successCount}건 성공, ${errorCount}건 실패\n`);
        }

    } catch (err) {
        console.error('❌ 처리 중 오류:', err);
    }
}

auditSettlement();
