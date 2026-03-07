"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Sprout, Eye, EyeOff } from "lucide-react";
import { Suspense } from "react";

function CallbackContent() {
    const searchParams = useSearchParams();
    const type = searchParams.get("type");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);

    useEffect(() => {
        // Supabase가 URL hash에서 session을 자동 파싱함
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                setSessionReady(true);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            toast.error("비밀번호는 6자 이상이어야 합니다.");
            return;
        }
        if (password !== confirm) {
            toast.error("비밀번호가 일치하지 않습니다.");
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
                toast.error("변경 실패: " + error.message);
            } else {
                toast.success("비밀번호가 변경되었습니다!");
                setDone(true);
                setTimeout(() => { window.location.href = "/login"; }, 2000);
            }
        } catch (err: any) {
            toast.error("오류: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (type !== "recovery") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-gray-600">잘못된 접근입니다.</p>
                    <a href="/login" className="text-red-600 font-bold hover:underline">로그인으로 이동</a>
                </div>
            </div>
        );
    }

    if (done) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="text-5xl">✅</div>
                    <h2 className="text-xl font-black text-gray-900">비밀번호 변경 완료!</h2>
                    <p className="text-sm text-gray-600">잠시 후 로그인 페이지로 이동합니다...</p>
                </div>
            </div>
        );
    }

    if (!sessionReady) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-gray-600 font-bold">인증 처리 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mb-1">
                            <Sprout className="w-7 h-7 text-red-600" />
                        </div>
                        <h1 className="text-xl font-black text-gray-900">새 비밀번호 설정</h1>
                        <p className="text-sm text-gray-500">새로운 비밀번호를 입력해주세요.</p>
                    </div>

                    <form onSubmit={handleReset} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase tracking-wide">새 비밀번호</label>
                            <div className="relative">
                                <input
                                    type={showPw ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="6자 이상"
                                    className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-red-400 text-gray-900 font-bold pr-12 transition-all"
                                    required
                                />
                                <button type="button" onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase tracking-wide">비밀번호 확인</label>
                            <input
                                type={showPw ? "text" : "password"}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="다시 입력"
                                className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-red-400 text-gray-900 font-bold transition-all"
                                required
                            />
                        </div>
                        {password && confirm && password !== confirm && (
                            <p className="text-xs text-red-500 font-bold">비밀번호가 일치하지 않습니다.</p>
                        )}
                        <button
                            type="submit"
                            disabled={loading || !sessionReady}
                            className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-base hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-red-100"
                        >
                            {loading ? "변경 중..." : "비밀번호 변경"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" /></div>}>
            <CallbackContent />
        </Suspense>
    );
}
