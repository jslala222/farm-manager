"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Sprout,
    Users,
    ShoppingCart,
    Settings,
    LayoutDashboard,
    LogOut,
    Menu,
    X,
    UserCheck,
    Receipt,
    ShieldCheck,
    Building2,
    Calculator,
    RefreshCcw,
    AlignLeft
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState } from "react";
import { supabase, Farm } from "@/lib/supabase";

const navItems = [
    { href: "/", label: "대시보드", icon: LayoutDashboard },
    { href: "/finance", label: "통합 결산", icon: Calculator },
    { href: "/harvest", label: "수확 관리", icon: Sprout },
    { href: "/sales", label: "판매/출하", icon: ShoppingCart },
    { href: "/expenses", label: "지출 관리", icon: Receipt },
    { href: "/workers", label: "인력 관리", icon: Users },
    { href: "/clients", label: "거래처/고객", icon: Building2 },
    { href: "/settings", label: "설정", icon: Settings },
];

export default function NavBar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile, farm, initialize, signOut, setFarm } = useAuthStore();
    const [showFarmSwitcher, setShowFarmSwitcher] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [farms, setFarms] = useState<Farm[]>([]);

    // [bkit] 긴급 연결 복구 로직
    const handleEmergencyReset = async () => {
        if (!confirm("DB 연결 세션과 로컬 캐시를 모두 초기화하고 다시 로그인하시겠습니까?")) return;
        localStorage.clear(); // 모든 로컬 데이터 삭제
        sessionStorage.clear();
        await signOut();
        window.location.href = '/login';
    };

    useEffect(() => {
        initialize();
        if (profile?.role === 'admin') {
            fetchFarms();
        }
    }, [profile?.role]);

    const fetchFarms = async () => {
        const { data } = await supabase.from('farms').select('*').order('farm_name');
        setFarms(data ?? []);
    };

    if (pathname === "/login" || pathname === "/register" || pathname === "/pending") return null;
    if (!user) return null;

    // 추가 보안: 농장 비활성이고 관리자 아닐 때 숨김
    if (profile?.role !== 'admin' && farm && !farm.is_active) return null;

    const handleSignOut = async () => {
        await signOut();
        router.push("/login");
    };

    const allNavItems = profile?.role === 'admin'
        ? [...navItems, { href: "/admin", label: "관리자 도구", icon: ShieldCheck }]
        : navItems;

    return (
        <>
            {/* PC/태블릿 사이드바 */}
            <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-100 flex-col z-40 shadow-sm">
                <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="bg-red-100 p-2 rounded-xl">
                            <Sprout className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm leading-tight truncate">농장관리</p>
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{farm?.farm_name || profile?.full_name}</p>
                        </div>
                        {profile?.role === 'admin' && (
                            <button
                                onClick={() => setShowFarmSwitcher(!showFarmSwitcher)}
                                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Settings className="w-4 h-4 text-gray-400" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 농장 전환 메뉴 (관리자용) */}
                {showFarmSwitcher && profile?.role === 'admin' && (
                    <div className="mx-3 mt-3 p-2 bg-gray-50 rounded-xl space-y-1 max-h-48 overflow-y-auto border border-gray-100 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] font-black text-gray-400 px-2 py-1 uppercase">농장 전환</p>
                        {farms.map(f => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    setFarm(f);
                                    setShowFarmSwitcher(false);
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold transition-all
                                    ${farm?.id === f.id ? 'bg-red-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                {f.farm_name}
                            </button>
                        ))}
                    </div>
                )}

                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {allNavItems.map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${pathname === href
                                    ? 'bg-red-50 text-red-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                            <Icon className="w-4 h-4" />
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="p-3 border-t border-gray-100">
                    <button onClick={handleSignOut}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full">
                        <LogOut className="w-4 h-4" />
                        로그아웃
                    </button>
                </div>
            </aside>

            <div className="hidden md:block w-56 flex-shrink-0" />

            {/* 모바일 상단 헤더 */}
            <nav className="md:hidden bg-white border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2" onClick={() => window.location.href = '/'}>
                        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-100 text-white font-black text-xl">
                            H
                        </div>
                        <h1 className="text-lg font-black text-gray-900 tracking-tight">행복한 희라딸기</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* [bkit] 긴급 연결 복구 버튼 */}
                        <button
                            onClick={handleEmergencyReset}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                            title="연결 복구"
                        >
                            <RefreshCcw size={18} />
                        </button>

                        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-gray-500 hover:bg-gray-50 rounded-full">
                            {mobileOpen ? <X size={20} /> : <AlignLeft size={20} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* 모바일 드로어 메뉴 */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <span className="font-bold text-gray-900">전체 메뉴</span>
                            <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                            {allNavItems.map(({ href, label, icon: Icon }) => (
                                <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all
                    ${pathname === href ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    <Icon className="w-5 h-5" />
                                    {label}
                                </Link>
                            ))}
                        </nav>
                        <div className="p-3 border-t border-gray-100">
                            <button onClick={handleSignOut}
                                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full">
                                <LogOut className="w-5 h-5" />
                                로그아웃
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 모바일 하단 탭바 (주요 메뉴 5개로 확장) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 flex">
                {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}
                        className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors
              ${pathname === href ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'}`}>
                        <Icon className="w-5 h-5" />
                        {label.replace(" 기록", "").replace(" 체크", "")}
                    </Link>
                ))}
            </nav>

            <div className="md:hidden h-14" />
        </>
    );
}
