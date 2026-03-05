"use client";
// components/SettlementModal.tsx - 통합 정산 모달 (bulk-edit / finance / settled-edit)

import React, { useState, useMemo } from 'react';
import { X, Save, ShoppingCart } from 'lucide-react';
import { getCropIcon } from '@/lib/utils';

export interface ModalCropEntry {
    recordId?: string | null;
    cropName: string;
    grade: string;        // '-' for processed items
    quantity: number;
    unit: string;
    isProcessed: boolean;
    unitPrice?: number;   // initial unit price (0 or undefined = unknown)
    isCompoundGrade?: boolean; // true if this entry came from a compound grade record
}

export interface SettlementSaveData {
    saveAsPriceOnly?: boolean;
    // bulk-edit only
    date?: string;
    paymentStatus?: 'pending' | 'completed';
    // all modes
    entries: {
        cropName: string;
        grade: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        unit: string;
        recordId?: string | null;
        isCompoundGrade?: boolean;
    }[];
    settleDate: string;
    actualAmount: number | null;
    paymentMethod: string;
    deductionReason: string;
    memo: string;
}

interface SettlementModalProps {
    mode: 'bulk-edit' | 'finance' | 'settled-edit';
    companyName: string;
    deliveryDate: string;
    cropEntries: ModalCropEntry[];
    initialDate?: string;
    initialPaymentStatus?: 'pending' | 'completed';
    initialPaymentMethod?: string;
    initialDeductionReason?: string;
    initialMemo?: string;
    initialSettleDate?: string;
    initialActualAmount?: number | null;
    onSave: (data: SettlementSaveData) => Promise<void>;
    onDelete?: () => void;
    onClose: () => void;
    saving: boolean;
}

const PAYMENT_METHODS = ['카드', '현금', '계좌이체'];
const DEDUCTION_REASONS = ['조합공제', '운임공제', '품질하락', '시세조정', '선불차감', '기타'];

