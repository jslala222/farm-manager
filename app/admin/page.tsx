"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Users, Sprout } from "lucide-react";
import { supabase, Farm } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

export default function AdminPage() {
    const { profile } = useAuthStore();
    const [farms, setFarms] = useState<(Farm & { owner_email?: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchFarms(); }, []);

    const fetchFarms = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        setFarms(data ?? []);
        setLoading(false);
    };

    const toggleActive = async (id: string, current: boolean) => {
        await supabase.from('farms').update({ is_active: !current }).eq('id', id);
        fetchFarms();
    };

    const activeFarms = farms.filter(f => f.is_active);
    const pendingFarms = farms.filter(f => !f.is_active);

    return (
        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
                <p className="text-gray-500 text-sm mt-1">전체 농장 현황 및 승인 관리</p>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Sprout className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-500">전체 농장</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{farms.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-gray-500">승인 완료</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{activeFarms.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-yellow-600" />
                        <span className="text-sm text-gray-500">승인 대기</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{pendingFarms.length}</p>
                </div>
            </div>

            {/* 승인 대기 */}
            {pendingFarms.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-base font-bold text-yellow-700 mb-3 flex items-center gap-2">
                        ⏳ 승인 대기 ({pendingFarms.length})
                    </h2>
                    <div className="space-y-3">
                        {pendingFarms.map(farm => (
                            <FarmCard key={farm.id} farm={farm} onToggle={toggleActive} />
                        ))}
                    </div>
                </div>
            )}

            {/* 승인된 농장 */}
            <div>
                <h2 className="text-base font-bold text-gray-700 mb-3">✅ 승인된 농장 ({activeFarms.length})</h2>
                {loading ? (
                    <p className="text-gray-400 text-sm text-center py-8">로딩 중...</p>
                ) : (
                    <div className="space-y-3">
                        {activeFarms.map(farm => (
                            <FarmCard key={farm.id} farm={farm} onToggle={toggleActive} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function FarmCard({ farm, onToggle }: { farm: Farm; onToggle: (id: string, current: boolean) => void }) {
    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-4 ${farm.is_active ? 'border-gray-100' : 'border-yellow-200 bg-yellow-50'}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900">{farm.farm_name}</h3>
                    <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                        {farm.phone && <p>📞 {farm.phone}</p>}
                        {farm.address && <p>📍 {farm.address}</p>}
                        {farm.business_number && <p>🏢 {farm.business_number}</p>}
                        {farm.notes && <p className="text-xs text-gray-400 mt-1">💬 {farm.notes}</p>}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        등록일: {new Date(farm.created_at).toLocaleDateString('ko-KR')}
                    </p>
                </div>
                <button
                    onClick={() => onToggle(farm.id, farm.is_active)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all
            ${farm.is_active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-500 text-white hover:bg-green-600'}`}>
                    {farm.is_active ? '승인 취소' : '승인'}
                </button>
            </div>
        </div>
    );
}
