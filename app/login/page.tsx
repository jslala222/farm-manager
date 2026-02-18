"use client";

import { useState } from "react";
import { Sprout } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMsg("로그인 시도 중...");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        if (!email || !password) {
            alert("이메일과 비밀번호를 입력해주세요.");
            setLoading(false);
            setMsg("");
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                alert("로그인 실패: " + error.message);
                setMsg("에러: " + error.message);
            } else if (data.user) {
                alert("로그인 성공! 이동합니다.");
                window.location.href = "/";
            }
        } catch (err: any) {
            alert("오류 발생: " + err.message);
            setMsg("오류: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const testSupabase = async () => {
        setMsg("Supabase 연결 확인 중...");
        try {
            const { data, error } = await supabase.from('profiles').select('count');
            if (error) {
                alert("Supabase 연결 실패 (키 확인 필요): " + error.message);
            } else {
                alert("Supabase 연결 성공!");
            }
        } catch (err: any) {
            alert("연결 시도 중 치명적 오류: " + err.message);
        }
        setMsg("");
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl mb-3">
                        <Sprout className="w-6 h-6 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold">딸기농장 관리</h1>
                    <p className="text-gray-500 text-sm">로그인 후 사용 가능합니다</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Email</label>
                        <input
                            name="email"
                            type="email"
                            placeholder="farm@example.com"
                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-gray-900"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Password</label>
                        <input
                            name="password"
                            type="password"
                            placeholder="••••••"
                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-gray-900"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? "처리 중..." : "로그인"}
                    </button>

                    {msg && <p className="text-center text-sm font-medium text-red-600">{msg}</p>}
                </form>

                <div className="mt-8 flex flex-col gap-3">
                    <button
                        onClick={testSupabase}
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                        데이터베이스 연결 상태 확인
                    </button>
                    <a href="/register" className="text-center text-sm text-red-600 font-bold hover:underline">
                        계정이 없으신가요? 회원가입 신청
                    </a>
                </div>
            </div>
        </div>
    );
}
