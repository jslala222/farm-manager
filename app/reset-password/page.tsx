"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [ready, setReady] = useState(false);
    const [linkError, setLinkError] = useState("");

    useEffect(() => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");
        const errorCode = params.get("error_code");

        if (errorCode === "otp_expired" || params.get("error") === "access_denied") {
            setLinkError("링크가 만료되었습니다. 비밀번호 찾기를 다시 요청해주세요.");
            return;
        }

        if (type === "recovery" && accessToken && refreshToken) {
            supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
                .then(({ error }) => {
                    if (error) {
                        setLinkError("링크가 만료되었습니다. 비밀번호 찾기를 다시 요청해주세요.");
                    } else {
                        setReady(true);
                        window.history.replaceState(null, "", window.location.pathname);
                    }
                });
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") setReady(true);
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { toast.error("비밀번호가 일치하지 않습니다."); return; }
        if (password.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다."); return; }
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) { toast.error("변경 실패: " + error.message); }
        else { setDone(true); toast.success("비밀번호가 변경되었습니다!"); }
        setLoading(false);
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg-farm.jpg')" }} />
            <div className="relative z-10 w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-xl font-bold text-white drop-shadow-lg">농장 관리 시스템</h1>
                    <div className="w-12 h-0.5 bg-red-600 mx-auto mt-2 rounded-full" />
                </div>
                <div className="bg-gray-900/85 backdrop-blur-md border border-gray-700/60 rounded-2xl p-6 shadow-2xl">
                    {done ? (
                        <div className="text-center space-y-4">
                            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                            <p className="text-white font-bold">비밀번호 변경 완료!</p>
                            <a href="/login" className="block w-full text-center bg-red-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                                로그인하기
                            </a>
                        </div>
                    ) : linkError ? (
                        <div className="text-center space-y-4">
                            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                            <p className="text-white font-bold">링크 만료</p>
                            <p className="text-gray-400 text-sm">{linkError}</p>
                            <a href="/forgot-password" className="block w-full text-center bg-red-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.35)]">비밀번호 찾기 다시 요청</a>
                            <a href="/login" className="block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors">로그인으로 돌아가기</a>
                        </div>
                    ) : !ready ? (
                        <div className="text-center py-8 space-y-2">
                            <Lock className="w-10 h-10 text-gray-600 mx-auto" />
                            <p className="text-gray-400 text-sm">링크 확인 중...</p>
                            <p className="text-gray-500 text-xs">이메일의 비밀번호 재설정 링크를 클릭하셨나요?</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <p className="text-white font-bold text-center">새 비밀번호 설정</p>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">새 비밀번호</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                                        placeholder="최소 6자 이상"
                                        className="w-full pl-10 pr-10 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" required />
                                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">비밀번호 확인</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type={showPw ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                                        placeholder="비밀번호 다시 입력"
                                        className={`w-full pl-10 pr-4 py-3 bg-gray-800/80 border rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:ring-2 transition-all ${confirm && password !== confirm ? "border-red-500 focus:ring-red-500/20" : "border-gray-700 focus:border-red-500 focus:ring-red-500/20"}`} required />
                                </div>
                                {confirm && password !== confirm && <p className="text-red-400 text-xs mt-1">비밀번호가 일치하지 않습니다</p>}
                            </div>
                            <button type="submit" disabled={loading || password !== confirm}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                                {loading ? "변경 중..." : "비밀번호 변경하기"}
                            </button>
                            <a href="/login" className="flex items-center justify-center text-xs text-gray-500 hover:text-gray-300 transition-colors">로그인으로 돌아가기</a>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
