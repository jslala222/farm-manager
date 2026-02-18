import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    notes: string | null;
    is_active: boolean;
    created_at: string;
}

export interface FarmHouse {
    id: string;
    farm_id: string;
    house_number: number;
    house_name: string | null;
    is_active: boolean;
    created_at: string;
}

export interface HarvestRecord {
    id: string;
    farm_id: string;
    house_number: number;
    grade: 'sang' | 'jung' | 'ha';
    quantity: number;
    recorded_at: string;
}

export interface SalesRecord {
    id: string;
    farm_id: string;
    sale_type: 'nonghyup' | 'jam' | 'etc';
    quantity: number;
    price: number | null;
    customer_name: string | null;
    address: string | null;
    recorded_at: string;
}

export interface AttendanceRecord {
    id: string;
    farm_id: string;
    work_date: string;
    worker_id: string | null;
    worker_name: string;
    role: 'family' | 'foreign' | 'part_time';
    is_present: boolean;
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
    notes: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Expenditure {
    id: string;
    farm_id: string;
    category: string;
    amount: number;
    notes: string | null;
    expense_date: string;
    created_at: string;
}
