"use client";

import React from "react";
import { X } from "lucide-react";

import type { ShortageRow } from "@/hooks/useInventory";

function formatQty(n: number): string {
    if (!Number.isFinite(n)) return "0";
    const isInt = Math.abs(n - Math.round(n)) < 1e-9;
    return isInt ? String(Math.round(n)) : n.toFixed(1);
}

function qtyWithUnit(n: number, u?: string): string {
    return `${formatQty(n)}${unitLabel(u)}`;
}

function unitLabel(u?: string): string {
    return u ? ` ${u}` : "";
}

function rowKey(r: ShortageRow, idx: number): string {
    return `${r.cropName}:${r.unit ?? ""}:${idx}`;
}

export default function InventoryShortageDialog({
    open,
    mode,
    rows,
    onClose,
    onContinue,
}: {
    open: boolean;
    mode: "block" | "warn";
    rows: ShortageRow[];
    onClose: () => void;
    onContinue?: () => void;
}) {
    const [expandedKey, setExpandedKey] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setExpandedKey(null);
            return;
        }
        setExpandedKey(null);
    }, [open, rows]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={onClose}
        >
            <div
                className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden max-h-[58vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <p className="text-[10px] font-black uppercase text-rose-500">
                            {mode === "block" ? "재고 부족" : "재고 부족 (경고)"}
                        </p>
                        <p className="text-sm font-black text-slate-900">
                            {mode === "block"
                                ? "재고 부족으로 저장할 수 없습니다"
                                : "재고가 부족합니다. 계속 진행할까요?"}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-5 pt-4 pb-3 shrink-0">
                    <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3">
                        <p className="text-[11px] font-black text-rose-500">부족 품목 {rows.length}개</p>
                        <p className="mt-1 text-[13px] font-bold text-slate-600">
                            품목을 눌러 현재재고, 판매, 부족 수량을 확인하세요.
                        </p>
                    </div>
                </div>

                <div className="px-5 pb-4 overflow-y-auto min-h-0">
                    <div className="rounded-2xl border border-rose-100 overflow-hidden bg-white divide-y divide-rose-100">
                        {rows.map((r, idx) => {
                            const key = rowKey(r, idx);
                            const isExpanded = expandedKey === key;

                            return (
                                <div key={key} className="px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedKey(isExpanded ? null : key)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-base font-black text-slate-800 leading-tight break-keep">
                                                    {r.cropName}
                                                </p>
                                                {r.unit && (
                                                    <p className="mt-1 text-[11px] font-bold text-slate-400 break-all">
                                                        단위: {r.unit}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-600 text-right">
                                                부족 {qtyWithUnit(r.shortage, r.unit)}
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between gap-3 text-[12px]">
                                            <p className={`font-black ${isExpanded ? "text-emerald-600" : "text-emerald-500"}`}>
                                                {isExpanded ? "상세 접기" : "상세 보기"}
                                            </p>
                                            <div className="rounded-full bg-emerald-50 px-2.5 py-1">
                                                <p className="font-black text-emerald-500">{isExpanded ? "▲" : "▼"}</p>
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                                                <p className="text-[12px] font-black text-slate-400 shrink-0">현재재고</p>
                                                <p className="text-lg sm:text-xl font-black text-rose-600 break-words leading-tight text-right">
                                                    {qtyWithUnit(r.available, r.unit)}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                                                <p className="text-[12px] font-black text-slate-400 shrink-0">판매</p>
                                                <p className="text-lg sm:text-xl font-black text-slate-700 break-words leading-tight text-right">
                                                    {qtyWithUnit(r.requested, r.unit)}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
                                                <p className="text-[12px] font-black text-rose-400 shrink-0">부족</p>
                                                <p className="text-lg sm:text-xl font-black text-rose-700 break-words leading-tight text-right">
                                                    {qtyWithUnit(r.shortage, r.unit)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-5 pt-3 border-t border-slate-100 bg-white shrink-0">
                    <div className="flex gap-2">
                        {mode === "warn" ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={onContinue}
                                    className="flex-[1.2] py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm shadow-lg shadow-emerald-100 transition-all"
                                >
                                    계속 저장
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onClose}
                                className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-sm shadow-lg shadow-rose-100 transition-all"
                            >
                                확인
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
