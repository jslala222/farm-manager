import { create } from 'zustand';
import { supabase, Profile, Farm } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
    user: User | null;
    profile: Profile | null;
    farm: Farm | null;
    loading: boolean;
    initialized: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    farm: null,
    loading: false,
    initialized: false,

    initialize: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await loadUserData(session.user, set);
        }
        set({ initialized: true });

        // Auth 상태 변경 감지
        supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                await loadUserData(session.user, set);
            } else {
                set({ user: null, profile: null, farm: null });
            }
        });
    },

    signIn: async (email: string, password: string) => {
        set({ loading: true });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        set({ loading: false });
        if (error) return { error: error.message };
        return { error: null };
    },

    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, profile: null, farm: null });
    },
}));

async function loadUserData(user: User, set: any) {
    // 프로필 조회
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    // 농장 조회
    // 1. 농장주(owner)인 경우 본인 농장 조회
    // 2. 관리자(admin)인 경우 시스템 관리 및 테스트를 위해 첫 번째 농장 로드
    let farm = null;
    if (profile?.role === 'owner') {
        const { data } = await supabase
            .from('farms')
            .select('*')
            .eq('owner_id', user.id)
            .single();
        farm = data;
    } else if (profile?.role === 'admin') {
        const { data } = await supabase
            .from('farms')
            .select('*')
            .limit(1)
            .maybeSingle();
        farm = data;
    }

    set({ user, profile, farm });
}
