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
    const [isAddingProcessed, setIsAddingProcessed] = useState(false);
    const [newProcessedInput, setNewProcessedInput] = useState('');
    const [showCropPicker, setShowCropPicker] = useState(true);

    // B2B State (다중 주문행)
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [orderLines, setOrderLines] = useState<{id: string; cropName: string; cropIcon: string; spec: string; unit: string; quantity: string; unitPrice: string;}[]>([]);

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
    const [productSpec, setProductSpec] = useState<string>('');
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed'>('completed');
    const [paymentMethod, setPaymentMethod] = useState('카드');

    // 아이콘 자동 추천
    const ICON_MAP: Record<string, string> = {
        '딸기': '🍓', '고구마': '🍠', '감자': '🥔', '포도': '🍇', '샤인': '🍇', '머스캣': '🍇',
        '사과': '🍎', '배': '🍐', '복숭아': '🍑', '토마토': '🍅', '수박': '🍉', '참외': '🍈',
        '잼': '🍯', '청': '🫙', '즙': '🧃', '주스': '🧃', '냉동': '🧊', '건조': '🌿', '말린': '🌿',
        '케이크': '🍰', '쿠키': '🍪', '아이스': '🍦', '떡': '🍡', '젤리': '🍬', '타르트': '🥧',
        '와인': '🍷', '식초': '🫗', '칩': '🥜', '밀키트': '📦', '소스': '🫙', '분말': '🫙'
    };
    const guessIcon = (name: string, fallback: string) => {
        for (const [keyword, icon] of Object.entries(ICON_MAP)) {
            if (name.includes(keyword)) return icon;
        }
        return fallback;
    };

    // 다중 주문행 헬퍼
    const addOrderLine = () => {
        const selectedCrop = farmCrops.find(c => c.crop_name === cropName);
        setOrderLines(prev => [...prev, {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
            cropName,
            cropIcon: selectedCrop?.crop_icon || '📦',
            spec: productSpec,
            unit: saleUnit,
            quantity: '',
            unitPrice: '',
        }]);
        setProductSpec('');
    };
    const removeOrderLine = (id: string) => setOrderLines(prev => prev.filter(l => l.id !== id));
    const updateOrderLine = (id: string, field: string, value: string) => setOrderLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
    const orderTotal = useMemo(() => orderLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0), [orderLines]);

    const fetchFarmCrops = useCallback(async (selectCrop?: string) => {
        if (!farm?.id) return;
        const { data } = await supabase.from('farm_crops').select('*').eq('farm_id', farm.id).is('is_active', true).order('sort_order');
        if (data) {
            setFarmCrops(data);
            if (selectCrop) {
                setCropName(selectCrop);
                const target = data.find((c: any) => c.crop_name === selectCrop);
                if (target?.available_units?.[0]) setSaleUnit(target.available_units[0]);
            } else if (data.length > 0 && !farmCrops.length) {
                const strawberry = data.find((c: any) => c.crop_name === '딸기');
                if (strawberry) { setCropName('딸기'); setSaleUnit(strawberry.available_units?.[0] || '박스'); }
                else { setCropName(data[0].crop_name); setSaleUnit(data[0].available_units?.[0] || '박스'); }
            }
        }
    }, [farm?.id]);

    useEffect(() => { fetchFarmCrops(); }, [fetchFarmCrops]);

    // 가공품 즉석 추가 (하이브리드)
    const handleAddProcessed = async () => {
        const name = newProcessedInput.trim();
        if (!name || !farm?.id) return;
        // 이미 등록된 이름인지 확인
        const existing = farmCrops.find(c => c.crop_name === name);
        if (existing) {
            setCropName(name);
            setProductSpec('');
            if (existing.available_units?.[0]) setSaleUnit(existing.available_units[0]);
            setIsAddingProcessed(false);
            setNewProcessedInput('');
            return;
        }
        const icon = guessIcon(name, '🏭');
        const { error } = await supabase.from('farm_crops').insert([{
            farm_id: farm.id, crop_name: name, crop_icon: icon,
            category: 'processed', available_units: ['개', '박스', 'kg'],
            is_active: true, sort_order: farmCrops.length
        }]);
        if (error) { alert('추가 실패: ' + error.message); return; }
        await fetchFarmCrops(name);
        setProductSpec('');
        setIsAddingProcessed(false);
        setNewProcessedInput('');
    };

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
        setEditingRecordId(null); setSelectedClientId(""); setOrderLines([]);
        setSearchTerm(""); setSelectedSearchResult(null); setIsNewClientMode(false); setOrdererName(""); setOrdererPhone("");
        setRecipientName(""); setRecipientPhone(""); setRecipientAddress(""); setRecipientDetailAddress("");
        setCourierBoxCount(""); setCourierTotalPrice(""); setDeliveryNote(""); setIsSameAsOrderer(true);
        setPaymentStatus('completed'); setPaymentMethod('카드'); setProductSpec('');
    };

    const handleSave = async () => {
        if (!farm?.id || saving) return;
        setSaving(true);
        try {
            if (activeTab === 'bulk') {
                if (!selectedClientId) { alert("거래처를 선택해주세요."); setSaving(false); return; }
                const validLines = orderLines.filter(l => Number(l.quantity) > 0);
                if (validLines.length === 0) { alert("주문행을 추가하고 수량을 입력해주세요."); setSaving(false); return; }
                for (const line of validLines) {
                    const selCrop = farmCrops.find(c => c.crop_name === line.cropName);
                    const isProc = selCrop?.category === 'processed';
                    const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                    const saleData = {
                        farm_id: farm.id, partner_id: selectedClientId, crop_name: line.cropName, sale_unit: line.unit,
                        quantity: Number(line.quantity), grade: isProc ? null : (line.spec || null),
                        price: lineTotal > 0 ? lineTotal : null,
                        is_settled: paymentStatus === 'completed', payment_status: paymentStatus, payment_method: paymentMethod,
                        sale_type: 'b2b', product_spec: isProc ? (line.spec || null) : null,
                        recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0]
                    };
                    if (editingRecordId) { await supabase.from('sales_records').update(saleData).eq('id', editingRecordId); break; }
                    else await supabase.from('sales_records').insert([saleData]);
                }
            } else {
                if (!ordererName) { alert("주문자를 입력하거나 선택해주세요."); setSaving(false); return; }
                const courierData = {
                    farm_id: farm.id, customer_id: selectedSearchResult?.id, customer_name: ordererName, phone: ordererPhone,
                    recipient_name: recipientName, recipient_phone: recipientPhone, address: recipientAddress, detail_address: recipientDetailAddress,
                    delivery_note: deliveryNote, quantity: Number(courierBoxCount), price: Number(courierTotalPrice), crop_name: cropName, sale_unit: saleUnit,
                    delivery_method: 'courier', is_settled: paymentStatus === 'completed', payment_status: paymentStatus, payment_method: paymentMethod,
                    sale_type: 'b2c', product_spec: productSpec || null,
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
        setProductSpec(record.product_spec || '');
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
            const editCrop = farmCrops.find(c => c.crop_name === record.crop_name);
            setOrderLines([{
                id: Date.now().toString(),
                cropName: record.crop_name || '딸기',
                cropIcon: editCrop?.crop_icon || '🍓',
                spec: record.grade || record.product_spec || '',
                unit: record.sale_unit || '박스',
                quantity: record.quantity?.toString() || '',
                unitPrice: record.price && record.quantity ? Math.floor(record.price / record.quantity).toString() : '',
            }]);
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

                {/* [품목 선택: 접힘/펼침] */}
                <div className="bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-white shadow-sm space-y-3">
                    {showCropPicker ? (
                        <div className="space-y-2 animate-in fade-in duration-200">
                            {/* 원물 */}
                            {farmCrops.filter(c => c.category !== 'processed').length > 0 && (
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-emerald-500 uppercase ml-1">🌱 원물</span>
                                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                                        {farmCrops.filter(c => c.category !== 'processed').map((crop) => (
                                            <button key={crop.id}
                                                onClick={() => {
                                                    setCropName(crop.crop_name);
                                                    setProductSpec('');
                                                    if (crop.available_units?.length > 0) setSaleUnit(crop.available_units[0]);
                                                    setShowCropPicker(false);
                                                }}
                                                className={`min-w-[68px] flex flex-col items-center justify-center py-2 px-1 rounded-2xl border-2 transition-all gap-0.5 shrink-0
                                                ${cropName === crop.crop_name ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-100' : 'bg-white border-slate-50 opacity-40 hover:opacity-100'}`}>
                                                <span className="text-2xl leading-none">{crop.crop_icon || '🌱'}</span>
                                                <span className="text-[9px] font-black text-slate-800 whitespace-nowrap">{crop.crop_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* 가공품 */}
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-amber-500 uppercase ml-1">🏭 가공품</span>
                                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                                    {farmCrops.filter(c => c.category === 'processed').map((crop) => (
                                        <button key={crop.id}
                                            onClick={() => {
                                                setCropName(crop.crop_name);
                                                setProductSpec('');
                                                setIsAddingProcessed(false);
                                                if (crop.available_units?.length > 0) setSaleUnit(crop.available_units[0]);
                                                setShowCropPicker(false);
                                            }}
                                            className={`min-w-[68px] flex flex-col items-center justify-center py-2 px-1 rounded-2xl border-2 transition-all gap-0.5 shrink-0
                                            ${cropName === crop.crop_name && !isAddingProcessed ? 'bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-100' : 'bg-white border-amber-50 opacity-40 hover:opacity-100'}`}>
                                            <span className="text-2xl leading-none">{crop.crop_icon || '📦'}</span>
                                            <span className="text-[9px] font-black text-slate-800 whitespace-nowrap">{crop.crop_name}</span>
                                        </button>
                                    ))}
                                    {/* [+직접입력] */}
                                    <button onClick={() => setIsAddingProcessed(!isAddingProcessed)}
                                        className={`min-w-[68px] flex flex-col items-center justify-center py-2 px-1 rounded-2xl border-2 border-dashed transition-all gap-0.5 shrink-0
                                        ${isAddingProcessed ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-white border-amber-200 opacity-60 hover:opacity-100'}`}>
                                        <span className="text-2xl leading-none">{isAddingProcessed ? '✏️' : '➕'}</span>
                                        <span className="text-[9px] font-black text-amber-600 whitespace-nowrap">직접입력</span>
                                    </button>
                                </div>
                                {/* 즉석 입력 모드 */}
                                {isAddingProcessed && (
                                    <div className="flex gap-1.5 items-center animate-in slide-in-from-top-1 duration-200">
                                        <input type="text" value={newProcessedInput}
                                            onChange={(e) => setNewProcessedInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddProcessed(); }}
                                            placeholder="가공품명 입력 (예: 딸기케이크)" autoFocus
                                            className="flex-1 px-3 py-2.5 bg-amber-50/50 border-2 border-amber-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-amber-400 placeholder:text-amber-300 placeholder:font-bold" />
                                        <button onClick={handleAddProcessed}
                                            className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all whitespace-nowrap">추가</button>
                                        <button onClick={() => { setIsAddingProcessed(false); setNewProcessedInput(''); }}
                                            className="p-2.5 bg-slate-100 text-slate-400 rounded-xl active:scale-95 transition-all"><X className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 animate-in fade-in duration-200">
                            {(() => {
                                const sel = farmCrops.find(c => c.crop_name === cropName);
                                const isProc = sel?.category === 'processed';
                                const borderColor = isProc ? 'border-amber-200' : 'border-emerald-200';
                                const bgColor = isProc ? 'bg-amber-50/80' : 'bg-emerald-50/80';
                                const tagColor = isProc ? 'text-amber-500 bg-amber-100' : 'text-emerald-600 bg-emerald-100';
                                return (
                                    <div className={`flex items-center gap-2.5 flex-1 ${bgColor} px-3 py-2.5 rounded-2xl border ${borderColor}`}>
                                        <span className="text-2xl leading-none">{sel?.crop_icon || '📦'}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-slate-800 truncate">{cropName}</p>
                                            <div className="flex items-center gap-1">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${tagColor}`}>{isProc ? '가공품' : '원물'}</span>
                                                <span className="text-[9px] font-bold text-slate-400">{saleUnit}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            <button onClick={() => setShowCropPicker(true)}
                                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 active:scale-95 transition-all hover:bg-slate-50 whitespace-nowrap shadow-sm">
                                🔄 변경
                            </button>
                        </div>
                    )}
                    {/* [인라인 단위 선택] - 작물에 종속되어 표시됨 */}
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide bg-slate-50/50 p-1 rounded-xl border border-slate-100">
                        {farmCrops.find(c => c.crop_name === cropName)?.available_units?.map((unit: string) => (
                            <button key={unit} onClick={() => setSaleUnit(unit)}
                                className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all whitespace-nowrap
                                ${saleUnit === unit ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>{unit}</button>
                        )) || <div className="text-[10px] text-slate-300 font-bold p-1">선택된 작물의 단위가 없습니다</div>}
                    </div>

                    {/* [등급/규격 선택] - 원물은 등급(특/상,중,하), 가공품은 규격 */}
                    {(() => {
                        const selectedCrop = farmCrops.find(c => c.crop_name === cropName);
                        if (!selectedCrop) return null;
                        const isProcessed = selectedCrop.category === 'processed';
                        const specs = isProcessed
                            ? (selectedCrop.available_specs?.length > 0 ? selectedCrop.available_specs : null)
                            : ['특/상', '중', '하'];
                        if (!specs) return null;
                        const label = isProcessed ? '📐 규격' : '🏅 등급';
                        const ac = isProcessed ? 'bg-amber-500' : 'bg-indigo-500';
                        const inT = isProcessed ? 'text-amber-400' : 'text-indigo-400';
                        const inB = isProcessed ? 'border-amber-100' : 'border-indigo-100';
                        const wBg = isProcessed ? 'bg-amber-50/50' : 'bg-indigo-50/50';
                        const wBd = isProcessed ? 'border-amber-100' : 'border-indigo-100';
                        const lc = isProcessed ? 'text-amber-500' : 'text-indigo-500';
                        return (
                            <div className="space-y-1">
                                <span className={`text-[9px] font-black uppercase ml-1 ${lc}`}>{label}</span>
                                <div className={`flex gap-1 overflow-x-auto pb-1 scrollbar-hide ${wBg} p-1 rounded-xl border ${wBd}`}>
                                    <button onClick={() => setProductSpec('')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all whitespace-nowrap
                                        ${!productSpec ? `${ac} text-white shadow-md` : `bg-white ${inT} border ${inB}`}`}>{isProcessed ? '규격없음' : '미지정'}</button>
                                    {specs.map((spec: string) => (
                                        <button key={spec} onClick={() => setProductSpec(spec)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all whitespace-nowrap
                                            ${productSpec === spec ? `${ac} text-white shadow-md` : `bg-white ${inT} border ${inB}`}`}>{spec}</button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
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
                            <div className="space-y-4 animate-in fade-in duration-300">
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
                                {/* 주문행 추가 버튼 (수정 모드에서는 숨김) */}
                                {!editingRecordId && (
                                    <button onClick={addOrderLine}
                                        className="w-full py-3.5 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 text-indigo-500 font-black text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:border-indigo-400 hover:bg-indigo-50">
                                        <Plus className="w-4 h-4" />
                                        <span>주문행 추가</span>
                                        <span className="text-[9px] bg-indigo-100 px-2 py-0.5 rounded-full text-indigo-600 flex items-center gap-1">
                                            {farmCrops.find(c => c.crop_name === cropName)?.crop_icon || '📦'} {cropName}{productSpec ? ` · ${productSpec}` : ''} · {saleUnit}
                                        </span>
                                    </button>
                                )}
                                {/* 주문 내역 카드 */}
                                {orderLines.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] font-black text-slate-500">📋 주문 내역 ({orderLines.length}건)</span>
                                            {orderTotal > 0 && <span className="text-sm font-black text-indigo-600">합계: {formatCurrency(orderTotal)}원</span>}
                                        </div>
                                        {orderLines.map((line) => {
                                            const lineSub = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                                            return (
                                                <div key={line.id} className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                                                            <span className="text-lg leading-none">{line.cropIcon}</span>
                                                            <span>{line.cropName}</span>
                                                            {line.spec && <span className="text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md text-[10px]">{line.spec}</span>}
                                                            <span className="text-slate-300 text-[10px]">· {line.unit}</span>
                                                        </div>
                                                        {!editingRecordId && (
                                                            <button onClick={() => removeOrderLine(line.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50">
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="bg-white p-2 rounded-xl border border-slate-100 flex flex-col items-center">
                                                            <span className="text-[8px] font-black text-slate-300 mb-0.5">수량</span>
                                                            <input type="text" inputMode="numeric" value={line.quantity}
                                                                onChange={(e) => updateOrderLine(line.id, 'quantity', e.target.value.replace(/[^0-9]/g, ''))}
                                                                className="w-full bg-transparent text-center text-lg font-black text-slate-800 outline-none" placeholder="0" />
                                                        </div>
                                                        <div className="bg-white p-2 rounded-xl border border-slate-100 flex flex-col items-center">
                                                            <span className="text-[8px] font-black text-slate-300 mb-0.5">단가 (원)</span>
                                                            <input type="text" inputMode="numeric"
                                                                value={line.unitPrice ? formatCurrency(line.unitPrice) : ''}
                                                                onChange={(e) => updateOrderLine(line.id, 'unitPrice', e.target.value.replace(/[^0-9,]/g, '').replace(/,/g, ''))}
                                                                className="w-full bg-transparent text-center text-lg font-black text-slate-800 outline-none" placeholder="0" />
                                                        </div>
                                                    </div>
                                                    {lineSub > 0 && (
                                                        <div className="text-right text-[11px] font-black text-indigo-500 pr-1">
                                                            소계: {formatCurrency(lineSub)}원
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {orderLines.length === 0 && !editingRecordId && (
                                    <div className="text-center py-6 text-slate-300">
                                        <p className="text-xs font-black">위에서 품목·등급 선택 후</p>
                                        <p className="text-xs font-black">[주문행 추가] 버튼을 눌러주세요</p>
                                    </div>
                                )}
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
                                        <p className="text-[10px] font-bold text-slate-400">{item.quantity}{item.sale_unit}{(item as any).product_spec ? ` (${(item as any).product_spec})` : ''} · {formatCurrency(item.price || 0)}</p>
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
