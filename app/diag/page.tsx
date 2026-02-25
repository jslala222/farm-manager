"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DiagPage() {
    const [status, setStatus] = useState<any[]>([]);
    const [envCheck, setEnvCheck] = useState<any>({});

    useEffect(() => {
        const check = async () => {
            const results: any[] = [];

            // 1. Env Var Check (Internal)
            setEnvCheck({
                url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "OK" : "MISSING",
                key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "OK" : "MISSING",
            });

            // 2. Network Ping
            results.push({ name: "Network Access", status: "Testing..." });
            try {
                const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/", {
                    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }
                });
                results[0] = { name: "Network Access", status: res.ok ? "✅ OK" : "❌ FAILED (" + res.status + ")" };
            } catch (e: any) {
                results[0] = { name: "Network Access", status: "❌ ERROR: " + e.message };
            }

            // 3. Profiles Table Access
            results.push({ name: "Profiles Table", status: "Testing..." });
            try {
                const { error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
                results[1] = { name: "Profiles Table", status: error ? "⚠️ " + error.message : "✅ OK" };
            } catch (e: any) {
                results[1] = { name: "Profiles Table", status: "❌ ERROR: " + e.message };
            }

            // 4. Auth Service Access
            results.push({ name: "Auth Service", status: "Testing..." });
            try {
                const { error } = await supabase.auth.getSession();
                results[2] = { name: "Auth Service", status: error ? "⚠️ " + error.message : "✅ OK" };
            } catch (e: any) {
                results[2] = { name: "Auth Service", status: "❌ ERROR: " + e.message };
            }

            setStatus([...results]);
        };
        check();
    }, []);

    return (
        <div className="p-8">
            <h1 className="text-xl font-bold mb-4">DB 연결 정밀 진단</h1>
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <div>
                    <h2 className="font-bold">환경 변수 상태</h2>
                    <p>URL: {envCheck.url}</p>
                    <p>KEY: {envCheck.key}</p>
                </div>
                <hr />
                <div>
                    <h2 className="font-bold">연결 테스트 결과</h2>
                    <ul className="list-disc ml-5">
                        {status.map((s, i) => (
                            <li key={i}>{s.name}: {s.status}</li>
                        ))}
                    </ul>
                </div>
                <div className="mt-4 p-4 bg-yellow-50 rounded text-sm">
                    <p>⚠️ <strong>사장님께 드리는 팁:</strong> 만약 'Network Access'가 에러라면 사장님의 인터넷이나 브라우저가 수파베이스를 차단하고 있을 수 있습니다. 'Profiles Table'이 에러라면 권한 설정 문제입니다.</p>
                </div>
            </div>
            <button
                onClick={() => window.location.href = "/login"}
                className="mt-6 bg-blue-600 text-white px-4 py-2 rounded"
            >
                로그인 페이지로 돌아가기
            </button>
        </div>
    );
}
