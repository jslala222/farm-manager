"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMsg("로그인 시도 중...");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        if (!email || !password) {
            toast.error("이메일과 비밀번호를 입력해주세요.");
            setLoading(false);
            setMsg("");
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                toast.error("로그인 실패: " + error.message);
                setMsg("에러: " + error.message);
            } else if (data.user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();

                if (profile?.role !== 'admin') {
                    const { data: farm } = await supabase.from('farms').select('is_active').eq('owner_id', data.user.id).maybeSingle();

                    if (!farm || !farm.is_active) {
                        await supabase.auth.signOut();
                        toast.error("승인 대기 중입니다.\n\n사장님(관리자)의 승인이 완료된 후 로그인이 가능합니다. 잠시만 기다려 주세요.");

                        setMsg("사장님 승인 대기 중 (미승인 계정)");
                        setLoading(false);
                        return;
                    }
                }

                toast.success("로그인 성공! 대시보드로 이동합니다.");
                window.location.href = "/";
            }
        } catch (err: any) {
            toast.error("오류 발생: " + err.message);
            setMsg("오류: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
            {/* 배경 이미지 + 오버레이 */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/bg-farm.jpg')" }}
            />
            <div className="relative z-10 w-full max-w-sm">
                {/* 로그 영역 */}
                <div className="text-center mb-8">
<h1 className="text-xl font-bold text-white drop-shadow-lg">농장 관리 시스템</h1>
                    <div className="w-12 h-0.5 bg-red-600 mx-auto mt-2 rounded-full" />
                </div>

                {/* 카드 */}
                <div className="bg-gray-900/85 backdrop-blur-md border border-gray-700/60 rounded-2xl p-6 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* 이메일 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">
                                이메일
                            </label>
                            <input
                                name="email"
                                type="email"
                                placeholder="farm@example.com"
                                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                required
                            />
                        </div>

                        {/* 비밀번호 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">
                                비밀번호
                            </label>
                            <div className="relative">
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 pr-11 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* 로그인 버튼 */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm tracking-wide hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.35)] hover:shadow-[0_0_28px_rgba(220,38,38,0.5)] mt-2"
                        >
                            {loading ? "처리 중..." : "로그인하기"}
                        </button>

                        {msg && (
                            <p className="text-center text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3">
                                {msg}
                            </p>
                        )}
                    </form>

                    {/* 하단 링크 */}
                    <div className="mt-5 pt-4 border-t border-gray-700/50 flex items-center justify-center gap-4 text-sm font-bold text-gray-300">
                        <a href="/forgot-password" className="hover:text-red-400 transition-colors">
                            비밀번호 찾기
                        </a>
                        <span className="text-gray-700">·</span>
                        <a href="/register" className="hover:text-red-400 transition-colors">
                            계정 신청
                        </a>
                    </div>
                </div>

            </div>
        </div>
    );
}
