"use client";

import { useAuthStore } from "@/store/authStore";
import { AlertCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PendingPage() {
    const { signOut } = useAuthStore();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut();
        router.push("/login");
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 text-center border border-gray-100">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-2xl mb-6">
                    <AlertCircle className="w-10 h-10 text-yellow-600" />
                </div>

                <h1 className="text-xl font-black text-gray-900 mb-4">승인 대기 중</h1>

                <p className="text-gray-500 mb-8 leading-relaxed">
                    사장님(관리자)의 승인이 완료된 후에<br />
                    모든 기능을 이용하실 수 있습니다.<br />
                    잠시만 기다려 주세요.
                </p>

                <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-6">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Status</p>
                        <p className="text-sm font-black text-yellow-600">Pending Approval</p>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-gray-200"
                    >
                        <LogOut className="w-5 h-5" />
                        로그아웃 (다시 로그인)
                    </button>

                    <p className="text-[10px] text-gray-400 mt-4">
                        다른 계정으로 로그인하시려면 로그아웃 후 다시 시도해 주세요.
                    </p>
                </div>
            </div>
        </div>
    );
}
