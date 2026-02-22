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
    initialize: (force?: boolean) => Promise<void>;
    setFarm: (farm: Farm) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: null,
    farm: null,
    loading: false,
    initialized: false,

    setFarm: (farm: Farm) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('sfm_last_farm', JSON.stringify(farm));
        }
        set({ farm });
    },

    initialize: async (force = false) => {
        if (get().initialized && !force) return;
        set({ loading: true });

        // 1. 세션 확인
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            // 2. 로컬 캐시 확인 (빠른 렌더링을 위해)
            const cachedFarm = typeof window !== 'undefined' ? localStorage.getItem('sfm_last_farm') : null;
            if (cachedFarm) {
                try {
                    set({ farm: JSON.parse(cachedFarm) });
                } catch (e) {
                    console.error("Cache parse error", e);
                }
            }

            await loadUserData(session.user, set);
        }

        set({ initialized: true, loading: false });

        // 실시간 상태 변경 감지
        supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                await loadUserData(session.user, set);
            } else {
                if (typeof window !== 'undefined') localStorage.removeItem('sfm_last_farm');
                set({ user: null, profile: null, farm: null });
            }
        });
    },

    signIn: async (email: string, password: string) => {
        set({ loading: true });
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            set({ loading: false });
            return { error: error.message };
        }
        if (data.user) await loadUserData(data.user, set);
        set({ loading: false });
        return { error: null };
    },

    signOut: async () => {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error("SignOut error, forcing local clear:", e);
        }
        if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
            // 모든 쿠키 만료 처리 시도 (문자열 기반)
            document.cookie.split(";").forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
        }
        set({ user: null, profile: null, farm: null });
    },
}));

async function loadUserData(user: User, set: any) {
    console.log("[Auth] Loading user data for:", user.email);

    // 프로필 조회 (타임아웃 방지를 위해 각각 예외 처리)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error("[Auth] Profile Load error:", profileError);
        // 프로필이 없는 경우에도 초기화는 완료된 것으로 처리하여 무한 로딩 방지
    }

    // 농장 조회
    let farm = null;
    try {
        // [수정] 관리자이고 이미 선택된 농장이 있다면 유지 시도
        const cachedFarm = typeof window !== 'undefined' ? localStorage.getItem('sfm_last_farm') : null;
        let lastFarmId = null;
        if (cachedFarm) {
            try { lastFarmId = JSON.parse(cachedFarm).id; } catch (e) { }
        }

        if (lastFarmId) {
            const { data } = await supabase.from('farms').select('*').eq('id', lastFarmId).maybeSingle();
            if (data) farm = data;
        }

        // 선택된 농장이 없거나 정보를 가져오지 못한 경우에만 소유 농장 확인
        if (!farm) {
            const { data: myOwnedFarm } = await supabase
                .from('farms')
                .select('*')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (myOwnedFarm) {
                farm = myOwnedFarm;
            } else if (profile?.role === 'admin') {
                const { data } = await supabase.from('farms').select('*').limit(1).maybeSingle();
                farm = data;
            }
        }
    } catch (err) {
        console.error("[Auth] Unexpected farm fetch error:", err);
    }

    if (!farm) {
        console.warn("[Auth] Warning: No farm found for user", user.email);
    } else {
        console.log("[Auth] Load complete. Farm found:", farm.farm_name);
        // 캐시 업데이트
        if (typeof window !== 'undefined') {
            localStorage.setItem('sfm_last_farm', JSON.stringify(farm));
        }
    }

    set({ user, profile, farm });
}
