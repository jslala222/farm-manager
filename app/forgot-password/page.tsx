"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            toast.error("이메일을 입력해주세요.");
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
            });
            if (error) {
                toast.error("발송 실패: " + error.message);
            } else {
                setSent(true);
            }
        } catch (err: any) {
            toast.error("오류: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
                <div className="w-full max-w-sm text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl mb-2">
                        <Mail className="w-8 h-8 text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white mb-2">이메일을 확인해주세요</h1>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            <span className="font-bold text-red-400">{email}</span>으로<br />
                            비밀번호 재설정 링크를 발송했습니다.<br />
                            메일함을 확인하고 링크를 클릭해주세요.
                        </p>
                    </div>
                    <p className="text-xs text-gray-600">스팸함도 확인해보세요. 5분 이내 미수신 시 다시 시도해주세요.</p>
                    <a href="/login" className="inline-block text-sm text-red-400 hover:text-red-300 font-bold transition-colors">
                        로그인으로 돌아가기
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <a href="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 font-medium transition-colors mb-6">
                    <ArrowLeft className="w-4 h-4" /> 로그인으로 돌아가기
                </a>

                {/* 로고 영역 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-red-600/10 border border-red-600/20 rounded-2xl mb-4">
                        <span className="text-2xl">🍓</span>
                    </div>
                    <h1 className="text-xl font-bold text-white">비밀번호 찾기</h1>
                    <div className="w-12 h-0.5 bg-red-600 mx-auto mt-2 rounded-full" />
                </div>

                {/* 카드 */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
                    <p className="text-sm text-gray-400 mb-5 text-center leading-relaxed">
                        가입 시 사용한 이메일을 입력하면<br />재설정 링크를 보내드립니다.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">
                                이메일
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="farm@example.com"
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm tracking-wide hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.35)] hover:shadow-[0_0_28px_rgba(220,38,38,0.5)]"
                        >
                            {loading ? "발송 중..." : "재설정 링크 발송"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
