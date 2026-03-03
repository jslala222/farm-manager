"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, Search, Plus, Calendar as CalendarIcon, Building2, Edit2, Trash2, History, CheckCircle, Clock, RefreshCcw, X, AlignLeft, Save, ShoppingCart, MapPin, Phone, User, ArrowRight, UserCheck, ChevronDown } from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase, SalesRecord, Partner, Customer } from "@/lib/supabase";
import { settlementService } from '@/lib/settlementService';
import { formatCurrency } from "@/lib/utils";
import AddressSearch from "@/components/AddressSearch";
import CalendarComponent from "@/components/Calendar";

const toLocalDateStr = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function SalesPage() {
    const { farm, initialized } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'bulk' | 'courier'>('bulk');
    const [partners, setPartners] = useState<Partner[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [history, setHistory] = useState<SalesRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(toLocalDateStr());
    const [showCalendar, setShowCalendar] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [showUnsettledOnly, setShowUnsettledOnly] = useState(false);
    const [farmCrops, setFarmCrops] = useState<any[]>([]);

    // B2B State
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [bulkQtySang, setBulkQtySang] = useState("");
    const [bulkQtyJung, setBulkQtyJung] = useState("");
    const [bulkQtyHa, setBulkQtyHa] = useState("");

    // B2C State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResult, setSearchResult] = useState<Customer[]>([]);
    const [selectedSearchResult, setSelectedSearchResult] = useState<Customer | null>(null);
    const [isNewClientMode, setIsNewClientMode] = useState(false);
    const [ordererName, setOrdererName] = useState("");
    const [ordererPhone, setOrdererPhone] = useState("");
    const [isSameAsOrderer, setIsSameAsOrderer] = useState(true);
    const [recipientName, setRecipientName] = useState("");
    const [recipientPhone, setRecipientPhone] = useState("");
    const [recipientAddress, setRecipientAddress] = useState("");
    const [recipientDetailAddress, setRecipientDetailAddress] = useState("");
    const [courierBoxCount, setCourierBoxCount] = useState("");
    const [courierTotalPrice, setCourierTotalPrice] = useState("");
    const [deliveryNote, setDeliveryNote] = useState("");

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
            const [partnersRes, customersRes] = await Promise.all([
                supabase.from('partners').select('*').eq('farm_id', farm.id).order('company_name'),
                supabase.from('customers').select('*').eq('farm_id', farm.id).order('name')
            ]);
            if (partnersRes.data) setPartners(partnersRes.data);
            if (customersRes.data) setCustomers(customersRes.data);
            await fetchHistory();
        } finally { setLoading(false); }
    }, [farm?.id]);

    const fetchHistory = async () => {
        if (!farm?.id) return;
        const { data } = await supabase.from('sales_records').select(`*, partner:partners(*), customer:customers(*)`).eq('farm_id', farm.id).order('recorded_at', { ascending: false }).limit(30);
        if (data) setHistory(data);
    };

    useEffect(() => { if (initialized && farm?.id) fetchInitialData(); }, [initialized, farm?.id, fetchInitialData]);

    useEffect(() => {
        if (searchTerm.length < 1) { setSearchResult([]); return; }
        const filtered = customers.filter(c => c.name.includes(searchTerm) || (c.contact && c.contact.includes(searchTerm)));
        setSearchResult(filtered.slice(0, 5));
    }, [searchTerm, customers]);

    useEffect(() => {
        if (isSameAsOrderer) { setRecipientName(ordererName); setRecipientPhone(ordererPhone); }
    }, [isSameAsOrderer, ordererName, ordererPhone]);

    const handleResetAllStates = () => {
        setEditingRecordId(null); setSelectedClientId(""); setBulkQtySang(""); setBulkQtyJung(""); setBulkQtyHa("");
        setSearchTerm(""); setSelectedSearchResult(null); setIsNewClientMode(false); setOrdererName(""); setOrdererPhone("");
        setRecipientName(""); setRecipientPhone(""); setRecipientAddress(""); setRecipientDetailAddress("");
        setCourierBoxCount(""); setCourierTotalPrice(""); setDeliveryNote(""); setIsSameAsOrderer(true);
        setPaymentStatus('completed'); setPaymentMethod('카드');
    };

    const handleSave = async () => {
        if (!farm?.id || saving) return;
        setSaving(true);
        try {
            if (activeTab === 'bulk') {
                if (!selectedClientId) { alert("거래처를 선택해주세요."); setSaving(false); return; }
                const grades = [{ grade: '특/상', qty: bulkQtySang }, { grade: '중', qty: bulkQtyJung }, { grade: '하', qty: bulkQtyHa }].filter(g => Number(g.qty) > 0);
                if (grades.length === 0) { alert("수량을 입력해주세요."); setSaving(false); return; }
                for (const g of grades) {
                    const saleData = {
                        farm_id: farm.id, partner_id: selectedClientId, crop_name: cropName, sale_unit: saleUnit, quantity: Number(g.qty), grade: g.grade,
                        is_settled: paymentStatus === 'completed', payment_status: paymentStatus, payment_method: paymentMethod,
                        sale_type: 'b2b',
                        recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0]
                    };
                    if (editingRecordId) await supabase.from('sales_records').update(saleData).eq('id', editingRecordId);
                    else await supabase.from('sales_records').insert([saleData]);
                }
            } else {
                if (!ordererName) { alert("주문자를 입력하거나 선택해주세요."); setSaving(false); return; }
                const courierData = {
                    farm_id: farm.id, customer_id: selectedSearchResult?.id, customer_name: ordererName, phone: ordererPhone,
                    recipient_name: recipientName, recipient_phone: recipientPhone, address: recipientAddress, detail_address: recipientDetailAddress,
                    delivery_note: deliveryNote, quantity: Number(courierBoxCount), price: Number(courierTotalPrice), crop_name: cropName, sale_unit: saleUnit,
                    delivery_method: 'courier', is_settled: paymentStatus === 'completed', payment_status: paymentStatus, payment_method: paymentMethod,
                    sale_type: 'b2c',
                    recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0]
                };
                if (editingRecordId) await supabase.from('sales_records').update(courierData).eq('id', editingRecordId);
                else await supabase.from('sales_records').insert([courierData]);
            }
            handleResetAllStates(); await fetchHistory();
        } catch (error: any) { alert("저장 실패: " + error.message); } finally { setSaving(false); }
    };

    const handleEdit = (record: any) => {
        setEditingRecordId(record.id); setActiveTab(record.delivery_method === 'courier' ? 'courier' : 'bulk');
        const targetCrop = farmCrops.find(c => c.crop_name === record.crop_name);
        setCropName(record.crop_name || '딸기');
        setSaleUnit(record.sale_unit || targetCrop?.available_units?.[0] || '박스');
        setSelectedDate(record.recorded_at.split('T')[0]); setPaymentStatus(record.payment_status as 'pending' | 'completed'); setPaymentMethod(record.payment_method || '카드');
        if (record.delivery_method === 'courier') {
            setCourierBoxCount(record.quantity?.toString() || ""); setCourierTotalPrice(record.price?.toString() || "");
            setOrdererName(record.customer_name || ""); setOrdererPhone(record.phone || "");
            setRecipientName(record.recipient_name || ""); setRecipientPhone(record.recipient_phone || "");
            setRecipientAddress(record.address || ""); setRecipientDetailAddress(record.detail_address || "");
            setDeliveryNote(record.delivery_note || "");
            setIsSameAsOrderer(record.recipient_name === record.customer_name && record.recipient_phone === record.phone);
            if (record.customer) { setSelectedSearchResult(record.customer); setSearchTerm(record.customer.name); } else { setIsNewClientMode(true); }
        } else {
            setSelectedClientId(record.partner_id || "");
            if (record.grade === '특/상') setBulkQtySang(record.quantity?.toString() || "");
            else if (record.grade === '중') setBulkQtyJung(record.quantity?.toString() || "");
            else if (record.grade === '하') setBulkQtyHa(record.quantity?.toString() || "");
        }
    };

    const handleDelete = async (id: string) => { if (!confirm("삭제하시겠습니까?")) return; const { error } = await supabase.from('sales_records').delete().eq('id', id); if (!error) fetchHistory(); };

    return (
        <div className="min-h-screen pb-20 bg-slate-50/30">
            <div className="max-w-2xl mx-auto p-3 md:p-3 space-y-4">

                {/* [초압축 고정 헤더] */}
                <div className="flex items-center justify-between px-1 gap-2">
                    <div className="min-w-0">
                        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                            판매 / 출하 <ShoppingCart className="w-4 h-4 text-emerald-500" />
                        </h1>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Sales & Delivery</p>
                    </div>
                    <button onClick={() => setShowCalendar(!showCalendar)}
                        className={`h-10 px-4 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-sm border shrink-0
                        ${showCalendar ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}>
                        <CalendarIcon className="w-4 h-4" /> {showCalendar ? '닫기' : '달력'}
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

                {/* [작물 자동 등분 레이아웃] */}
                <div className="bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-white shadow-sm space-y-3">
                    <div className="flex gap-1.5 flex-wrap">
                        {farmCrops.map((crop) => {
                            const isProcessed = crop.category === 'processed';
                            return (
                            <button key={crop.id}
                                onClick={() => {
                                    setCropName(crop.crop_name);
                                    if (crop.available_units && crop.available_units.length > 0) {
                                        setSaleUnit(crop.available_units[0]);
                                    }
                                }}
                                className={`flex-1 min-w-[60px] flex flex-col items-center justify-center py-2.5 rounded-2xl border-2 transition-all gap-1 animate-in zoom-in-95 duration-200
                                ${cropName === crop.crop_name
                                    ? (isProcessed ? 'bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-100' : 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-100')
                                    : 'bg-white border-slate-50 opacity-40'}`}>
                                <span className="text-2xl leading-none">{crop.crop_icon || '📦'}</span>
                                <span className="text-[9px] font-black text-slate-800 tracking-tighter truncate w-full text-center px-1">{crop.crop_name}</span>
                                {isProcessed && <span className="text-[7px] font-black text-amber-500 -mt-0.5">가공품</span>}
                            </button>
                            );
                        })}
                    </div>
                    {/* [인라인 단위 선택] - 작물에 종속되어 표시됨 */}
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide bg-slate-50/50 p-1 rounded-xl border border-slate-100">
                        {farmCrops.find(c => c.crop_name === cropName)?.available_units?.map((unit: string) => (
                            <button key={unit} onClick={() => setSaleUnit(unit)}
                                className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all whitespace-nowrap
                                ${saleUnit === unit ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>{unit}</button>
                        )) || <div className="text-[10px] text-slate-300 font-bold p-1">선택된 작물의 단위가 없습니다</div>}
                    </div>
                </div>

                {/* [탭 스위치] */}
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                    <button onClick={() => { setActiveTab('bulk'); handleResetAllStates(); }}
                        className={`flex-1 py-3 rounded-[0.9rem] text-xs font-black transition-all flex items-center justify-center gap-2
                        ${activeTab === 'bulk' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                        <Building2 className="w-3.5 h-3.5" /> 납품
                    </button>
                    <button onClick={() => { setActiveTab('courier'); handleResetAllStates(); }}
                        className={`flex-1 py-3 rounded-[0.9rem] text-xs font-black transition-all flex items-center justify-center gap-2
                        ${activeTab === 'courier' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>
                        <Truck className="w-3.5 h-3.5" /> 택배
                    </button>
                </div>

                {/* [메인 입력 영역] */}
                <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                    <div className={`h-1.5 w-full ${activeTab === 'bulk' ? 'bg-indigo-500' : 'bg-rose-500'}`} />
                    <div className="p-5 space-y-3">
                        {activeTab === 'bulk' ? (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-indigo-500 uppercase px-1">거래처 선택</label>
                                    <div className="relative">
                                        <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black appearance-none outline-none focus:border-indigo-400 focus:bg-white transition-all">
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
                            </div>
                        ) : (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                {/* [B2C 주문자 파트] */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-rose-500 uppercase">주문자 검색/입력</label>
                                        <button onClick={() => { setIsNewClientMode(!isNewClientMode); setSelectedSearchResult(null); setOrdererName(""); setOrdererPhone(""); }}
                                            className="text-[9px] font-black text-white bg-rose-500 px-3 py-1 rounded-lg shadow-sm active:scale-95 transition-all">
                                            {isNewClientMode ? '기존고객 검색' : '+ 신규고객'}
                                        </button>
                                    </div>
                                    {!isNewClientMode ? (
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
                                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black outline-none focus:border-rose-400 focus:bg-white transition-all shadow-inner"
                                                placeholder="성함 혹은 연락처 뒷번호..." />
                                            {searchResult.length > 0 && !selectedSearchResult && (
                                                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-rose-100 rounded-2xl shadow-2xl z-30 divide-y divide-slate-50 overflow-hidden">
                                                    {searchResult.map(c => (
                                                        <button key={c.id} onClick={() => { setSelectedSearchResult(c); setOrdererName(c.name); setOrdererPhone(c.contact || ""); setSearchTerm(c.name); }}
                                                            className="w-full p-4 hover:bg-rose-50 flex items-center justify-between text-left">
                                                            <div><p className="font-black text-slate-800">{c.name}</p><p className="text-xs text-slate-400 font-bold">{c.contact}</p></div>
                                                            <ArrowRight className="w-4 h-4 text-rose-300" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input type="text" value={ordererName} onChange={(e) => setOrdererName(e.target.value)} placeholder="주문자명" className="w-full pl-9 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-rose-300" /></div>
                                            <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input type="text" value={ordererPhone} onChange={(e) => setOrdererPhone(e.target.value)} placeholder="010-0000-0000" className="w-full pl-9 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-rose-300" /></div>
                                        </div>
                                    )}
                                </div>

                                {/* [B2C 수령인 및 주소] */}
                                <div className="space-y-4 pt-4 border-t border-dashed border-slate-100">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-rose-400 uppercase">배송지 정보</label>
                                        <button onClick={() => setIsSameAsOrderer(!isSameAsOrderer)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border
                                            ${isSameAsOrderer ? 'bg-rose-600 border-rose-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>
                                            <UserCheck className="w-3.5 h-3.5" /> 주문자고정
                                        </button>
                                    </div>
                                    {!isSameAsOrderer && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
                                            <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="수령인명" className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black outline-none focus:border-rose-300" />
                                            <input type="text" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="수령인 연락처" className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black outline-none focus:border-rose-300" />
                                        </div>
                                    )}
                                    <AddressSearch label="" value={recipientAddress} onChange={setRecipientAddress} className="!space-y-0" placeholder="주소를 검색하세요" />
                                    <input type="text" value={recipientDetailAddress} onChange={(e) => setRecipientDetailAddress(e.target.value)} placeholder="동/호수/상세주소 직접 입력" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-rose-400" />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dashed border-slate-100">
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-300 px-1">박스 수</label><input type="text" value={courierBoxCount} onChange={(e) => setCourierBoxCount(e.target.value.replace(/[^0-9]/g, ''))} className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-2xl text-2xl font-black text-center" placeholder="0" /></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-300 px-1">총 금액</label><input type="text" value={courierTotalPrice} onChange={(e) => setCourierTotalPrice(e.target.value.replace(/[^0-9]/g, ''))} className="w-full p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl text-2xl font-black text-center text-emerald-600" placeholder="0" /></div>
                                </div>
                                <div className="relative"><AlignLeft className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input type="text" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} className="w-full pl-11 p-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" placeholder="배송 특이사항 입력..." /></div>
                            </div>
                        )}

                        {/* [결제 및 저장 버튼] */}
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                {['카드', '현금', '계좌'].map(m => (<button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${paymentMethod === m ? (activeTab === 'bulk' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-rose-600 text-white shadow-sm') : 'text-slate-400'}`}>{m}</button>))}
                            </div>
                            <button onClick={() => setPaymentStatus(paymentStatus === 'completed' ? 'pending' : 'completed')}
                                className={`py-4 rounded-xl border-2 font-black text-xs transition-all flex items-center justify-center
                                ${paymentStatus === 'completed' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-amber-400 bg-amber-50 text-amber-600'}`}>
                                {paymentStatus === 'completed' ? '정산 완료' : '미정산 (외상)'}
                            </button>
                        </div>

                        <button onClick={handleSave} disabled={saving}
                            className={`w-full py-5 rounded-[1.25rem] text-lg font-black text-white shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2
                            ${activeTab === 'bulk' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-rose-600 shadow-rose-200'}`}>
                            {saving ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>{editingRecordId ? '수정 내용 저장' : '판매 기록 저장'}</span></>}
                        </button>
                    </div>
                </div>

                {/* [최근 기록 섹션] */}
                <div className="space-y-3 pb-10">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-black text-slate-800 flex items-center gap-2"><History className="w-4 h-4 text-slate-300" /> 최근 판매 내역</h2>
                        <button onClick={() => setShowUnsettledOnly(!showUnsettledOnly)} className={`text-[10px] font-black px-3 py-1.5 rounded-full border transition-all ${showUnsettledOnly ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-400 border-slate-100'}`}> {showUnsettledOnly ? '⚠️ 외상만 보기' : '전체 보기'} </button>
                    </div>
                    <div className="space-y-2">
                        {history.filter(item => !showUnsettledOnly || !item.is_settled).map(item => (
                            <div key={item.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-50 flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-inner ${settlementService.isB2B(item) ? 'bg-indigo-50 text-indigo-500' : 'bg-rose-50 text-rose-500'}`}> {farmCrops.find((c: any) => c.crop_name === item.crop_name)?.crop_icon || '🍓'} </div>
                                    <div className="leading-tight">
                                        <div className="flex items-center gap-1.5 mb-0.5"><p className="text-xs font-black text-slate-800">{item.partner?.company_name || item.customer?.name || item.customer_name || '미지정'}</p><span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${item.is_settled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{item.is_settled ? '완료' : '미정산'}</span></div>
                                        <p className="text-[10px] font-bold text-slate-400">{item.quantity}{item.sale_unit} · {formatCurrency(item.price || 0)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 items-center">
                                    <button onClick={() => handleEdit(item)} className="p-2 text-slate-200 hover:text-indigo-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-200 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
