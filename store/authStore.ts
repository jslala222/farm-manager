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
        set({ loading: true });
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await loadUserData(session.user, set);
        }
        set({ initialized: true, loading: false });

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
    console.log("[Auth] Loading user data for:", user.email);

    // 프로필 조회 (타임아웃 방지를 위해 각각 예외 처리)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error("[Auth] Profile Load error:", profileError);
    }

    // 농장 조회
    let farm = null;
    try {
        if (profile?.role === 'owner') {
            const { data, error } = await supabase
                .from('farms')
                .select('*')
                .eq('owner_id', user.id)
                .single();
            if (error) console.error("[Auth] Farm(owner) error:", error);
            farm = data;
        } else if (profile?.role === 'admin') {
            console.log("[Auth] Admin detected, fetching first farm...");
            const { data, error } = await supabase
                .from('farms')
                .select('*')
                .limit(1)
                .maybeSingle();
            if (error) console.error("[Auth] Farm(admin) error:", error);
            farm = data;
        }
    } catch (err) {
        console.error("[Auth] Unexpected farm fetch error:", err);
    }

    console.log("[Auth] Load complete. Farm found:", farm ? farm.farm_name : "None");
    set({ user, profile, farm });
}
