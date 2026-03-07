"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle, KeyRound } from "lucide-react";

type Step = "email" | "otp" | "password" | "done";

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(5);

    // 완료 후 5초 카운트다운 → /login 이동
    useEffect(() => {
        if (step !== "done") return;
        setCountdown(5);
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    window.location.href = '/login';
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [step]);

    // 1단계: 이메일 입력 → OTP 발송
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false },
        });
        setLoading(false);
        if (error) { toast.error("인증 코드 발송 실패: " + error.message); }
        else { toast.success("인증 코드가 이메일로 발송되었습니다."); setStep("otp"); }
    };

    // 2단계: OTP 코드 입력 → 인증
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: "email" });
        setLoading(false);
        if (error) { toast.error("코드가 잘못되었습니다: " + error.message); }
        else { setStep("password"); }
    };

    // 3단계: 새 비밀번호 설정
    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { toast.error("비밀번호가 일치하지 않습니다."); return; }
        if (password.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다."); return; }
        setLoading(true);

        // 10초 타임아웃 (LTE 불안정 대응)
        const timeout = new Promise<{ error: Error }>(resolve =>
            setTimeout(() => resolve({ error: new Error("timeout") }), 10000)
        );
        const result = await Promise.race([
            supabase.auth.updateUser({ password }),
            timeout
        ]);

        const error = (result as any).error;
        if (error) {
            setLoading(false);
            if (error.message === "timeout") {
                toast.error("네트워크가 느립니다. 변경된 비밀번호로 로그인해보세요.");
                setTimeout(() => { window.location.href = '/login'; }, 2000);
            } else {
                toast.error("비밀번호 변경 실패: " + error.message);
            }
        } else {
            setLoading(false);
            setStep("done"); // signOut 없이 바로 완료
        }
    };

    const stepNum: Record<Step, string> = { email: "1/3", otp: "2/3", password: "3/3", done: "" };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg-farm.jpg')" }} />
            <div className="relative z-10 w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-xl font-bold text-white drop-shadow-lg">농장 관리 시스템</h1>
                    <div className="w-12 h-0.5 bg-red-600 mx-auto mt-2 rounded-full" />
                </div>
                <div className="bg-gray-900/85 backdrop-blur-md border border-gray-700/60 rounded-2xl p-6 shadow-2xl">
                    {step !== "done" && (
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-white font-bold text-base">비밀번호 찾기</p>
                            <span className="text-xs text-gray-500 font-bold">{stepNum[step]}</span>
                        </div>
                    )}

                    {/* 1단계: 이메일 */}
                    {step === "email" && (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <p className="text-gray-400 text-xs">가입 시 사용한 이메일로 인증 코드를 발송합니다.</p>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">이메일</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                        placeholder="farm@example.com"
                                        className="w-full pl-10 pr-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" required />
                                </div>
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                                {loading ? "발송 중..." : "인증 코드 발송"}
                            </button>
                            <a href="/login" className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors pt-1">
                                <ArrowLeft className="w-3 h-3" />로그인으로 돌아가기
                            </a>
                        </form>
                    )}

                    {/* 2단계: OTP 코드 */}
                    {step === "otp" && (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <p className="text-gray-400 text-xs"><span className="text-red-400 font-bold">{email}</span>으로 전송된 <span className="text-white font-bold">8자리 인증 코드</span>를 입력하세요.</p>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">인증 코드</label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type="text" inputMode="numeric" value={otp}
                                        onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                                        placeholder="8자리 입력" maxLength={8}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 tracking-[0.35em] text-center font-black text-2xl" required />
                                </div>
                            </div>
                            <button type="submit" disabled={loading || otp.length !== 8}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                                {loading ? "인증 중..." : "코드 확인"}
                            </button>
                            <button type="button" onClick={() => setStep("email")}
                                className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1">
                                이메일 재입력
                            </button>
                        </form>
                    )}

                    {/* 3단계: 새 비밀번호 */}
                    {step === "password" && (
                        <form onSubmit={handleSetPassword} className="space-y-4">
                            <p className="text-gray-400 text-xs">사용할 새 비밀번호를 입력하세요.</p>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">새 비밀번호</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type={showPw ? "text" : "password"} value={password}
                                        onChange={e => setPassword(e.target.value)} placeholder="최소 6자 이상"
                                        className="w-full pl-10 pr-10 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" required />
                                    <button type="button" onClick={() => setShowPw(!showPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">비밀번호 확인</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type={showPw ? "text" : "password"} value={confirm}
                                        onChange={e => setConfirm(e.target.value)} placeholder="비밀번호 다시 입력"
                                        className="w-full pl-10 pr-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" required />
                                </div>
                                {confirm && password !== confirm && <p className="text-red-400 text-xs mt-1">비밀번호가 일치하지 않습니다</p>}
                            </div>
                            <button type="submit" disabled={loading || password !== confirm || password.length < 6}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                                {loading ? "저장 중..." : "비밀번호 변경 완료"}
                            </button>
                        </form>
                    )}

                    {/* 완료 */}
                    {step === "done" && (
                        <div className="text-center space-y-5">
                            <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
                            <div>
                                <p className="text-white font-black text-lg">비밀번호 변경 완료!</p>
                                <p className="text-gray-400 text-sm mt-1">새 비밀번호로 로그인해주세요.</p>
                            </div>
                            <div className="bg-gray-800/60 rounded-xl px-4 py-3">
                                <p className="text-gray-400 text-xs">로그인 화면으로 이동합니다...</p>
                                <p className="text-white font-black text-3xl mt-1">{countdown}<span className="text-gray-500 text-sm font-normal">초</span></p>
                            </div>
                            <button onClick={() => { window.location.href = '/login'; }}
                                className="block w-full text-center bg-red-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-500 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                                지금 바로 로그인하기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
