"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, Edit2, Trash2, History, RefreshCcw, Save, ShoppingCart, ChevronDown, Calendar as CalendarIcon, X } from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase, SalesRecord, Partner } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import CalendarComponent from "@/components/Calendar";

export default function BulkSalesPage() {
    const { farm, initialized } = useAuthStore();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [history, setHistory] = useState<SalesRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [farmCrops, setFarmCrops] = useState<any[]>([]);
    const [expandedPartners, setExpandedPartners] = useState<string[]>([]);

    // 수정 모달 state
    const [editModal, setEditModal] = useState<{ open: boolean; records: any[]; companyName: string }>({ open: false, records: [], companyName: '' });
    const [modalDate, setModalDate] = useState('');
    const [modalQties, setModalQties] = useState<Record<string, string>>({}); // { [record.id]: qty }
    const [modalPaymentMethod, setModalPaymentMethod] = useState('카드');
    const [modalPaymentStatus, setModalPaymentStatus] = useState<'pending' | 'completed'>('pending');

    // B2B State
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [bulkQtySang, setBulkQtySang] = useState("");
    const [bulkQtyJung, setBulkQtyJung] = useState("");
    const [bulkQtyHa, setBulkQtyHa] = useState("");

    // Common State
    const [cropName, setCropName] = useState('딸기');
    const [saleUnit, setSaleUnit] = useState('박스');
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed'>('completed');
    const [paymentMethod, setPaymentMethod] = useState('카드');

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
        setPaymentStatus('completed'); setPaymentMethod('카드');
    };

    const handleSave = async () => {
        if (!farm?.id || saving) return;
        setSaving(true);
        try {
            if (!selectedClientId) { alert("거래처를 선택해주세요."); setSaving(false); return; }
            const grades = [{ grade: '특/상', qty: bulkQtySang }, { grade: '중', qty: bulkQtyJung }, { grade: '하', qty: bulkQtyHa }].filter(g => Number(g.qty) > 0);
            if (grades.length === 0) { alert("수량을 입력해주세요."); setSaving(false); return; }

            for (const g of grades) {
                const saleData = {
                    farm_id: farm.id, partner_id: selectedClientId, crop_name: cropName, sale_unit: saleUnit, quantity: Number(g.qty), grade: g.grade,
                    is_settled: paymentStatus === 'completed', payment_status: paymentStatus, payment_method: paymentMethod,
                    delivery_method: 'direct', sale_type: 'b2b',
                    recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0]
                };
                let result;
                if (editingRecordId) result = await supabase.from('sales_records').update(saleData).eq('id', editingRecordId);
                else result = await supabase.from('sales_records').insert([saleData]);
                if (result.error) throw result.error;
            }
            handleResetAllStates();
            setTimeout(() => fetchHistory(), 200);
            alert("✅ 납품 기록이 저장되었습니다!");
        } catch (error: any) {
            console.error("저장 오류 상세:", JSON.stringify(error, null, 2));
            alert("저장 실패: " + (error.message || "알 수 없는 오류"));
        } finally { setSaving(false); }
    };

    const handleEditModal = (records: any[], companyName: string) => {
        const first = records[0];
        setModalDate(first.recorded_at.split('T')[0]);
        setModalPaymentMethod(first?.payment_method || '카드');
        setModalPaymentStatus((first?.payment_status as 'pending' | 'completed') || 'pending');
        const qties: Record<string, string> = {};
        records.forEach(rec => { qties[rec.id] = rec.quantity?.toString() || ''; });
        setModalQties(qties);
        const gradeOrder = ['특/상', '중', '하'];
        const sorted = [...records].sort((a, b) => gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade));
        setEditModal({ open: true, records: sorted, companyName });
    };

    const handleModalSave = async () => {
        if (!editModal.records.length) return;
        for (const rec of editModal.records) {
            const qty = Number(modalQties[rec.id] || '0');
            if (qty <= 0) continue;
            const { error } = await supabase.from('sales_records').update({
                recorded_at: modalDate + 'T' + rec.recorded_at.split('T')[1],
                quantity: qty,
                payment_method: modalPaymentMethod,
                payment_status: modalPaymentStatus,
                is_settled: modalPaymentStatus === 'completed',
            }).eq('id', rec.id);
            if (error) { alert('저장 실패: ' + error.message); return; }
        }
        setEditModal({ open: false, records: [], companyName: '' });
        fetchHistory();
    };

    const handleDelete = async (id: string) => { if (!confirm("삭제하시겠습니까?")) return; const { error } = await supabase.from('sales_records').delete().eq('id', id); if (!error) fetchHistory(); };

    const groupedHistory = useMemo(() => {
        // partner → date → transaction(recorded_at 기준) → records
        const partnerMap = new Map<string, {
            partnerId: string | null; companyName: string; totalQty: number; totalAmount: number;
            dailyMap: Map<string, Map<string, any[]>>;
        }>();
        history.forEach(rec => {
            const displayName = (rec as any).partner?.company_name || rec.customer_name || '미지정';
            const pKey = rec.partner_id || `no-id-${displayName}`;
            if (!partnerMap.has(pKey)) {
                partnerMap.set(pKey, { partnerId: rec.partner_id || null, companyName: displayName, totalQty: 0, totalAmount: 0, dailyMap: new Map() });
            }
            const pGroup = partnerMap.get(pKey)!;
            pGroup.totalQty += rec.quantity || 0;
            pGroup.totalAmount += rec.price || 0;
            const date = rec.recorded_at.split('T')[0];
            if (!pGroup.dailyMap.has(date)) pGroup.dailyMap.set(date, new Map());
            const txKey = rec.recorded_at; // 같은 recorded_at = 같은 거래
            const dayMap = pGroup.dailyMap.get(date)!;
            if (!dayMap.has(txKey)) dayMap.set(txKey, []);
            dayMap.get(txKey)!.push(rec);
        });
        return Array.from(partnerMap.values()).map(p => ({
            partnerId: p.partnerId, companyName: p.companyName, totalQty: p.totalQty, totalAmount: p.totalAmount,
            dailyGroups: Array.from(p.dailyMap.entries())
                .map(([date, txMap]) => ({
                    date,
                    transactions: Array.from(txMap.values()).map(records => ({
                        txKey: records[0].recorded_at,
                        records,
                        unit: records[0].sale_unit || '박스',
                        totalQty: records.reduce((s, r) => s + (r.quantity || 0), 0),
                    }))
                }))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }));
    }, [history]);

    return (
        <div className="min-h-screen pb-20 bg-slate-50/30">

        {/* 수정 모달 */}
        {editModal.open && editModal.records.length > 0 && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4"
                onClick={() => setEditModal({ open: false, records: [], companyName: '' })}>
                <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
                    onClick={e => e.stopPropagation()}>
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">납품 내역 수정</p>
                            <p className="text-sm font-black text-slate-900">{editModal.companyName}</p>
                        </div>
                        <button onClick={() => setEditModal({ open: false, records: [], companyName: '' })}
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
                            {editModal.records.map(rec => (
                                <div key={rec.id} className="flex items-center gap-3 bg-slate-50/50 rounded-2xl border border-slate-100 px-4 py-3">
                                    <span className="text-xs font-black text-indigo-500 w-10 shrink-0">{rec.grade}</span>
                                    <input type="text" inputMode="numeric"
                                        value={modalQties[rec.id] ?? ''}
                                        onChange={e => setModalQties(prev => ({ ...prev, [rec.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                        className="flex-1 bg-transparent text-center text-xl font-black text-slate-800 outline-none" placeholder="0" />
                                    <span className="text-xs font-bold text-slate-400 shrink-0">{rec.sale_unit}</span>
                                </div>
                            ))}
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
                        {/* 저장/취소 */}
                        <div className="flex gap-2 pt-1">
                            <button onClick={() => setEditModal({ open: false, records: [], companyName: '' })}
                                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm">
                                취소
                            </button>
                            <button onClick={handleModalSave}
                                className="flex-[2] py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                                <Save className="w-4 h-4" /> 저장
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
                            납품 (B2B) <Building2 className="w-4 h-4 text-indigo-500" />
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
                                <span className="text-3xl leading-none mb-1">{crop.crop_icon || '📦'}</span>
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
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                {['카드', '현금', '계좌'].map(m => (<button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${paymentMethod === m ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>{m}</button>))}
                            </div>
                            <button onClick={() => setPaymentStatus(paymentStatus === 'completed' ? 'pending' : 'completed')}
                                className={`py-4 rounded-xl border-2 font-black text-xs transition-all flex items-center justify-center
                                ${paymentStatus === 'completed' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-amber-400 bg-amber-50 text-amber-600'}`}>
                                {paymentStatus === 'completed' ? '정산 완료' : '미정산 (외상)'}
                            </button>
                        </div>
                        <button onClick={handleSave} disabled={saving}
                            className="w-full py-5 rounded-[1.25rem] text-lg font-black text-white bg-indigo-600 shadow-2xl shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                            {saving ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>{editingRecordId ? '수정 내용 저장' : 'B2B 납품 기록 저장'}</span></>}
                        </button>
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
                                                        <span className="text-slate-500">{pGroup.totalQty}{history.find(r => (r.partner_id || '') === (pGroup.partnerId || ''))?.sale_unit || '박스'}</span>
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
                                                                            <span className="font-black text-indigo-500 whitespace-nowrap">
                                                                                {tx.records.map(r => `${r.grade}:${r.quantity}`).join(', ')}
                                                                            </span>
                                                                            <span className="text-slate-300">|</span>
                                                                            <span className="font-bold text-slate-500 whitespace-nowrap">{tx.totalQty}{tx.unit}</span>
                                                                        </div>
                                                                        {/* 삭제 버튼 */}
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            {tx.records.map(rec => (
                                                                                <button key={rec.id}
                                                                                    onClick={e => { e.stopPropagation(); handleDelete(rec.id); }}
                                                                                    className="p-1.5 rounded-lg text-slate-200 hover:text-red-400 hover:bg-red-50 transition-all">
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                            ))}
                                                                            <Edit2 className="w-3 h-3 text-slate-200 group-hover:text-indigo-400 ml-1 transition-all" />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                
                                                                {/* 날짜별 합계 */}
                                                                <div className="mt-2 pt-2 text-right text-[10px] font-bold text-slate-400 border-t border-dashed border-slate-200">
                                                                    총 {dGroup.transactions.reduce((sum, tx) => sum + tx.totalQty, 0)} {dGroup.transactions[0]?.unit || '박스'}
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