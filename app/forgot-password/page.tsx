"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + "/reset-password",
        });
        if (error) {
            toast.error("전송 실패: " + error.message);
        } else {
            setSent(true);
        }
        setLoading(false);
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/bg-farm.jpg')" }}
            />
            <div className="relative z-10 w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-xl font-bold text-white drop-shadow-lg">농장 관리 시스템</h1>
                    <div className="w-12 h-0.5 bg-red-600 mx-auto mt-2 rounded-full" />
                </div>

                <div className="bg-gray-900/85 backdrop-blur-md border border-gray-700/60 rounded-2xl p-6 shadow-2xl">
                    {sent ? (
                        <div className="text-center space-y-4">
                            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                            <p className="text-white font-bold">이메일을 확인하세요</p>
                            <p className="text-gray-400 text-sm">
                                <span className="text-red-400 font-bold">{email}</span>으로<br />
                                비밀번호 재설정 링크를 전송했습니다.<br />
                                메일이 안 오면 스팸메일도 확인해 주세요.
                            </p>
                            <a href="/login"
                                className="block w-full text-center bg-gray-800 text-gray-300 py-3 rounded-xl text-sm font-bold hover:bg-gray-700 transition-all">
                                로그인으로 돌아가기
                            </a>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="text-center mb-2">
                                <p className="text-white font-bold text-base">비밀번호 찾기</p>
                                <p className="text-gray-400 text-xs mt-1">가입시 사용한 이메일을 입력하세요</p>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">
                                    이메일
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="farm@example.com"
                                        className="w-full pl-10 pr-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.35)]"
                            >
                                {loading ? "전송 중..." : "재설정 링크 전송"}
                            </button>
                            <a href="/login"
                                className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors pt-1">
                                <ArrowLeft className="w-3 h-3" />로그인으로 돌아가기
                            </a>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
