import { supabase } from './supabase';

export interface AddressSet {
    recipient_name: string;
    recipient_phone: string;
    address: string;
    postal_code: string;
    latitude: number | null;
    longitude: number | null;
    detail_address?: string | null;
    delivery_note?: string | null;
    last_used: string;
}

/**
 * 특정 고객의 최근 배송지 세트(수령인+번호+주소+우편번호)를 추출합니다.
 */
export const getRecentAddressSets = async (customerId: string): Promise<AddressSet[]> => {
    if (!customerId) return [];

    try {
        const { data, error } = await supabase
            .from('sales_records')
            .select('recipient_name, recipient_phone, address, postal_code, detail_address, delivery_note, latitude, longitude, recorded_at')
            .eq('customer_id', customerId)
            .order('recorded_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        if (!data) return [];

        // 중복 제거 (수령인 + 주소 조합 기준)
        const uniqueSets: AddressSet[] = [];
        const seen = new Set<string>();

        data.forEach(item => {
            const key = `${item.recipient_name || ''}|${item.address || ''}`;
            if (!seen.has(key) && item.address) {
                seen.add(key);
                uniqueSets.push({
                    recipient_name: item.recipient_name || "",
                    recipient_phone: item.recipient_phone || "",
                    address: item.address || "",
                    postal_code: item.postal_code || "",
                    detail_address: item.detail_address || "",
                    delivery_note: item.delivery_note || "",
                    latitude: item.latitude || null,
                    longitude: item.longitude || null,
                    last_used: item.recorded_at
                });
            }
        });

        // 최근 5개만 반환
        return uniqueSets.slice(0, 5);
    } catch (e: any) {
        // 사장님, 아직 DB 컬럼이 생성되지 않았을 때 화면이 멈추지 않도록 조용히 넘김 처리합니다.
        console.warn("최근 배송지 정보를 찾을 수 없습니다. (DB 복구 필요 가능성)", e.message || e);
        return [];
    }
};
