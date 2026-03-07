import { createBrowserClient } from '@supabase/ssr';

// [bkit 하이퍼-커넥트] 싱글톤 클라이언트 관리 (Hot Reload 시 중복 생성 방지)
let supabaseInstance: any;

const getSupabaseClient = () => {
    if (supabaseInstance) return supabaseInstance;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (typeof window !== 'undefined') {
    }

    supabaseInstance = createBrowserClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            // [수정] Navigator LockManager 타임아웃 에러 방지
            // 여러 탭에서 같은 잠금 키를 동시에 획득하려 할 때 발생하는 문제를 해결
            lock: async (name, acquireTimeout, fn) => {
                // LockManager를 지원하지 않는 환경이거나 타임아웃 없이 바로 실행
                if (typeof navigator === 'undefined' || !navigator.locks) {
                    return fn();
                }
                try {
                    return await navigator.locks.request(
                        name,
                        { ifAvailable: true },
                        async (lock) => {
                            if (lock) {
                                return fn();
                            }
                            // 잠금 획득 실패 시 잠금 없이 바로 실행 (에러 방지)
                            console.warn('⚠️ [farm] Auth lock 획득 실패, 잠금 없이 실행합니다.');
                            return fn();
                        }
                    );
                } catch (e) {
                    console.warn('⚠️ [farm] LockManager 에러, 잠금 없이 실행합니다.', e);
                    return fn();
                }
            },
        },
        global: {
            // [bkit] 네트워크 불안정 시 자동 재시도 (사장님 지시사항: 약간 느려도 연결 유지)
            fetch: async (url, options) => {
                let retries = 0;
                const maxRetries = 3;
                while (retries < maxRetries) {
                    try {
                        const response = await fetch(url, options);
                        // 5xx 서버 에러나 429(Too Many Requests)일 때만 재시도
                        if (response.status >= 500 || response.status === 429) {
                            throw new Error(`Server Error: ${response.status}`);
                        }
                        return response;
                    } catch (err: any) {
                        retries++;
                        if (retries >= maxRetries) throw err;
                        console.warn(`⚠️ [bkit] 연결 불안정... 재시도 중 (${retries}/${maxRetries})`);
                        // 지수 백오프: 1초, 2초, 4초 대기 후 재시도
                        await new Promise(res => setTimeout(res, 1000 * Math.pow(2, retries - 1)));
                    }
                }
                return fetch(url, options);
            }
        }
    });

    return supabaseInstance;
};

export const supabase = getSupabaseClient();

// 타입 정의
export type UserRole = 'admin' | 'owner';

export interface Profile {
    id: string;
    role: UserRole;
    full_name: string | null;
    must_change_password: boolean;
    created_at: string;
}

export interface Farm {
    id: string;
    owner_id: string;
    farm_name: string;
    business_number: string | null;
    phone: string | null;
    fax: string | null;
    email: string | null;
    address: string | null;
    postal_code: string | null; // 농장 주소 우편번호
    latitude: number | null;    // 농장 위도
    longitude: number | null;   // 농장 경도
    notes: string | null;
    test_password: string | null;
    is_active: boolean;
    inventory_enabled: boolean;   // 재고관리 ON/OFF
    inventory_warn_only: boolean; // true=경고만, false=판매차단
    created_at: string;
    owner_email?: string; // 관리자용 필드
}

export interface FarmHouse {
    id: string;
    farm_id: string;
    house_number: number;
    house_name: string | null;
    current_crop: string | null; // 현재 재배 작물
    is_active: boolean;
    created_at: string;
}

// [안3] 작물/가공품 사진 카탈로그 (Admin 전용 마스터, 1:N 구조)
export interface CropCatalog {
    id: string;
    crop_key: string;       // 그룹 키 (같은 작물의 여러 사진을 묶는 키)
    crop_name: string;
    crop_icon: string;
    image_url: string;
    category: 'crop' | 'processed';
    display_order: number;
    is_published: boolean;
    created_at: string;
    updated_at: string;
}

// crop_key 기준으로 그룹핑된 카탈로그 타입
export interface CropCatalogGroup {
    crop_key: string;
    crop_name: string;
    crop_icon: string;
    category: 'crop' | 'processed';
    photos: CropCatalog[];  // 해당 작물의 사진 목록
}

// [bkit 엔터프라이즈] 농장별 재배 작물 관리 (하이브리드 다품종 시스템)
export interface FarmCrop {
    id: string;
    farm_id: string;
    crop_name: string;
    crop_icon: string;
    crop_image_url?: string | null;
    image_source?: 'emoji' | 'catalog' | 'custom';
    default_unit: string;
    available_units: string[];
    sort_order: number;
    is_active: boolean;
    category: 'crop' | 'processed'; // 'crop' = 원물, 'processed' = 가공품
    available_specs: string[]; // 가공품 규격 목록 (['350g', '1kg'] 등)
    created_at: string;
}

// [안3] 기타수입 관리 (영농지원금, 농지임대, 재난지원금 등)
export interface OtherIncome {
    id: string;
    farm_id: string;
    amount: number;
    income_type: string;
    description: string | null;
    income_date: string;
    created_at: string;
}

export interface HarvestRecord {
    id: string;
    farm_id: string;
    house_number: number;
    grade: 'sang' | 'jung' | 'ha';
    quantity: number;
    crop_name: string | null; // 수확 시점 작물 이름 (스냅샷)
    recorded_at: string;
    harvest_note?: string | null; // 수확 당시 특이사항
}

