import { SalesRecord } from "./supabase";

/**
 * [bkit 정밀 정산 서비스]
 * 판매(출하)와 결산 장부의 로직을 하나로 통합하여 데이터 무결성을 보장합니다.
 */
export const settlementService = {
    // 1. 거래 유형 판별 (B2B vs B2C)
    isB2B: (record: SalesRecord): boolean => {
        return record.sale_type === 'b2b' || !!record.partner_id;
    },

    isB2C: (record: SalesRecord): boolean => {
        return record.sale_type === 'b2c' || record.delivery_method === 'courier';
    },

    // 2. 정산 상태 판별 (라벨링)
    getSettlementStatus: (record: SalesRecord) => {
        const isB2B = settlementService.isB2B(record);

        if (record.is_settled) {
            return {
                label: isB2B ? '납품정산완료' : '입금확인됨',
                color: isB2B ? 'green' : 'blue',
                isCompleted: true
            };
        }

        // 미정산 상태
        const hasPrice = (record.price || 0) > 0;
        return {
            label: isB2B
                ? (hasPrice ? '납품미정산' : '단가미정')
                : '입금전(택배)',
            color: isB2B ? (hasPrice ? 'amber' : 'red') : 'pink',
            isCompleted: false
        };
    },

    // 3. 금액 계산 로직 (하드코딩 제거 대상)
    calculateRecordTotal: (record: SalesRecord) => {
        // 1. 정산 완료된 건은 실제 입금액(settled_amount) 최우선
        // 단, settled_amount=0은 "미입력"을 의미 → price를 사용
        // B2C 택배거래는 settled_amount를 입력하지 않으므로 항상 0 → price 사용
        if (record.is_settled && record.settled_amount !== null && record.settled_amount !== undefined && record.settled_amount > 0) {
            return record.settled_amount;
        }

        // 2. settled_amount가 없거나 0인 경우 → price 사용
        let total = record.price || 0;

        // [수정] B2C 택배비는 매출이 아니라 지출!
        // - price: 상품가 (매출)
        // - shipping_cost: 선불 택배비 (지출/경비)
        // → 매출 계산에서는 price만 사용, shipping은 경비로 처리
        // if (settlementService.isB2C(record)) {
        //     total += (record.shipping_cost || 0);  // ← 제거 (shipping은 지출)
        // }

        return total;
    },

    // 4. B2C 기본 비용 설정 (UI 하드코딩 제거용)
    getDefaultB2CCosts: () => ({
        unitShipping: 4000,
        unitMaterial: 2000
    })
};
