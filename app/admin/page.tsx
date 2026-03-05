"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Users, Sprout } from "lucide-react";
import { supabase, Farm } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

export default function AdminPage() {
    const { profile } = useAuthStore();
    const router = useRouter();
    const [farms, setFarms] = useState<(Farm & { owner_email?: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile && profile.role !== 'admin') {
            toast.error('관리자 전용 페이지입니다.');
            router.push('/');
            return;
        }
        if (profile) fetchFarms();
    }, [profile]);

    const fetchFarms = async () => {
        setLoading(true);
        // 복합 조인으로 인한 오류를 방지하기 위해 단순 쿼리로 복구합니다.
        const { data, error } = await supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("농장 로드 실패:", error);
            toast.error("농장 정보를 불러오는데 실패했습니다.");
        } else {
            setFarms(data ?? []);
        }
        setLoading(false);
    };

    const toggleActive = async (id: string, current: boolean, email?: string) => {
        const newStatus = !current;

        // 1. 농장 활성화 상태 업데이트
        const { error: farmError } = await supabase.from('farms').update({ is_active: newStatus }).eq('id', id);

        if (farmError) {
            toast.error("상태 변경 실패: " + farmError.message);
            return;
        }

        // 2. [핵심] 승인 시 이메일 미인증 상태라면 즉시 강제 인증 처리 (One-Click 통합)
        if (newStatus && email) {
            await supabase.rpc('force_confirm_user', { target_email: email });
        }

        fetchFarms();
    };

    const activeFarms = farms.filter(f => f.is_active);
    const pendingFarms = farms.filter(f => !f.is_active);

    return (
        <div className="p-4 md:p-3 pb-20 md:pb-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">관리자 대시보드</h1>
                    <p className="text-gray-700 text-sm mt-1">전체 농장 현황 및 승인 관리</p>
                </div>
                <a href="/admin/catalog"
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-green-100">
                    <Sprout className="w-4 h-4" />
                    사진 카탈로그
                </a>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Sprout className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-700">전체 농장</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{farms.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-gray-700">승인 완료</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{activeFarms.length}</p>
                </div>
                <div className="bg-white rounded-2xl border-2 border-yellow-200 shadow-lg p-5 animate-pulse-subtle bg-yellow-50/30">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-yellow-100 p-2 rounded-xl">
                            <XCircle className="w-5 h-5 text-yellow-600" />
                        </div>
                        <span className="text-sm font-black text-yellow-700 uppercase tracking-tighter">신규 승인 대기</span>
                    </div>
                    <p className="text-3xl font-black text-yellow-900">{pendingFarms.length}</p>
                    <p className="text-[10px] text-yellow-600 font-bold mt-1">사장님의 확인이 필요한 새로운 농장 신청입니다.</p>
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
                    <p className="text-gray-700 text-sm text-center py-8">로딩 중...</p>
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

function FarmCard({ farm, onToggle }: { farm: Farm; onToggle: (id: string, current: boolean, email?: string) => void }) {
    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-4 ${farm.is_active ? 'border-gray-100' : 'border-yellow-200 bg-yellow-50'}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900">{farm.farm_name}</h3>
                    <div className="text-sm text-gray-700 mt-1 space-y-0.5">
                        <p className="font-medium text-blue-600">👤 소유자 ID: {farm.owner_id.substring(0, 8)}...</p>
                        {farm.phone && <p>📞 {farm.phone}</p>}
                        {farm.address && <p>📍 {farm.address}</p>}
                        {farm.business_number && <p>🏢 {farm.business_number}</p>}
                        {farm.notes && <p className="text-xs text-gray-700 mt-1">💬 {farm.notes}</p>}
                    </div>
                    <p className="text-xs text-gray-700 mt-2">
                        등록일: {new Date(farm.created_at).toLocaleDateString('ko-KR')}
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => onToggle(farm.id, farm.is_active, (farm as any).profiles?.email || farm.owner_id)}
                        className={`px-6 py-2.5 rounded-2xl text-sm font-black transition-all shadow-lg active:scale-95
                ${farm.is_active
                                ? 'bg-red-50 text-red-600 border border-red-100'
                                : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-green-200'}`}>
                        {farm.is_active ? '승인 취소' : '즉시 승인'}
                    </button>
                    {!farm.is_active && (
                        <p className="text-[10px] text-gray-700 text-center font-bold">승인 시 이메일도 함께 인증됩니다</p>
                    )}
                </div>
            </div>
        </div>
    );
}
