"use client";

import { useState, useEffect, useCallback } from "react";
import { PackageCheck, RefreshCcw, Plus, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { fetchStockMap, StockMap } from "@/hooks/useInventory";
import { toast } from "sonner";

const ADJUSTMENT_TYPES = [
    { value: "initial", label: "초기재고 입력", color: "blue", desc: "창고에 기존 재고가 있을 때" },
    { value: "waste", label: "폐기/손실", color: "red", desc: "부패, 파손 등 손실 처리" },
    { value: "return", label: "반품 입고", color: "green", desc: "반품된 물량 재고 복구" },
    { value: "correction", label: "수량 보정", color: "gray", desc: "실수로 잘못 기록된 수량 보정" },
] as const;

type AdjType = typeof ADJUSTMENT_TYPES[number]["value"];

export default function InventoryPage() {
    const { farm, initialized, initialize, cropIconMap } = useAuthStore();
    const [stockMap, setStockMap] = useState<StockMap>({});
    const [farmCrops, setFarmCrops] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // 조정 입력 상태
    const [showAdjForm, setShowAdjForm] = useState(false);
    const [adjCrop, setAdjCrop] = useState("");
    const [adjType, setAdjType] = useState<AdjType>("initial");
    const [adjQty, setAdjQty] = useState("");
    const [adjReason, setAdjReason] = useState("");
    const [adjSaving, setAdjSaving] = useState(false);

    // 조정 이력
    const [adjHistory, setAdjHistory] = useState<any[]>([]);

    useEffect(() => {
        if (!initialized) initialize();
    }, []);

    const loadAll = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);
        try {
            const [stock, cropsRes, histRes] = await Promise.all([
                fetchStockMap(farm.id),
                supabase.from("farm_crops").select("*").eq("farm_id", farm.id).eq("is_active", true).order("sort_order"),
                supabase.from("inventory_adjustments").select("*").eq("farm_id", farm.id).order("adjusted_at", { ascending: false }).limit(30),
            ]);
            setStockMap(stock);
            setFarmCrops(cropsRes.data ?? []);
            setAdjHistory(histRes.data ?? []);
        } finally {
            setLoading(false);
        }
    }, [farm?.id]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handleAdjSave = async () => {
        if (!farm?.id || !adjCrop || !adjQty) {
            toast.error("품목과 수량을 입력해주세요.");
            return;
        }
        const rawQty = Number(adjQty);
        if (isNaN(rawQty) || rawQty === 0) {
            toast.error("수량은 0이 아닌 숫자로 입력해주세요.");
            return;
        }
        // waste는 재고 차감이므로 음수로 저장
        const finalQty = adjType === "waste" ? -Math.abs(rawQty) : rawQty;

        setAdjSaving(true);
        try {
            const { error } = await supabase.from("inventory_adjustments").insert({
                farm_id: farm.id,
                crop_name: adjCrop,
                quantity: finalQty,
                adjustment_type: adjType,
                reason: adjReason || null,
                adjusted_at: new Date().toISOString(),
            });
            if (error) throw error;
            toast.success("재고 조정이 저장되었습니다.");
            setAdjQty("");
            setAdjReason("");
            setShowAdjForm(false);
            loadAll();
        } catch (e: any) {
            toast.error("저장 실패: " + e.message);
        } finally {
            setAdjSaving(false);
        }
    };

    if (!initialized) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!farm?.inventory_enabled) {
        return (
            <div className="p-6 max-w-lg mx-auto mt-10 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <PackageCheck className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-black text-gray-800">재고관리 비활성화 상태</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                    설정 → 재고관리 설정에서 ON으로 켜야<br />재고 현황을 사용할 수 있습니다.
                </p>
                <a href="/settings" className="inline-block mt-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all">
                    설정으로 이동
                </a>
            </div>
        );
    }

    const cropList = farmCrops.filter(c => Object.keys(stockMap).includes(c.crop_name) || true);

    return (
        <div className="p-4 md:p-6 pb-32 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                        <PackageCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900">재고 현황</h1>
                        <p className="text-xs text-gray-500 font-medium">수확 기준 실시간 재고</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadAll} disabled={loading}
                        className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50">
                        <RefreshCcw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setShowAdjForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100">
                        <Plus className="w-4 h-4" />
                        재고 조정
                    </button>
                </div>
            </div>

            {/* 재고 현황 카드 */}
            <section className="space-y-3">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">품목별 현재 재고</p>
                {farmCrops.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium text-sm">등록된 작물이 없습니다.<br />설정에서 작물을 먼저 추가해주세요.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {farmCrops.map(crop => {
                            const stock = stockMap[crop.crop_name] ?? 0;
                            const isLow = stock <= 0;
                            const icon = cropIconMap[crop.crop_name] || crop.crop_icon || "🌱";
                            return (
                                <div key={crop.id}
                                    className={`p-4 rounded-2xl border-2 bg-white transition-all ${isLow ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="text-2xl">{icon}</span>
                                        {isLow ? (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                                                <AlertTriangle className="w-3 h-3" /> 부족
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                                <CheckCircle className="w-3 h-3" /> 정상
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-gray-500">{crop.crop_name}</p>
                                    <p className={`text-2xl font-black mt-0.5 ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                                        {stock % 1 === 0 ? stock.toFixed(0) : stock.toFixed(1)}
                                        <span className="text-xs font-bold text-gray-400 ml-1">{crop.default_unit}</span>
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* 재고 조정 이력 */}
            {adjHistory.length > 0 && (
                <section className="space-y-3">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">최근 조정 이력</p>
                    <div className="space-y-2">
                        {adjHistory.map(adj => {
                            const isPlus = adj.quantity > 0;
                            const typeInfo = ADJUSTMENT_TYPES.find(t => t.value === adj.adjustment_type);
                            const icon = cropIconMap[adj.crop_name] || "🌱";
                            return (
                                <div key={adj.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <span className="text-xl">{icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{adj.crop_name}</p>
                                        <p className="text-[11px] text-gray-500">{typeInfo?.label} {adj.reason ? `· ${adj.reason}` : ''}</p>
                                    </div>
                                    <div className={`flex items-center gap-1 font-black text-sm ${isPlus ? 'text-blue-600' : 'text-red-500'}`}>
                                        {isPlus ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                        {isPlus ? '+' : ''}{adj.quantity}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* 재고 조정 모달 */}
            {showAdjForm && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdjForm(false)} />
                    <div className="relative bg-white rounded-[2rem] w-full max-w-sm shadow-2xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black text-gray-900">재고 수동 조정</h3>
                            <button onClick={() => setShowAdjForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        {/* 품목 선택 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">품목</label>
                            <select value={adjCrop} onChange={e => setAdjCrop(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400 focus:bg-white transition-all">
                                <option value="">-- 품목 선택 --</option>
                                {farmCrops.map(c => (
                                    <option key={c.id} value={c.crop_name}>
                                        {cropIconMap[c.crop_name] || c.crop_icon} {c.crop_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 조정 유형 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">조정 유형</label>
                            <div className="grid grid-cols-2 gap-2">
                                {ADJUSTMENT_TYPES.map(t => (
                                    <button key={t.value} onClick={() => setAdjType(t.value)}
                                        className={`p-3 rounded-2xl border-2 text-left transition-all ${adjType === t.value ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                                        <p className="text-xs font-black text-gray-800">{t.label}</p>
                                        <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 수량 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">
                                수량 {adjType === "waste" ? "(입력값은 자동으로 차감됩니다)" : ""}
                            </label>
                            <div className="flex items-center gap-2">
                                {adjType === "waste" && <Minus className="w-4 h-4 text-red-500 shrink-0" />}
                                <input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)}
                                    placeholder="수량 입력"
                                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400 focus:bg-white transition-all" />
                            </div>
                        </div>

                        {/* 사유 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">사유 (선택)</label>
                            <input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)}
                                placeholder="예: 서리 피해, 초기 창고 재고..."
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-blue-400 focus:bg-white transition-all" />
                        </div>

                        <button onClick={handleAdjSave} disabled={adjSaving || !adjCrop || !adjQty}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 disabled:opacity-50">
                            {adjSaving ? "저장 중..." : "저장"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
