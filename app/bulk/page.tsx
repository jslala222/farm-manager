"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, Edit2, Trash2, History, RefreshCcw, Save, ShoppingCart, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
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
                    delivery_method: 'direct', // B2B 기본값
                    recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0]
                };
                if (editingRecordId) await supabase.from('sales_records').update(saleData).eq('id', editingRecordId);
                else await supabase.from('sales_records').insert([saleData]);
            }
            handleResetAllStates(); await fetchHistory();
        } catch (error: any) { alert("저장 실패: " + error.message); } finally { setSaving(false); }
    };

    const handleEdit = (record: any) => {
        setEditingRecordId(record.id);
        const targetCrop = farmCrops.find(c => c.crop_name === record.crop_name);
        setCropName(record.crop_name || '딸기');
        setSaleUnit(record.sale_unit || targetCrop?.available_units?.[0] || '박스');
        setSelectedDate(record.recorded_at.split('T')[0]);
        setPaymentStatus(record.payment_status as 'pending' | 'completed');
        setPaymentMethod(record.payment_method || '카드');
        setSelectedClientId(record.partner_id || "");
        if (record.grade === '특/상') setBulkQtySang(record.quantity?.toString() || "");
        else if (record.grade === '중') setBulkQtyJung(record.quantity?.toString() || "");
        else if (record.grade === '하') setBulkQtyHa(record.quantity?.toString() || "");
    };

    const handleDelete = async (id: string) => { if (!confirm("삭제하시겠습니까?")) return; const { error } = await supabase.from('sales_records').delete().eq('id', id); if (!error) fetchHistory(); };

    return (
        <div className="min-h-screen pb-24 bg-slate-50/30">
            <div className="max-w-2xl mx-auto p-3 md:p-6 space-y-4">

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
                                className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl border-2 transition-all gap-1 min-w-0
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

                <div className="bg-white rounded-[2rem] shadow-xl border border-indigo-100 p-5 space-y-6">
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
                    <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 px-1"><History className="w-4 h-4 text-slate-300" /> B2B 납품 내역 (상세)</h2>
                    <div className="space-y-1.5">
                        {history.map(item => (
                            <div key={item.id} className="bg-white px-4 py-3 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all flex justify-between items-center shadow-sm group">
                                <div className="flex-1 flex items-center gap-3 min-w-0">
                                    <span className="text-2xl flex-shrink-0 grayscale group-hover:grayscale-0 transition-all">
                                        {farmCrops.find((c: any) => c.crop_name === item.crop_name)?.crop_icon || '🍓'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[14px] font-black text-slate-900 truncate">{item.partner?.company_name || '미지정'}</span>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${item.is_settled ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600 animate-pulse'}`}>
                                                {item.is_settled ? '정산완료' : '외상'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mt-0.5">
                                            <span className="text-indigo-500 font-black">{item.grade}</span>
                                            <span className="w-px h-2 bg-slate-200" />
                                            <span className="text-slate-700 font-extrabold">{item.quantity}{item.sale_unit}</span>
                                            <span className="w-px h-2 bg-slate-200" />
                                            <span>{formatCurrency(item.price || 0)}</span>
                                            <span className="w-px h-2 bg-slate-200" />
                                            <span className="text-[10px]">{new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 ml-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(item)} className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100 shadow-sm transition-all"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 hover:bg-white border border-transparent hover:border-red-100 shadow-sm transition-all"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
