import { createBrowserClient } from '@supabase/ssr';

// [bkit 진단] 초기 연결 상태 로그 (사장님 콘솔 확인용)
if (typeof window !== 'undefined') {
    console.log("🍓 [bkit] 수파베이스 통신 준비 중...");
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error("❌ [bkit] 치명적 오류: 환경 변수(URL/KEY)가 로드되지 않았습니다!");
    } else {
        console.log("🔗 접속 서버:", process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 25) + "...");
        console.log("✅ [bkit] 수파베이스 클라이언트 초기화 완료");
    }
}

export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// 타입 정의
export type UserRole = 'admin' | 'owner';

export interface Profile {
    id: string;
    role: UserRole;
    full_name: string | null;
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
    is_active: boolean;
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
    sale_type: 'nonghyup' | 'jam' | 'etc';
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
    delivery_method?: 'direct' | 'courier' | 'nonghyup';
    shipping_cost?: number;
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
