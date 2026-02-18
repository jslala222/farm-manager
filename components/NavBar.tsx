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
    ShieldCheck
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState } from "react";

const navItems = [
    { href: "/", label: "대시보드", icon: LayoutDashboard },
    { href: "/harvest", label: "수확 기록", icon: Sprout },
    { href: "/sales", label: "판매 기록", icon: ShoppingCart },
    { href: "/expenses", label: "지출 기록", icon: Receipt },
    { href: "/attendance", label: "출근 체크", icon: UserCheck },
    { href: "/workers", label: "근로자 관리", icon: Users },
    { href: "/settings", label: "설정", icon: Settings },
];

export default function NavBar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile, farm, initialize, signOut } = useAuthStore();
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => { initialize(); }, []);

    if (pathname === "/login" || pathname === "/register") return null;
    if (!user) return null;

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
                        <div>
                            <p className="font-bold text-gray-900 text-sm leading-tight">딸기농장 관리</p>
                            <p className="text-xs text-gray-400 truncate max-w-[120px]">{farm?.farm_name || profile?.full_name}</p>
                        </div>
                    </div>
                </div>

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
            <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-red-100 p-1.5 rounded-lg">
                        <Sprout className="w-4 h-4 text-red-600" />
                    </div>
                    <span className="font-bold text-gray-900 text-sm">{farm?.farm_name || "딸기농장 관리"}</span>
                </div>
                <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-gray-100">
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </header>

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

            {/* 모바일 하단 탭바 (주요 메뉴 4개) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 flex">
                {navItems.slice(0, 4).map(({ href, label, icon: Icon }) => (
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
