"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다."); return; }
        if (password !== confirm) { toast.error("비밀번호가 일치하지 않습니다."); return; }
        setLoading(true);
        try {
            const res = await fetch("/api/user/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            toast.success("✅ 비밀번호가 변경되었습니다!");
            setTimeout(() => { window.location.href = "/"; }, 800);
        } catch (e: any) {
            toast.error("변경 실패: " + e.message);
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg-farm.jpg')" }} />
            <div className="relative z-10 w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-[1.625rem] font-bold text-white drop-shadow-lg">농장 관리 시스템</h1>
                    <p className="text-gray-400 text-sm mt-1">(Farm-manager System)</p>
                    <div className="w-12 h-0.5 bg-red-600 mx-auto mt-2 rounded-full" />
                </div>
                <div className="bg-gray-900/85 backdrop-blur-md border border-gray-700/60 rounded-2xl p-6 shadow-2xl space-y-5">
                    <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                        <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0" />
                        <div>
                            <p className="text-orange-300 font-bold text-sm">비밀번호 변경 필요</p>
                            <p className="text-orange-400/70 text-xs">임시 비밀번호로 로그인되었습니다. 새 비밀번호를 설정해 주세요.</p>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                            {password.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-2">
                                    {[1,2,3,4,5,6].map(i => (
                                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${password.length >= i ? password.length >= 10 ? "bg-emerald-500" : password.length >= 6 ? "bg-yellow-400" : "bg-red-500" : "bg-gray-700"}`} />
                                    ))}
                                    <span className={`text-[10px] font-bold ml-1 ${password.length >= 6 ? "text-emerald-400" : "text-red-400"}`}>
                                        {password.length < 6 ? `${6 - password.length}자 더` : "안전"}
                                    </span>
                                </div>
                            )}
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
                        <button type="submit" disabled={loading || password.length < 6 || password !== confirm}
                            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                            {loading ? "변경 중..." : "비밀번호 변경하기"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