export interface SalesRecord {
    id: string;
    farm_id: string;
    sale_type: 'b2b' | 'b2c' | 'etc';
    quantity: number;
    price: number | null;
    customer_name: string | null;
    address: string | null;
    postal_code: string | null; // 배송지 우편번호
    latitude: number | null;    // 배송지 위도
    longitude: number | null;   // 배송지 경도
    recorded_at: string;
    client_id?: string; // Legacy
    partner_id?: string; // B2B
    customer_id?: string; // B2C
    delivery_method?: 'direct' | 'courier';
    shipping_cost?: number;
    shipping_fee_type?: string; // 선불 / 착불
    packaging_cost?: number;
    harvest_note?: string | null; // 수확 당시 특이사항 (현장 일기)
    recipient_name?: string | null; // 수령인 (사람/업체/부서 등)
    recipient_phone?: string | null; // 수령인 연락처
    detail_address?: string | null; // 상세 주소 (동/호수)
    delivery_note?: string | null; // 배송 특이사항 (초인종 금지 등)
    is_settled?: boolean; // 정산 완료 여부
    crop_name?: string | null;   // 품목 (딸기, 고구마 등)
    sale_unit?: string | null;   // 단위 (박스, kg 등)
    payment_status?: string | null; // 정산 상태 (pending, completed)
    payment_method?: string | null; // 결제 수단 (카드, 현금 등)
    settled_amount?: number; // 정산 완료 시 확정된 금액 (정산 완료/후불 건 등)
    grade?: string | null; // 등급 (특/상/보통/하/미지정)
    product_spec?: string | null; // 가공품 규격 (350g, 1kg, 500ml 등)
    clients?: { name: string; client_type: string }; // Legacy Join Result
    partner?: { company_name: string; manager_contact?: string }; // B2B Join
    customer?: { name: string; contact?: string; address?: string; is_vip?: boolean }; // B2C Join
}

export interface AttendanceRecord {
    id: string;
    farm_id: string;
    work_date: string;
    worker_id: string | null;
    worker_name: string;
    role: 'family' | 'foreign' | 'part_time' | 'staff';
    is_present: boolean;
    daily_wage: number | null;
    work_hours: number | null;
    headcount: number;
    notes: string | null;
    actual_wage: number | null; // 그날 확정된 실질 임금
    memo: string | null; // 현장 메모
    recorded_at: string;
}

export interface Worker {
    id: string;
    farm_id: string;
    name: string;
    role: 'family' | 'foreign' | 'part_time' | 'staff';
    phone: string | null;
    gender: 'male' | 'female';
    address: string | null;
    postal_code: string | null; // 직원 거주지 우편번호
    latitude: number | null;    // 직원 거조지 위도
    longitude: number | null;   // 직원 거주지 경도
    notes: string | null;
    test_password: string | null;
    is_active: boolean;
    default_daily_wage?: number; // 기본 일당
    created_at: string;
}

export interface Expenditure {
    id: string;
    farm_id: string;
    main_category: string; // [bkit] 대분류 (농작관리, 인건비, 가계생활)
    sub_category: string;  // [bkit] 소분류 (세부 항목)
    category: string;      // Legacy
    amount: number;
    notes: string | null;
    expense_date: string;
    payment_method: '현금' | '카드' | string; // [bkit] 결제 수단 추가
    created_at: string;
}

export interface Client {
    id: string;
    farm_id: string;
    name: string;
    contact: string | null;
    address: string | null;
    client_type: 'nonghyup' | 'factory' | 'individual' | 'market';
    is_vip: boolean;
    default_price: number | null;
    notes: string | null;
    created_at: string;
}

export interface Partner {
    id: string;
    farm_id: string;
    business_number: string | null;
    company_name: string;
    ceo_name: string | null;
    company_contact: string | null;
    manager_name: string | null;
    manager_contact: string | null;
    manager_email: string | null;
    fax_number: string | null;
    hq_address: string | null;
    hq_detail_address: string | null; // 본사 상세 주소
    hq_postal_code: string | null; // 시나리오 C: 본사 우편번호
    hq_latitude: number | null;    // 시나리오 C: 본사 위도
    hq_longitude: number | null;   // 시나리오 C: 본사 경도
    delivery_address: string | null;
    delivery_detail_address: string | null; // 납품 상세 주소
    delivery_postal_code: string | null; // 시나리오 C: 납품지 우편번호
    delivery_latitude: number | null;    // 시나리오 C: 납품지 위도
    delivery_longitude: number | null;   // 시나리오 C: 납품지 경도
    settlement_type: string;
    payment_method: string | null;
    default_unit_price?: number; // 기본 납품 단가
    special_notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface Customer {
    id: string;
    farm_id: string;
    name: string;
    contact: string | null;
    address: string | null;
    postal_code: string | null; // 시나리오 C: 우편번호
    detail_address: string | null; // 상세 주소
    latitude: number | null;    // 시나리오 C: 위도 (숨김 자산)
    longitude: number | null;   // 시나리오 C: 경도 (숨김 자산)
    is_vip: boolean;
    gender: string | null; // 고객 성별 (남/여/미지정)
    special_notes: string | null;
    created_at: string;
}

// ============================================
// 일일 인력 현황 (알바/용역 지급)
// ============================================
export interface LaborCost {
    id: string;
    farm_id: string;
    work_date: string;
    source: '인력사무소' | '개별직접';
    agency_name: string | null;
    grade: string;
    headcount: number;
    daily_wage: number;
    tip: number;
    payment_method: '현금' | '계좌이체' | '카드';
    work_type: string | null;
    notes: string | null;
    expenditure_id: string | null;
    created_at: string;
}