export default function SettlementModal({
    mode,
    companyName,
    deliveryDate,
    cropEntries,
    initialDate,
    initialPaymentStatus = 'pending',
    initialPaymentMethod = '계좌이체',
    initialDeductionReason = '',
    initialMemo = '',
    initialSettleDate,
    initialActualAmount,
    onSave,
    onDelete,
    onClose,
    saving,
}: SettlementModalProps) {
    // Bulk-edit: date & payment status
    const [date, setDate] = useState(initialDate || deliveryDate);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed'>(initialPaymentStatus);

    // Per-entry form state
    const [quantities, setQuantities] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        cropEntries.forEach(e => {
            init[`${e.cropName}:${e.grade}`] = e.quantity.toString();
        });
        return init;
    });
    const [unitPrices, setUnitPrices] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        cropEntries.forEach(e => {
            init[`${e.cropName}:${e.grade}`] = (e.unitPrice && e.unitPrice > 0) ? e.unitPrice.toLocaleString() : '';
        });
        return init;
    });

    // Settlement state
    const todayStr = new Date().toISOString().split('T')[0];
    const [settleDate, setSettleDate] = useState(initialSettleDate || todayStr);
    const [actualAmount, setActualAmount] = useState(() =>
        (initialActualAmount && initialActualAmount > 0) ? initialActualAmount.toLocaleString() : ''
    );
    const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
    const [deductionReason, setDeductionReason] = useState(initialDeductionReason);
    const [memo, setMemo] = useState(initialMemo);

    // Display logic
    const showSettlement = mode !== 'bulk-edit' || paymentStatus === 'completed';
    const isEditableQty = mode === 'bulk-edit' || mode === 'finance';
    const showUnitPrices =
        mode === 'finance' ||
        mode === 'settled-edit' ||
        (mode === 'bulk-edit' && paymentStatus === 'completed');

    // Expected total auto-calc
    const expectedTotal = useMemo(() => {
        return cropEntries.reduce((sum, entry) => {
            const key = `${entry.cropName}:${entry.grade}`;
            const qty = Number(quantities[key] || 0);
            const price = Number((unitPrices[key] || '0').replace(/,/g, ''));
            return sum + qty * price;
        }, 0);
    }, [cropEntries, quantities, unitPrices]);

    const actualAmountNum = actualAmount ? Number(actualAmount.replace(/,/g, '')) : null;
    const deduction = (actualAmountNum !== null && expectedTotal > 0)
        ? actualAmountNum - expectedTotal
        : null;

    // Group entries by cropName
    const groupedEntries = useMemo(() => {
        const groups = new Map<string, ModalCropEntry[]>();
        cropEntries.forEach(e => {
            if (!groups.has(e.cropName)) groups.set(e.cropName, []);
            groups.get(e.cropName)!.push(e);
        });
        return Array.from(groups.entries());
    }, [cropEntries]);

    const handleSave = async (priceOnly: boolean = false) => {
        if (mode === 'bulk-edit' && paymentStatus === 'completed') {
            const missing = cropEntries.some(e => {
                const key = `${e.cropName}:${e.grade}`
                const qty = Number(quantities[key] || 0);
                const price = Number(unitPrices[key] || 0);
                return qty > 0 && !price;
            });
            if (missing) {
                alert('정산완료로 저장하려면 수량이 있는 모든 품목의 단가를 입력해주세요.');
                return;
            }
        }
        if (mode === 'finance' && !priceOnly) {
            if (!actualAmountNum || actualAmountNum <= 0) {
                alert('정산완료를 진행하려면 실 입금액을 입력해주세요. 단가만 저장하려면 단가 저장 버튼을 눌러주세요.');
                return;
            }
            if (!confirm('실 입금액 ' + actualAmountNum.toLocaleString() + '원으로 정산을 완료합니다. 계속 진행하시겠습니까?')) return;
        }
        const entries = cropEntries.map(e => {
            const key = `${e.cropName}:${e.grade}`;
            const qty = Number(quantities[key] || 0);
            const price = Number((unitPrices[key] || '0').replace(/,/g, ''));
            return {
                cropName: e.cropName,
                grade: e.grade,
                quantity: qty,
                unitPrice: price,
                totalPrice: qty * price,
                unit: e.unit,
                recordId: e.recordId ?? null,
                isCompoundGrade: e.isCompoundGrade ?? false,
            };
        });
        await onSave({
            saveAsPriceOnly: priceOnly,
            date: mode === 'bulk-edit' ? date : undefined,
            paymentStatus: mode === 'bulk-edit' ? paymentStatus : undefined,
            entries,
            settleDate,
            actualAmount: priceOnly ? null : actualAmountNum,
            paymentMethod,
            deductionReason,
            memo,
        });
    };

    const headerBg = mode === 'finance' ? 'bg-orange-500' : 'bg-white border-b border-slate-100';
    const headerText = mode === 'finance' ? 'text-white' : 'text-slate-900';
    const headerSub = mode === 'finance' ? 'text-orange-100' : 'text-slate-400';
    const headerBtn = mode === 'finance'
        ? 'bg-white/20 text-white hover:bg-white/30'
        : 'bg-slate-100 text-slate-400 hover:bg-slate-200';

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4"
            onClick={onClose}
        >
            <div
                className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className={`flex items-center justify-between px-5 py-4 shrink-0 ${headerBg}`}>
                    <div>
                        <p className={`text-[10px] font-bold uppercase ${headerSub}`}>
                            {mode === 'bulk-edit' ? '납품 내역 수정' : mode === 'finance' ? '정산 처리' : '정산 내역 수정'}
                        </p>
                        <p className={`text-sm font-black ${headerText}`}>
                            {companyName} · {deliveryDate}
                        </p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl transition-all ${headerBtn}`}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 스크롤 폼 */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1">

                    {/* 날짜 수정 (bulk-edit만) */}
                    {mode === 'bulk-edit' && (
                        <div className="bg-slate-50 rounded-2xl p-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">날짜</p>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                className="bg-transparent text-sm font-black text-slate-800 outline-none w-full" />
                        </div>
                    )}

                    {/* 정산 상태 토글 (bulk-edit만) */}
                    {mode === 'bulk-edit' && (
                        <div className="grid grid-cols-2 gap-2">
                            {(['pending', 'completed'] as const).map(s => (
                                <button key={s} onClick={() => setPaymentStatus(s)}
                                    className={`py-2.5 rounded-xl text-xs font-black transition-all border-2 ${paymentStatus === s
                                        ? s === 'completed' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-amber-400 text-white border-amber-400'
                                        : 'bg-white text-slate-400 border-slate-200'}`}>
                                    {s === 'pending' ? '미정산 (외상)' : '정산 완료'}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 납품 정보 */}
                    <div className="space-y-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase px-1">납품 정보</p>
                        {groupedEntries.map(([cropName, entries]) => (
                            <div key={cropName} className="space-y-1.5">
                                <div className="flex items-center gap-2 px-1">
                                    <span className="text-lg">{getCropIcon(cropName)}</span>
                                    <p className="text-xs font-black text-slate-700">{cropName}</p>
                                    {entries[0].isProcessed && (
                                        <span className="text-[8px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full">가공품</span>
                                    )}
                                    {entries.length > 1 && (
                                        <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">{entries.length}등급</span>
                                    )}
                                </div>
                                {entries.map(entry => {
                                    const key = `${entry.cropName}:${entry.grade}`;
                                    const qty = Number(quantities[key] || 0);
                                    const unitPriceNum = Number((unitPrices[key] || '0').replace(/,/g, ''));
                                    const rowSubtotal = qty * unitPriceNum;
                                    return (
                                        <div key={key} className={`rounded-2xl border overflow-hidden ${entry.isProcessed ? 'border-violet-200' : 'border-slate-200'}`}>
                                            {/* 카드 헤더: 등급 + 소계 */}
                                            <div className={`flex items-center justify-between px-4 py-2 ${entry.isProcessed ? 'bg-violet-50' : 'bg-slate-100'}`}>
                                                <span className={`text-xs font-black ${entry.isProcessed ? 'text-violet-600' : 'text-slate-600'}`}>
                                                    {entry.isProcessed ? '수량 · 단가' : entry.grade}
                                                </span>
                                                {rowSubtotal > 0 && (
                                                    <span className="text-xs font-black text-emerald-600">= {rowSubtotal.toLocaleString()}원</span>
                                                )}
                                            </div>
                                            {/* 수량 행 */}
                                            <div className="flex items-center gap-3 px-4 py-3 bg-white">
                                                <span className="text-[10px] font-black text-slate-400 w-8 shrink-0">수량</span>
                                                {isEditableQty ? (
                                                    <input type="text" inputMode="numeric"
                                                        value={quantities[key] ?? ''}
                                                        onChange={e => setQuantities(prev => ({ ...prev, [key]: e.target.value.replace(/[^0-9]/g, '') }))}
                                                        className="flex-1 bg-transparent text-center text-xl font-black text-slate-800 outline-none"
                                                        placeholder="0" />
                                                ) : (
                                                    <span className="flex-1 text-center text-xl font-black text-slate-800">{entry.quantity}</span>
                                                )}
                                                <span className="text-sm font-bold text-slate-500 shrink-0 whitespace-nowrap">{entry.unit}</span>
                                            </div>
                                            {/* 단가 행 */}
                                            {showUnitPrices && qty > 0 && (
                                                <div className={`flex items-center gap-3 px-4 py-3 border-t transition-colors ${unitPriceNum > 0 ? 'bg-emerald-100 border-emerald-200' : 'bg-orange-50 border-orange-100'}`}>
                                                    <span className={`text-[10px] font-black w-8 shrink-0 ${unitPriceNum > 0 ? 'text-emerald-700' : 'text-orange-500'}`}>단가</span>
                                                    <input type="text" inputMode="numeric"
                                                        value={unitPrices[key] ?? ''}
                                                        onChange={e => setUnitPrices(prev => ({ ...prev, [key]: e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') }))}
                                                        className={`flex-1 bg-transparent text-center text-lg font-black outline-none ${unitPriceNum > 0 ? 'text-emerald-800' : 'text-orange-600'}`}
                                                        placeholder="미입력" />
                                                    <div className="text-right shrink-0">
                                                        <p className={`text-xs font-black leading-tight ${unitPriceNum > 0 ? 'text-emerald-600' : 'text-orange-400'}`}>원</p>
                                                        <p className={`text-[9px] font-bold leading-tight whitespace-nowrap ${unitPriceNum > 0 ? 'text-emerald-500' : 'text-orange-300'}`}>/{entry.unit}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* 소계 */}
                                {(() => {
                                    const subtotal = entries.reduce((s, e) => s + Number(quantities[`${e.cropName}:${e.grade}`] || 0), 0);
                                    return subtotal > 0 ? (
                                        <div className="text-right text-[10px] font-bold text-slate-400 pr-1">
                                            소계: {subtotal.toLocaleString()} {entries[0].unit}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        ))}
                        {/* 전체 합계 (다중 품목) */}
                        {groupedEntries.length > 1 && (() => {
                            const unitTotals: Record<string, number> = {};
                            groupedEntries.forEach(([, entries]) => {
                                const unit = entries[0].unit;
                                const total = entries.reduce((s, e) => s + Number(quantities[`${e.cropName}:${e.grade}`] || 0), 0);
                                unitTotals[unit] = (unitTotals[unit] || 0) + total;
                            });
                            return (
                                <div className="flex items-center justify-between bg-indigo-50/50 rounded-2xl border border-indigo-100 px-4 py-3">
                                    <span className="text-xs font-black text-indigo-600">전체 합계</span>
                                    <span className="text-sm font-black text-indigo-700">
                                        {Object.entries(unitTotals).map(([u, q]) => `${q.toLocaleString()} ${u}`).join('  ·  ')}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>

                    {/* 정산 섹션 */}
                    {showSettlement && (
                        <>
                            <div className="border-t-2 border-dashed border-slate-100 pt-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase px-1">정산 정보</p>
                            </div>

                            {/* 예상금액 (단가 × 수량 자동계산) */}
                            {expectedTotal > 0 && (
                                <div className="bg-blue-50 rounded-2xl p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-blue-400 uppercase">예상금액</p>
                                        <p className="text-[9px] text-blue-300 font-bold">단가 × 수량 자동계산</p>
                                    </div>
                                    <span className="text-xl font-black text-blue-700">{expectedTotal.toLocaleString()}원</span>
                                </div>
                            )}

                            {/* 정산일 (finance만) */}
                            {mode === 'finance' && (
                                <div className="bg-slate-50 rounded-2xl p-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">정산일 (입금일)</p>
                                    <input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)}
                                        className="bg-transparent text-sm font-black text-slate-800 outline-none w-full" />
                                </div>
                            )}

                            {/* 실입금액 */}
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">실입금액</p>
                                <div className="flex items-center gap-2">
                                    <input type="text" inputMode="numeric"
                                        value={actualAmount}
                                        onChange={e => setActualAmount(
                                            e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                        )}
                                        placeholder="0"
                                        className="flex-1 bg-transparent text-2xl font-black text-slate-800 outline-none text-right" />
                                    <span className="text-sm font-black text-slate-400">원</span>
                                </div>
                                {deduction !== null && (
                                    <div className={`flex items-center justify-between pt-2 mt-2 border-t ${deduction < 0 ? 'border-rose-100' : 'border-emerald-100'}`}>
                                        <span className="text-[10px] font-black text-slate-500">차액</span>
                                        <div className="text-right">
                                            <span className={`text-base font-black ${deduction < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {deduction > 0 ? '+' : ''}{deduction.toLocaleString()}원
                                            </span>
                                            {deduction < 0 && (
                                                <p className="text-[9px] text-rose-400 font-bold">공제 발생 → 사유 선택 권장</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 차액 사유 */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                    차액 사유 <span className="text-slate-300 normal-case font-bold">(선택)</span>
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {DEDUCTION_REASONS.map(r => (
                                        <button key={r}
                                            onClick={() => setDeductionReason(prev => prev === r ? '' : r)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${deductionReason === r
                                                ? 'bg-rose-500 text-white border-rose-500'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-rose-200'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 결제수단 */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">결제수단</p>
                                <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
                                    {PAYMENT_METHODS.map(m => (
                                        <button key={m} onClick={() => setPaymentMethod(m)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${paymentMethod === m ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 메모 */}
                            <div className="bg-slate-50 rounded-2xl p-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                    메모 <span className="text-slate-300 normal-case font-bold">(선택)</span>
                                </p>
                                <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
                                    placeholder="예: 운임 공제 후 입금"
                                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300" />
                            </div>
                        </>
                    )}
                </div>

                {/* 하단 버튼 */}
                <div className="flex gap-2 p-5 pt-3 border-t border-slate-100 shrink-0">
                    <button onClick={onClose}
                        className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm">
                        취소
                    </button>
                    {onDelete && (
                        <button onClick={onDelete}
                            className="flex-1 py-3.5 rounded-2xl bg-rose-50 text-rose-500 font-black text-sm hover:bg-rose-100 transition-all">
                            삭제
                        </button>
                    )}
                    {mode === 'finance' ? (
                        <>
                            <button onClick={() => handleSave(true)} disabled={saving}
                                className="flex-[1.5] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white shadow-lg shadow-blue-100 transition-all">
                                <Save className="w-4 h-4" />단가 저장
                            </button>
                            <button onClick={() => handleSave(false)} disabled={saving}
                                className={`flex-[2] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95 ${saving ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600"} text-white`}>
                                {saving
                                    ? <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />저장 중...</>
                                    : <><ShoppingCart className="w-4 h-4" />정산완료</>
                                }
                            </button>
                        </>
                    ) : (
                        <button onClick={() => handleSave(false)} disabled={saving}
                            className={`flex-[2] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${saving ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600"} text-white`}>
                            {saving ? (
                                <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />저장 중...</>
                            ) : (mode === 'bulk-edit' && paymentStatus === 'pending') ? (
                                <><Save className="w-4 h-4" />저장</>
                            ) : (
                                <><ShoppingCart className="w-4 h-4" />정산완료로 저장</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
