"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, Edit2, Trash2, History, RefreshCcw, Save, ShoppingCart, ChevronDown, Calendar as CalendarIcon, X } from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase, SalesRecord, Partner } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import CalendarComponent from "@/components/Calendar";

const getCropIcon = (cropName: string) => {
    if (!cropName) return '📦';
    if (cropName.includes('딸기')) return '🍓';
    if (cropName.includes('감자')) return '🥔';
    if (cropName.includes('고구마')) return '🍠';
    if (cropName.includes('토마토')) return '🍅';
    if (cropName.includes('사과')) return '🍎';
    if (cropName.includes('포도') || cropName.includes('샤인머스캣')) return '🍇';
    if (cropName.includes('배')) return '🍐';
    if (cropName.includes('복숭아')) return '🍑';
    if (cropName.includes('오이')) return '🥒';
    if (cropName.includes('상추')) return '🥬';
    if (cropName.includes('당근')) return '🥕';
    if (cropName.includes('고추')) return '🌶️';
    if (cropName.includes('마늘')) return '🧄';
    if (cropName.includes('양파')) return '🧅';
    return '📦';
};

const toLocalDateStr = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function BulkSalesPage() {
    const { farm, initialized } = useAuthStore();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [history, setHistory] = useState<SalesRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(toLocalDateStr());
    const [showCalendar, setShowCalendar] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [farmCrops, setFarmCrops] = useState<any[]>([]);
    const [expandedPartners, setExpandedPartners] = useState<string[]>([]);

    // 수정 모달 state
    const [editModal, setEditModal] = useState<{ open: boolean; records: any[]; companyName: string }>({ open: false, records: [], companyName: '' });
    const [modalDate, setModalDate] = useState('');
    const [modalQties, setModalQties] = useState<Record<string, string>>({}); // { [grade]: qty }
    const [modalPaymentMethod, setModalPaymentMethod] = useState('카드');
    const [modalPaymentStatus, setModalPaymentStatus] = useState<'pending' | 'completed'>('pending');
    const [modalSaving, setModalSaving] = useState(false);
    const [compoundSourceIds, setCompoundSourceIds] = useState<string[]>([]); // 구형 복합 레코드 ID

    // B2B State
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [bulkQtySang, setBulkQtySang] = useState("");
    const [bulkQtyJung, setBulkQtyJung] = useState("");
    const [bulkQtyHa, setBulkQtyHa] = useState("");

    // Common State
    const [cropName, setCropName] = useState('딸기');
    const [saleUnit, setSaleUnit] = useState('박스');

    // 바로 정산 시트
    const [showSettlementSheet, setShowSettlementSheet] = useState(false);
    const [sheetPaymentMethod, setSheetPaymentMethod] = useState('카드');
    const [sheetUnitPrices, setSheetUnitPrices] = useState<Record<string, string>>({}); // { [grade]: unitPrice }
    const [sheetActualAmount, setSheetActualAmount] = useState('');
    const [sheetDeductionReason, setSheetDeductionReason] = useState('');
    const [sheetMemo, setSheetMemo] = useState('');

    useEffect(() => {
        const fetchFarmCrops = async () => {
            if (!farm?.id) return;
            const { data } = await supabase.from('farm_crops').select('*').eq('farm_id', farm.id).is('is_active', true).order('sort_order');
            if (data) {
                setFarmCrops(data);
                if (data.length > 0) {
                    const strawberry = data.find((c: any) => c.crop_name === '딸기');
                    if (strawberry) { setCropName('딸기'); setSaleUnit(strawberry.available_units?.[0] || '박스'); }
                    else { setCropName(data[0].crop_name); setSaleUnit(data[0].available_units?.[0] || '박스'); }
                }
            }
        };
        fetchFarmCrops();
    }, [farm?.id]);

    const fetchInitialData = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);
        try {
            const partnersRes = await supabase.from('partners').select('*').eq('farm_id', farm.id).order('company_name');
            if (partnersRes.data) setPartners(partnersRes.data);
            await fetchHistory();
        } finally { setLoading(false); }
    }, [farm?.id]);

    const fetchHistory = async () => {
        if (!farm?.id) return;
        const { data } = await supabase
            .from('sales_records')
            .select(`*, partner:partners(*)`)
            .eq('farm_id', farm.id)
            .neq('delivery_method', 'courier') // B2B(bulk) 만 가져옴
            .eq('is_settled', false) // 미정산 항목만 표시
            .order('recorded_at', { ascending: false })
            .limit(30);
        if (data) setHistory(data);
    };

    useEffect(() => { if (initialized && farm?.id) fetchInitialData(); }, [initialized, farm?.id, fetchInitialData]);

    const handleResetAllStates = () => {
        setEditingRecordId(null); setSelectedClientId(""); setBulkQtySang(""); setBulkQtyJung(""); setBulkQtyHa("");
    };

    const buildGrades = () => [
        { grade: '특/상', qty: bulkQtySang }, { grade: '중', qty: bulkQtyJung }, { grade: '하', qty: bulkQtyHa }
    ].filter(g => Number(g.qty) > 0);

    const handleSavePending = async () => {
        if (!farm?.id || saving) return;
        if (!selectedClientId) { alert("거래처를 선택해주세요."); return; }
        const grades = buildGrades();
        if (grades.length === 0) { alert("수량을 입력해주세요."); return; }
        setSaving(true);
        try {
            for (const g of grades) {
                const { error } = await supabase.from('sales_records').insert([{
                    farm_id: farm.id, partner_id: selectedClientId, crop_name: cropName, sale_unit: saleUnit,
                    quantity: Number(g.qty), grade: g.grade,
                    is_settled: false, payment_status: 'pending',
                    delivery_method: 'direct', sale_type: 'b2b',
                    recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0]
                }]);
                if (error) throw error;
            }
            handleResetAllStates();
            setTimeout(() => fetchHistory(), 200);
            alert("✅ 납품 기록이 저장되었습니다! (미정산)");
        } catch (error: any) {
            alert("저장 실패: " + (error.message || "알 수 없는 오류"));
        } finally { setSaving(false); }
    };

    const handleSaveSettled = async () => {
        if (!farm?.id || saving) return;
        if (!selectedClientId) { alert("거래처를 선택해주세요."); setShowSettlementSheet(false); return; }
        const grades = buildGrades();
        if (grades.length === 0) { alert("수량을 입력해주세요."); setShowSettlementSheet(false); return; }
        setSaving(true);
        try {
            const actualTotal = sheetActualAmount ? Number(sheetActualAmount) : null;
            // 등급별 예상금액 합계 (비례 분배 기준)
            const totalExpected = grades.reduce((sum, g) => {
                const up = sheetUnitPrices[g.grade] ? Number(sheetUnitPrices[g.grade]) : 0;
                return sum + up * Number(g.qty);
            }, 0);
            const totalQtyForSave = grades.reduce((sum, g) => sum + Number(g.qty), 0);
            for (const g of grades) {
                const gradeQty = Number(g.qty);
                const up = sheetUnitPrices[g.grade] ? Number(sheetUnitPrices[g.grade]) : null;
                const gradePrice = up ? up * gradeQty : null;
                // 실입금액 비례 분배: 단가 있으면 예상금액 기준, 없으면 수량 기준
                const gradeSettled = actualTotal
                    ? totalExpected > 0 && gradePrice
                        ? Math.round(actualTotal * gradePrice / totalExpected)
                        : totalQtyForSave > 0
                            ? Math.round(actualTotal * gradeQty / totalQtyForSave)
                            : actualTotal
                    : null;
                const { error } = await supabase.from('sales_records').insert([{
                    farm_id: farm.id, partner_id: selectedClientId, crop_name: cropName, sale_unit: saleUnit,
                    quantity: gradeQty, grade: g.grade,
                    is_settled: true, payment_status: 'completed', payment_method: sheetPaymentMethod,
                    price: gradePrice,
                    settled_amount: gradeSettled,
                    harvest_note: sheetDeductionReason || null,  // 차액사유 카테고리 (필터링용)
                    delivery_note: sheetMemo || null,            // 메모 텍스트
                    delivery_method: 'direct', sale_type: 'b2b',
                    recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0]
                }]);
                if (error) throw error;
            }
            setShowSettlementSheet(false);
            setSheetUnitPrices({}); setSheetActualAmount(''); setSheetDeductionReason(''); setSheetMemo('');
            handleResetAllStates();
            setTimeout(() => fetchHistory(), 200);
            alert("✅ 납품 기록이 저장되었습니다! (정산 완료)");
        } catch (error: any) {
            alert("저장 실패: " + (error.message || "알 수 없는 오류"));
        } finally { setSaving(false); }
    };

    // 구형 복합 grade 문자열 파싱: "특/상:60,중:20,하:20" → { '특/상': 60, '중': 20, '하': 20 }
    const parseGradeString = (gradeStr: string, fallbackQty: number): Record<string, number> => {
        if (!gradeStr) return { '특/상': fallbackQty };
        if (['특/상', '중', '하'].includes(gradeStr)) return { [gradeStr]: fallbackQty };
        const result: Record<string, number> = {};
        let parsed = false;
        for (const part of gradeStr.split(',')) {
            const trimmed = part.trim();
            const colonIdx = trimmed.lastIndexOf(':');
            if (colonIdx > 0) {
                const g = trimmed.substring(0, colonIdx).trim();
                const q = parseInt(trimmed.substring(colonIdx + 1).trim());
                if (!isNaN(q)) { result[g] = (result[g] || 0) + q; parsed = true; }
            }
        }
        return parsed ? result : { [gradeStr]: fallbackQty };
    };

    const handleEditModal = (records: any[], companyName: string) => {
        const first = records[0];
        setModalDate(first.recorded_at.split('T')[0]);
        setModalPaymentMethod(first?.payment_method || '카드');
        setModalPaymentStatus((first?.payment_status as 'pending' | 'completed') || 'pending');

        const gradeOrder = ['특/상', '중', '하'];
        const gradeQtyMap: Record<string, number> = {};
        const gradeRecordMap: Record<string, any> = {};
        const srcIds = new Set<string>();

        records.forEach(rec => {
            const gradeStr = rec.grade || '';
            if (['특/상', '중', '하'].includes(gradeStr)) {
                // 신형: 등급 1개 = 레코드 1개
                gradeQtyMap[gradeStr] = (gradeQtyMap[gradeStr] || 0) + (rec.quantity || 0);
                gradeRecordMap[gradeStr] = rec;
            } else {
                // 구형 복합 포맷 파싱
                const parsed = parseGradeString(gradeStr, rec.quantity || 0);
                for (const [g, q] of Object.entries(parsed)) {
                    gradeQtyMap[g] = (gradeQtyMap[g] || 0) + q;
                    if (!gradeRecordMap[g]) {
                        gradeRecordMap[g] = { ...rec, id: null, grade: g, quantity: q, _isCompound: true };
                    }
                }
                if (rec.id) srcIds.add(rec.id);
            }
        });

        const fullRecords = gradeOrder.map(grade =>
            gradeRecordMap[grade] || {
                id: null, grade, quantity: 0,
                sale_unit: first.sale_unit || '박스',
                recorded_at: first.recorded_at,
                farm_id: first.farm_id,
                partner_id: first.partner_id,
                crop_name: first.crop_name,
            }
        );

        const qties: Record<string, string> = {};
        gradeOrder.forEach(grade => { qties[grade] = (gradeQtyMap[grade] || 0).toString(); });
        setModalQties(qties);
        setCompoundSourceIds(Array.from(srcIds));
        setEditModal({ open: true, records: fullRecords, companyName });
    };

    const handleModalSave = async () => {
        if (!editModal.records.length || modalSaving || !farm?.id) return;
        setModalSaving(true);
        try {
            const first = editModal.records[0];
            const timeStr = first.recorded_at.split('T')[1] || new Date().toTimeString().split(' ')[0];
            const baseData = {
                farm_id: farm.id,
                partner_id: first.partner_id,
                crop_name: first.crop_name,
                sale_unit: first.sale_unit,
                recorded_at: modalDate + 'T' + timeStr,
                payment_method: modalPaymentMethod,
                payment_status: modalPaymentStatus,
                is_settled: modalPaymentStatus === 'completed',
                delivery_method: 'direct',
                sale_type: 'b2b',
            };

            // 1. 구형 복합 레코드 삭제
            for (const srcId of compoundSourceIds) {
                await supabase.from('sales_records').delete().eq('id', srcId);
            }

            // 2. 각 등급 처리
            for (const rec of editModal.records) {
                const qty = Number(modalQties[rec.grade] || '0');
                if (rec.id && !rec._isCompound) {
                    // 신형 기존 레코드: 수량 0이면 삭제, 아니면 업데이트
                    if (qty === 0) {
                        await supabase.from('sales_records').delete().eq('id', rec.id);
                    } else {
                        const { error } = await supabase.from('sales_records').update({
                            recorded_at: modalDate + 'T' + timeStr,
                            quantity: qty,
                            payment_method: modalPaymentMethod,
                            payment_status: modalPaymentStatus,
                            is_settled: modalPaymentStatus === 'completed',
                        }).eq('id', rec.id);
                        if (error) { alert('저장 실패: ' + error.message); return; }
                    }
                } else if (qty > 0) {
                    // 신규 또는 구형 복합에서 분리된 등급 → INSERT
                    const { error } = await supabase.from('sales_records').insert({ ...baseData, quantity: qty, grade: rec.grade });
                    if (error) { alert('저장 실패: ' + error.message); return; }
                }
            }

            setEditModal({ open: false, records: [], companyName: '' });
            setCompoundSourceIds([]);
            fetchHistory();
        } catch (error: any) {
            console.error('수정 모달 저장 오류:', error);
            alert('저장 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
        } finally {
            setModalSaving(false);
        }
    };

    const handleDelete = async (id: string) => { if (!confirm("삭제하시겠습니까?")) return; const { error } = await supabase.from('sales_records').delete().eq('id', id); if (!error) fetchHistory(); };

    const groupedHistory = useMemo(() => {
        // partner → date → transaction(recorded_at 기준) → records
        const partnerMap = new Map<string, {
            partnerId: string | null; companyName: string; totalAmount: number;
            qtyByUnit: Record<string, number>;
            dailyMap: Map<string, Map<string, any[]>>;
        }>();
        history.forEach(rec => {
            const displayName = (rec as any).partner?.company_name || rec.customer_name || '미지정';
            const pKey = rec.partner_id || `no-id-${displayName}`;
            if (!partnerMap.has(pKey)) {
                partnerMap.set(pKey, { partnerId: rec.partner_id || null, companyName: displayName, totalAmount: 0, qtyByUnit: {}, dailyMap: new Map() });
            }
            const pGroup = partnerMap.get(pKey)!;
            const recUnit = rec.sale_unit || '박스';
            pGroup.qtyByUnit[recUnit] = (pGroup.qtyByUnit[recUnit] || 0) + (rec.quantity || 0);
            pGroup.totalAmount += rec.price || 0;
            const date = rec.recorded_at.split('T')[0];
            if (!pGroup.dailyMap.has(date)) pGroup.dailyMap.set(date, new Map());
            const txKey = rec.recorded_at; // 같은 recorded_at = 같은 거래
            const dayMap = pGroup.dailyMap.get(date)!;
            if (!dayMap.has(txKey)) dayMap.set(txKey, []);
            dayMap.get(txKey)!.push(rec);
        });
        return Array.from(partnerMap.values()).map(p => ({
            partnerId: p.partnerId, companyName: p.companyName, qtyByUnit: p.qtyByUnit, totalAmount: p.totalAmount,
            dailyGroups: Array.from(p.dailyMap.entries())
                .map(([date, txMap]) => ({
                    date,
                    transactions: Array.from(txMap.values()).map(records => {
                        const cropName = records[0].crop_name || '';
                        const txQtyByUnit = records.reduce((acc: any, r: any) => {
                            const u = r.sale_unit || '박스';
                            acc[u] = (acc[u] || 0) + (r.quantity || 0);
                            return acc;
                        }, {});
                        return {
                            txKey: records[0].recorded_at,
                            records,
                            cropName,
                            qtyByUnit: txQtyByUnit,
                        };
                    })
                }))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }));
    }, [history]);

    const DEDUCTION_REASONS = ['조합공제', '운임공제', '품질하락', '시세조정', '선불차감', '기타'];

    // 바로 정산 시트 계산값 (선언 순서 수정: sheetGradesSummary를 먼저 선언)
    const sheetGradesSummary = [
        { grade: '특/상', qty: Number(bulkQtySang || 0) },
        { grade: '중', qty: Number(bulkQtyJung || 0) },
        { grade: '하', qty: Number(bulkQtyHa || 0) },
    ].filter(g => g.qty > 0);
    const sheetTotalQty = Number(bulkQtySang || 0) + Number(bulkQtyJung || 0) + Number(bulkQtyHa || 0);
    const sheetExpected = sheetGradesSummary.reduce((sum, g) => {
        const up = sheetUnitPrices[g.grade] ? Number(sheetUnitPrices[g.grade]) : 0;
        return sum + up * g.qty;
    }, 0);
    const sheetActualNum = sheetActualAmount ? Number(sheetActualAmount) : 0;
    const sheetDeduction = (sheetExpected && sheetActualNum) ? sheetExpected - sheetActualNum : null;
    const closeSheet = () => { setShowSettlementSheet(false); setSheetUnitPrices({}); setSheetActualAmount(''); setSheetDeductionReason(''); setSheetMemo(''); };

    return (
        <div className="min-h-screen pb-20 bg-slate-50/30">

            {/* 바로 정산 바텀시트 */}
            {showSettlementSheet && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={closeSheet}>
                    <div className="bg-white w-full max-w-md rounded-t-[2rem] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={e => e.stopPropagation()}>
                        {/* 드래그 핸들 */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-slate-200" />
                        </div>
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">즉시 정산</p>
                                <p className="text-sm font-black text-slate-900">바로 정산</p>
                            </div>
                            <button onClick={closeSheet}
                                className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* 스크롤 가능한 폼 */}
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            {/* 단가 (등급별) - 납품 요약 제거: 이미 상단에 표시됨 */}
                            <div className="bg-slate-50 rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase">단가 (등급별)</p>
                                    {partners.find(p => p.id === selectedClientId)?.default_unit_price && (
                                        <span className="text-[9px] font-bold text-indigo-400">기본단가 자동입력됨</span>
                                    )}
                                </div>
                                {sheetGradesSummary.length > 0 ? sheetGradesSummary.map(g => {
                                    const subtotal = sheetUnitPrices[g.grade] ? Number(sheetUnitPrices[g.grade]) * g.qty : 0;
                                    return (
                                        <div key={g.grade} className="px-4 py-2.5 border-t border-slate-100">
                                            {/* 등급·수량 + 단가 입력 */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-indigo-500 w-9 shrink-0">{g.grade}</span>
                                                <span className="text-[10px] font-bold text-slate-400 shrink-0">{g.qty}{saleUnit}</span>
                                                <div className="flex items-center gap-1 ml-auto">
                                                    <input type="text" inputMode="numeric"
                                                        value={sheetUnitPrices[g.grade] ? Number(sheetUnitPrices[g.grade]).toLocaleString() : ''}
                                                        onChange={e => setSheetUnitPrices(prev => ({ ...prev, [g.grade]: e.target.value.replace(/[^0-9]/g, '') }))}
                                                        placeholder="단가"
                                                        className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-right text-sm font-black text-slate-800 outline-none focus:border-indigo-300 transition-all" />
                                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">원</span>
                                                </div>
                                            </div>
                                            {/* 소계 (별도 줄) */}
                                            {subtotal > 0 && (
                                                <p className="text-right text-[10px] font-black text-emerald-600 mt-1 pr-1">
                                                    = {subtotal.toLocaleString()}원
                                                </p>
                                            )}
                                        </div>
                                    );
                                }) : <p className="px-4 py-3 text-xs text-slate-300 font-bold border-t border-slate-100">수량 입력 후 단가를 입력하세요</p>}
                                {sheetExpected > 0 && (
                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-100 border-t border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-500">예상 총액</span>
                                        <span className="text-sm font-black text-slate-700">{sheetExpected.toLocaleString()}원</span>
                                    </div>
                                )}
                            </div>
                            {/* 결제수단 */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">결제수단</p>
                                <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
                                    {['카드', '현금', '계좌이체'].map(m => (
                                        <button key={m} onClick={() => setSheetPaymentMethod(m)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all
                                        ${sheetPaymentMethod === m ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* 실입금액 + 차액 */}
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">실입금액</p>
                                <div className="flex items-center gap-2">
                                    <input type="text" inputMode="numeric"
                                        value={sheetActualAmount ? Number(sheetActualAmount).toLocaleString() : ''}
                                        onChange={e => setSheetActualAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="0"
                                        className="flex-1 bg-transparent text-2xl font-black text-slate-800 outline-none text-right" />
                                    <span className="text-sm font-black text-slate-400">원</span>
                                </div>
                                {sheetDeduction !== null && (
                                    <div className={`flex items-center justify-between pt-2 mt-2 border-t ${sheetDeduction < 0 ? 'border-rose-100' : 'border-emerald-100'}`}>
                                        <span className="text-[10px] font-black text-slate-500">차액 (사정액)</span>
                                        <div className="text-right">
                                            <span className={`text-base font-black ${sheetDeduction < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {sheetDeduction > 0 ? '+' : ''}{sheetDeduction.toLocaleString()}원
                                            </span>
                                            {sheetDeduction < 0 && (
                                                <p className="text-[9px] text-rose-400 font-bold">공제 발생 → 사유 선택 권장</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* 차액사유 (선택) */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                    차액 사유 <span className="text-slate-300 normal-case font-bold">(선택 · 업체별 집계 가능)</span>
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {DEDUCTION_REASONS.map(r => (
                                        <button key={r}
                                            onClick={() => setSheetDeductionReason(sheetDeductionReason === r ? '' : r)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border
                                        ${sheetDeductionReason === r
                                                    ? 'bg-rose-500 text-white border-rose-500'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-rose-200'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* 메모 (선택) */}
                            <div className="bg-slate-50 rounded-2xl p-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                    메모 <span className="text-slate-300 normal-case font-bold">(선택)</span>
                                </p>
                                <input type="text" value={sheetMemo} onChange={e => setSheetMemo(e.target.value)}
                                    placeholder="예: 운임 3,000원 공제 후 입금"
                                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300" />
                            </div>
                        </div>
                        {/* 하단 고정 버튼 */}
                        <div className="flex gap-2 p-5 pt-3 border-t border-slate-100 shrink-0">
                            <button onClick={closeSheet}
                                className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm">
                                취소
                            </button>
                            <button onClick={handleSaveSettled} disabled={saving}
                                className={`flex-[2] py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all
                            ${saving ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'} text-white`}>
                                {saving ? (
                                    <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>저장 중...</>
                                ) : (
                                    <><ShoppingCart className="w-4 h-4" /> 정산 완료로 저장</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 수정 모달 */}
            {editModal.open && editModal.records.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4"
                    onClick={() => { setEditModal({ open: false, records: [], companyName: '' }); setCompoundSourceIds([]); }}>
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}>
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">납품 내역 수정</p>
                                <p className="text-sm font-black text-slate-900">{editModal.companyName}</p>
                            </div>
                            <button onClick={() => { setEditModal({ open: false, records: [], companyName: '' }); setCompoundSourceIds([]); }}
                                className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* 폼 */}
                        <div className="p-5 space-y-4">
                            {/* 날짜 */}
                            <div className="bg-slate-50 rounded-2xl p-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">날짜</p>
                                <input type="date" value={modalDate} onChange={e => setModalDate(e.target.value)}
                                    className="bg-transparent text-sm font-black text-slate-800 outline-none w-full" />
                            </div>
                            {/* 등급별 수량 */}
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase px-1">등급별 수량</p>
                                <p className="text-[10px] text-slate-500 px-1 mb-1">
                                    각 등급별로 수량을 개별적으로 수정할 수 있습니다. 수정하지 않은 등급은 원래 값이 유지됩니다.
                                </p>
                                {editModal.records.map(rec => (
                                    <div key={rec.grade} className="flex items-center gap-3 bg-slate-50/50 rounded-2xl border border-slate-100 px-4 py-3">
                                        <span className="text-xs font-black text-indigo-500 w-14 shrink-0 whitespace-nowrap">{rec.grade}</span>
                                        <input type="text" inputMode="numeric"
                                            value={modalQties[rec.grade] ?? ''}
                                            onChange={e => setModalQties(prev => ({ ...prev, [rec.grade]: e.target.value.replace(/[^0-9]/g, '') }))}
                                            className="flex-1 bg-transparent text-center text-xl font-black text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:bg-white rounded-lg transition-all" placeholder="0" />
                                        <span className="text-xs font-bold text-slate-400 shrink-0">{rec.sale_unit}</span>
                                    </div>
                                ))}
                                {/* 합계 표시 */}
                                <div className="flex items-center justify-between bg-indigo-50/50 rounded-2xl border border-indigo-100 px-4 py-3 mt-2">
                                    <span className="text-xs font-black text-indigo-600">합계</span>
                                    <div className="text-right">
                                        <span className="text-xl font-black text-indigo-700">
                                            {editModal.records.reduce((sum, rec) => sum + Number(modalQties[rec.grade] || 0), 0)}
                                        </span>
                                        <span className="text-xs font-bold text-indigo-400 ml-1">
                                            {editModal.records[0]?.sale_unit || '박스'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* 결제수단 + 정산상태 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                    {['카드', '현금', '계좌'].map(m => (
                                        <button key={m} onClick={() => setModalPaymentMethod(m)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${modalPaymentMethod === m ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setModalPaymentStatus(modalPaymentStatus === 'completed' ? 'pending' : 'completed')}
                                    className={`py-3 rounded-xl border-2 font-black text-xs transition-all ${modalPaymentStatus === 'completed' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-amber-400 bg-amber-50 text-amber-600'}`}>
                                    {modalPaymentStatus === 'completed' ? '정산 완료' : '미정산 (외상)'}
                                </button>
                            </div>
                            {/* 저장/취소/삭제 */}
                            <div className="flex gap-2 pt-1">
                                <button onClick={() => { setEditModal({ open: false, records: [], companyName: '' }); setCompoundSourceIds([]); }}
                                    className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm">
                                    취소
                                </button>
                                <button onClick={() => {
                                    if (confirm("정말 삭제하시겠습니까? 삭제하시면 되돌릴 수 없으니, 자세히 확인 후 삭제하기 바랍니다.")) {
                                        // 모든 모달 레코드 삭제 처리
                                        Promise.all(editModal.records.map(rec => supabase.from('sales_records').delete().eq('id', rec.id)))
                                            .then(() => {
                                                setEditModal({ open: false, records: [], companyName: '' });
                                                setCompoundSourceIds([]);
                                                fetchHistory();
                                            })
                                            .catch((err) => alert("삭제 중 오류가 발생했습니다: " + err.message));
                                    }
                                }}
                                    className="flex-1 py-3 rounded-2xl bg-rose-50 text-rose-500 font-black text-sm hover:bg-rose-100 transition-all">
                                    삭제하기
                                </button>
                                <button onClick={handleModalSave} disabled={modalSaving}
                                    className={`flex-[1.5] py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${modalSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                                    {modalSaving ? (
                                        <>
                                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                            저장 중
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" /> 저장하기
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="max-w-2xl mx-auto p-3 md:p-3 space-y-4">

                <div className="flex items-center justify-between px-1 gap-2">
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                            납품 <Building2 className="w-4 h-4 text-indigo-500" />
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            <span className="text-[10px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                                {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                            </span>
                        </div>
                    </div>
                    <button onClick={() => setShowCalendar(!showCalendar)}
                        className={`h-10 px-4 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md border-2 shrink-0
                        ${showCalendar ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'}`}>
                        <CalendarIcon className="w-4 h-4" /> {showCalendar ? '닫기' : '날짜변경'}
                    </button>
                </div>

                {showCalendar && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                        <CalendarComponent selectedDate={selectedDate} onChange={setSelectedDate} harvestedDates={{}} />
                        <div className="mt-2 flex items-center justify-center p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-sm font-black text-slate-700 outline-none w-full text-center" />
                        </div>
                    </div>
                )}

                <div className="relative bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-white shadow-sm space-y-4">
                    {/* 작물 선택 그리드 */}
                    <div className="flex gap-2">
                        {farmCrops.map((crop, idx) => (
                            <button key={crop.id}
                                onClick={() => {
                                    setCropName(crop.crop_name);
                                    if (crop.available_units?.length > 0) setSaleUnit(crop.available_units[0]);
                                }}
                                className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl border-2 transition-all gap-1 min-w-0 relative
                                    ${cropName === crop.crop_name ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-2 ring-indigo-100 z-10' : 'bg-white border-slate-50 opacity-40 hover:opacity-100'}`}>
                                <span className="text-3xl leading-none mb-1">{getCropIcon(crop.crop_name)}</span>
                                <span className="text-[10px] font-black text-slate-800 tracking-tighter truncate w-full text-center px-1">{crop.crop_name}</span>

                                {/* 선택 표시 인디케이터 (삼각형) */}
                                {cropName === crop.crop_name && (
                                    <div className="absolute -bottom-[21px] border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px] border-b-slate-100 z-20"></div>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* [이동형 단위 선택창] 선택된 작물과 연결된 느낌 */}
                    <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex gap-1.5 overflow-x-auto scrollbar-hide">
                        {farmCrops.find(c => c.crop_name === cropName)?.available_units?.map((unit: string) => (
                            <button key={unit} onClick={() => setSaleUnit(unit)}
                                className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all whitespace-nowrap px-4
                                ${saleUnit === unit ? 'bg-indigo-600 text-white shadow-lg scale-[1.02]' : 'bg-white text-slate-400 border border-slate-100 opacity-60'}`}>
                                {unit}
                            </button>
                        )) || <div className="p-2 text-[10px] text-slate-400 font-bold w-full text-center">선택 가능한 단위가 없습니다</div>}
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] shadow-xl border border-indigo-100 p-5 space-y-3">
                    {editingRecordId && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5">
                            <span className="text-sm">✏️</span>
                            <span className="text-xs font-black text-amber-700">
                                수정 중: {partners.find(p => p.id === selectedClientId)?.company_name || '거래처'}
                            </span>
                        </div>
                    )}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-indigo-500 uppercase px-1">거래처 선택</label>
                            <div className="relative">
                                <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black appearance-none outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner">
                                    <option value="">거래처를 골라주세요</option>
                                    {partners.map(p => <option key={p.id} value={p.id}>{p.company_name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[{ label: '특/상', val: bulkQtySang, set: setBulkQtySang }, { label: '중', val: bulkQtyJung, set: setBulkQtyJung }, { label: '하', val: bulkQtyHa, set: setBulkQtyHa }].map((item, i) => (
                                <div key={i} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-400 mb-1">{item.label}</span>
                                    <input type="text" inputMode="numeric" value={item.val} onChange={(e) => item.set(e.target.value.replace(/[^0-9]/g, ''))}
                                        className="w-full bg-transparent text-center text-xl font-black text-slate-800 outline-none" placeholder="0" />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 pt-4 border-t border-slate-100">
                            <button onClick={handleSavePending} disabled={saving}
                                className="flex-1 py-4 rounded-[1.25rem] text-sm font-black text-amber-700 bg-amber-50 border-2 border-amber-300 shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                                {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> 미정산 저장</>}
                            </button>
                            <button onClick={() => {
                                const partner = partners.find(p => p.id === selectedClientId);
                                if (partner?.default_unit_price) {
                                    const dp = String(partner.default_unit_price);
                                    setSheetUnitPrices({ '특/상': dp, '중': dp, '하': dp });
                                }
                                setShowSettlementSheet(true);
                            }} disabled={saving}
                                className="flex-1 py-4 rounded-[1.25rem] text-sm font-black text-white bg-emerald-500 shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                                <ShoppingCart className="w-4 h-4" /> 바로 정산
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 pb-10">
                    <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 px-1">
                        <History className="w-4 h-4 text-slate-300" /> 미결산 납품 내역
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                            {groupedHistory.reduce((acc, p) => acc + p.dailyGroups.length, 0)}건
                        </span>
                    </h2>
                    {groupedHistory.length === 0 ? (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-100 py-10 text-center">
                            <p className="text-xs font-bold text-slate-400">미결산 납품 내역이 없습니다 🎉</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {groupedHistory.map(pGroup => {
                                const pKey = pGroup.partnerId || `no-id-${pGroup.companyName}`;
                                const isExpanded = expandedPartners.includes(pKey);
                                return (
                                    <div key={pKey} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        {/* 거래처 헤더 */}
                                        <button
                                            onClick={() => setExpandedPartners(prev => isExpanded ? prev.filter(k => k !== pKey) : [...prev, pKey])}
                                            className="w-full px-4 py-3 flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                                                <div className="text-left min-w-0">
                                                    <p className="text-sm font-black text-slate-900 truncate">{pGroup.companyName}</p>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold mt-0.5">
                                                        <span className="text-slate-400">{pGroup.dailyGroups.length}건</span>
                                                        <span className="text-slate-200">|</span>
                                                        <span className="text-amber-500">미결산</span>
                                                        <span className="text-slate-200">|</span>
                                                        <span className="text-slate-500 truncate">{Object.entries(pGroup.qtyByUnit || {}).map(([u, q]) => `${(q as number).toLocaleString()}${u}`).join(', ')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-slate-300 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* 날짜별 상세 - 수정된 부분 (날짜별 카드 디자인) */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-50">
                                                {pGroup.dailyGroups.map(dGroup => (
                                                    <div key={dGroup.date} className="p-3 border-b border-slate-100 last:border-b-0">
                                                        {/* 날짜별 카드 */}
                                                        <div className="border-4 border-green-500 rounded-xl overflow-hidden">
                                                            {/* 날짜 헤더 */}
                                                            <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                                                                <p className="text-sm font-black text-green-800">
                                                                    {new Date(dGroup.date).toLocaleDateString('ko-KR', {
                                                                        month: 'long',
                                                                        day: 'numeric',
                                                                        weekday: 'short'
                                                                    })}
                                                                </p>
                                                            </div>

                                                            {/* 판매 물품 목록 */}
                                                            <div className="p-3 bg-white space-y-2">
                                                                {dGroup.transactions.map(tx => (
                                                                    <div key={tx.txKey}
                                                                        onClick={() => handleEditModal(tx.records, pGroup.companyName)}
                                                                        className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                                                        {/* 물품 정보 */}
                                                                        <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                                                                            <span className="text-sm font-black text-slate-700 flex-shrink-0 whitespace-nowrap w-24">{getCropIcon(tx.cropName)} {tx.cropName}</span>
                                                                            <span className="font-black text-indigo-500 whitespace-nowrap">
                                                                                {tx.records.map(r => `${r.grade}:${r.quantity}`).join(', ')}
                                                                            </span>
                                                                            <span className="text-slate-300">|</span>
                                                                            <span className="font-bold text-slate-500 whitespace-nowrap">
                                                                                {Object.entries(tx.qtyByUnit || {}).map(([u, q]) => `${(q as number).toLocaleString()}${u}`).join(', ')}
                                                                            </span>
                                                                        </div>
                                                                        {/* 삭제 버튼 공간 (제거됨 - 수정모드 아이콘만 남김) */}
                                                                        <div className="flex items-center gap-1 shrink-0 px-2">
                                                                            <Edit2 className="w-3 h-3 text-slate-200 group-hover:text-indigo-400 transition-all" />
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {/* 날짜별 합계 */}
                                                                <div className="mt-2 pt-2 text-right text-[10px] font-bold text-slate-400 border-t border-dashed border-slate-200">
                                                                    총 {
                                                                        Object.entries(dGroup.transactions.reduce((acc: any, tx: any) => {
                                                                            Object.entries(tx.qtyByUnit || {}).forEach(([u, q]) => {
                                                                                acc[u] = (acc[u] || 0) + (q as number);
                                                                            });
                                                                            return acc;
                                                                        }, {})).map(([u, q]) => `${(q as number).toLocaleString()}${u}`).join(', ') || '0박스'
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}