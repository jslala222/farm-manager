import { SalesRecord } from "./supabase";

/**
 * [bkit 정밀 정산 서비스]
 * 판매(출하)와 결산 장부의 로직을 하나로 통합하여 데이터 무결성을 보장합니다.
 */
export const settlementService = {
    // 1. 거래 유형 판별 (B2B vs B2C)
    isB2B: (record: SalesRecord): boolean => {
        return (
            record.delivery_method === 'nonghyup' ||
            !!record.partner_id ||
            record.sale_type === 'nonghyup'
        );
    },

    isB2C: (record: SalesRecord): boolean => {
        return (
            record.delivery_method === 'courier' ||
            (record.sale_type === 'etc' && !!record.customer_id)
        );
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
        // 정산 완료된 건은 실제 입금액(settled_amount) 최우선
        if (record.is_settled && record.settled_amount !== null && record.settled_amount !== undefined) {
            return record.settled_amount;
        }

        // 미정산 건은 저장된 단가(price) 사용
        // B2B의 경우 price 필드에 이미 (수량 * 단가)가 들어가 있을 수 있음 (이전 작업 참고)
        return record.price || 0;
    },

    // 4. B2C 기본 비용 설정 (UI 하드코딩 제거용)
    getDefaultB2CCosts: () => ({
        unitShipping: 4000,
        unitMaterial: 2000
    })
};
