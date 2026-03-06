"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    CheckCircle, XCircle, Users, Sprout, RefreshCcw, Download,
    Eye, EyeOff, Edit2, Save, X, ShieldCheck, Clock, AlertTriangle
} from "lucide-react";
import { supabase, Farm } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface AdminFarm extends Farm {
    owner_full_name?: string;
    owner_role?: string;
}

export default function AdminPage() {
    const { profile } = useAuthStore();
    const router = useRouter();
    const [farms, setFarms] = useState<AdminFarm[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "pending">("all");

    useEffect(() => {
        if (profile && profile.role !== "admin") {
            toast.error("관리자 전용 페이지입니다.");
            router.push("/");
            return;
        }
        if (profile) fetchFarms();
    }, [profile]);

    const fetchFarms = useCallback(async () => {
        setLoading(true);
        try {
            // 1. farms 조회
            const { data: farmsData, error: farmsError } = await supabase
                .from("farms")
                .select("*")
                .order("created_at", { ascending: false });
            if (farmsError) throw farmsError;

            // 2. profiles 조회 (소유자 이름)
            const ownerIds = (farmsData ?? []).map((f: any) => f.owner_id).filter(Boolean);
            let profileMap: Record<string, { full_name: string | null; role: string | null }> = {};
            if (ownerIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from("profiles")
                    .select("id, full_name, role")
                    .in("id", ownerIds);
                (profilesData ?? []).forEach((p: any) => {
                    profileMap[p.id] = { full_name: p.full_name, role: p.role };
                });
            }

            // 3. 병합
            const mapped: AdminFarm[] = (farmsData ?? []).map((f: any) => ({
                ...f,
                owner_full_name: profileMap[f.owner_id]?.full_name || null,
                owner_role: profileMap[f.owner_id]?.role || null,
            }));
            setFarms(mapped);
        } catch (e: any) {
            toast.error("데이터 로드 실패: " + e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const toggleActive = async (id: string, current: boolean, email?: string) => {
        const newStatus = !current;
        const { error } = await supabase.from("farms").update({ is_active: newStatus }).eq("id", id);
        if (error) { toast.error("상태 변경 실패: " + error.message); return; }
        if (newStatus && email) {
            await supabase.rpc("force_confirm_user", { target_email: email });
        }
        toast.success(newStatus ? "✅ 승인 완료" : "❌ 승인 취소");
        fetchFarms();
    };

    const saveNotes = async (id: string) => {
        setSavingId(id);
        const { error } = await supabase.from("farms").update({ notes: editingNotes[id] ?? "" }).eq("id", id);
        if (error) { toast.error("저장 실패"); }
        else { toast.success("저장 완료"); setEditingId(null); fetchFarms(); }
        setSavingId(null);
    };

    const togglePassword = (id: string) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const startEdit = (farm: AdminFarm) => {
        setEditingId(farm.id);
        setEditingNotes(prev => ({ ...prev, [farm.id]: farm.notes || "" }));
    };

    const handleDownloadXLSX = () => {
        const rows = filteredFarms.map((f, i) => ({
            "번호": i + 1,
            "농장명": f.farm_name,
            "소유자": f.owner_full_name || "-",
            "연락이메일": f.email || "-",
            "전화번호": f.phone || "-",
            "테스트비밀번호": f.notes || "-",
            "주소": f.address || "-",
            "사업자번호": f.business_number || "-",
            "가입일": new Date(f.created_at).toLocaleDateString("ko-KR"),
            "상태": f.is_active ? "승인완료" : "대기중",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "농장목록");
        XLSX.writeFile(wb, `농장목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("엑셀 다운로드 완료");
    };

    const activeFarms = farms.filter(f => f.is_active);
    const pendingFarms = farms.filter(f => !f.is_active);
    const filteredFarms = filterStatus === "active" ? activeFarms : filterStatus === "pending" ? pendingFarms : farms;

    return (
        <div className="p-4 md:p-6 pb-24 md:pb-8 max-w-6xl mx-auto space-y-5">

            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-red-600" />
                        관리자 대시보드
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">전체 농장 및 사용자 관리</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => router.push("/admin/catalog")}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg">
                        <Sprout className="w-3.5 h-3.5" />카탈로그
                    </button>
                    <button onClick={fetchFarms} disabled={loading}
                        className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
                        <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* KPI 카드 */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">전체</p>
                    <p className="text-2xl font-black text-gray-900">{farms.length}</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-4 text-center">
                    <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">승인완료</p>
                    <p className="text-2xl font-black text-emerald-700">{activeFarms.length}</p>
                </div>
                <div className={`rounded-2xl border shadow-sm p-4 text-center ${pendingFarms.length > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"}`}>
                    <p className="text-[10px] font-black text-amber-500 uppercase mb-1">승인대기</p>
                    <p className={`text-2xl font-black ${pendingFarms.length > 0 ? "text-amber-700" : "text-gray-400"}`}>{pendingFarms.length}</p>
                </div>
            </div>

            {/* 필터 + 다운로드 */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
                    {([
                        { key: "all", label: `전체 (${farms.length})` },
                        { key: "active", label: `승인 (${activeFarms.length})` },
                        { key: "pending", label: `대기 (${pendingFarms.length})` },
                    ] as { key: typeof filterStatus; label: string }[]).map(f => (
                        <button key={f.key} onClick={() => setFilterStatus(f.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${filterStatus === f.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <button onClick={handleDownloadXLSX}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg">
                    <Download className="w-3.5 h-3.5" />엑셀
                </button>
            </div>

            {/* 테이블 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* 테이블 헤더 */}
                <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr_6rem_6rem] gap-0 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase">
                    <div className="px-3 py-3">#</div>
                    <div className="px-3 py-3">농장명</div>
                    <div className="px-3 py-3">소유자</div>
                    <div className="px-3 py-3">연락이메일 / 전화</div>
                    <div className="px-3 py-3">테스트 비밀번호</div>
                    <div className="px-3 py-3">가입일</div>
                    <div className="px-3 py-3">상태</div>
                    <div className="px-3 py-3">관리</div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                        <RefreshCcw className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-bold">로딩 중...</span>
                    </div>
                ) : filteredFarms.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm font-bold">데이터가 없습니다</div>
                ) : (
                    filteredFarms.map((farm, idx) => (
                        <div key={farm.id}
                            className={`grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1fr_6rem_6rem] gap-0 border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-sm
                                ${!farm.is_active ? "bg-amber-50/30" : ""}`}>
                            {/* # */}
                            <div className="px-3 py-3 text-[10px] text-gray-400 font-bold self-center">{idx + 1}</div>

                            {/* 농장명 */}
                            <div className="px-3 py-3 self-center">
                                <p className="font-black text-gray-900 text-sm">{farm.farm_name}</p>
                                {farm.address && <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{farm.address}</p>}
                            </div>

                            {/* 소유자 */}
                            <div className="px-3 py-3 self-center">
                                <p className="font-bold text-gray-700 text-xs">{farm.owner_full_name || "-"}</p>
                                <p className="text-[10px] text-gray-400">{farm.owner_id.substring(0, 8)}...</p>
                            </div>

                            {/* 이메일 / 전화 */}
                            <div className="px-3 py-3 self-center">
                                <p className="text-xs font-bold text-blue-600 truncate">{farm.email || "-"}</p>
                                <p className="text-[10px] text-gray-500">{farm.phone || "-"}</p>
                            </div>

                            {/* 테스트 비밀번호 */}
                            <div className="px-3 py-3 self-center">
                                {editingId === farm.id ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={editingNotes[farm.id] ?? ""}
                                            onChange={e => setEditingNotes(prev => ({ ...prev, [farm.id]: e.target.value }))}
                                            placeholder="비밀번호 메모"
                                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-blue-400"
                                        />
                                        <button onClick={() => saveNotes(farm.id)} disabled={savingId === farm.id}
                                            className="p-1 rounded-lg bg-emerald-500 text-white shrink-0">
                                            <Save className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => setEditingId(null)}
                                            className="p-1 rounded-lg bg-gray-200 text-gray-600 shrink-0">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className={`text-xs font-mono ${farm.notes ? "text-gray-800" : "text-gray-300"}`}>
                                            {farm.notes
                                                ? showPasswords[farm.id] ? farm.notes : "••••••••"
                                                : "없음"}
                                        </span>
                                        {farm.notes && (
                                            <button onClick={() => togglePassword(farm.id)}
                                                className="p-1 text-gray-400 hover:text-gray-700">
                                                {showPasswords[farm.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                            </button>
                                        )}
                                        <button onClick={() => startEdit(farm)}
                                            className="p-1 text-gray-400 hover:text-blue-500">
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 가입일 */}
                            <div className="px-3 py-3 self-center">
                                <p className="text-xs text-gray-600">{new Date(farm.created_at).toLocaleDateString("ko-KR")}</p>
                            </div>

                            {/* 상태 */}
                            <div className="px-3 py-3 self-center">
                                {farm.is_active ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                        <CheckCircle className="w-3 h-3" />승인
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                        <Clock className="w-3 h-3" />대기
                                    </span>
                                )}
                            </div>

                            {/* 관리 */}
                            <div className="px-3 py-3 self-center">
                                <button
                                    onClick={() => toggleActive(farm.id, farm.is_active, farm.email || undefined)}
                                    className={`text-[10px] font-black px-3 py-1.5 rounded-xl transition-all active:scale-95
                                        ${farm.is_active
                                            ? "bg-red-50 text-red-500 border border-red-100 hover:bg-red-100"
                                            : "bg-emerald-500 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600"}`}>
                                    {farm.is_active ? "승인취소" : "즉시승인"}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 안내 */}
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-bold">
                    테스트 비밀번호는 <strong>farms.notes</strong> 컈럼에 저장됩니다.
                    로그인 이메일은 farms.email 컈럼에서 가져옵니다.
                    실제 인증 이메일 확인이 필요하면 Supabase 대시보드 → Authentication 빔에서 확인하세요.
                </p>
            </div>
        </div>
    );
}
