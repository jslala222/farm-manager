"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, Search, History, RefreshCcw, Save, Phone, User, ArrowRight, UserCheck, AlignLeft, Edit2, Trash2, Calendar as CalendarIcon, X, CheckCircle, Clock } from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase, SalesRecord, Customer } from "@/lib/supabase";
import { formatCurrency, formatPhone, stripNonDigits, getCropIcon } from "@/lib/utils";
import AddressSearch from "@/components/AddressSearch";
import CalendarComponent from "@/components/Calendar";

const toLocalDateStr = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CourierSalesPage() {
    const { farm, initialized } = useAuthStore();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [history, setHistory] = useState<SalesRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(toLocalDateStr());
    const [showCalendar, setShowCalendar] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [farmCrops, setFarmCrops] = useState<any[]>([]);
    // 상세 팝업 모달 상태 (그룹 배열)
    const [detailModal, setDetailModal] = useState<SalesRecord[] | null>(null);

    // B2C State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResult, setSearchResult] = useState<Customer[]>([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [ordererName, setOrdererName] = useState("");
    const [ordererPhone, setOrdererPhone] = useState("");
    const [isSameAsOrderer, setIsSameAsOrderer] = useState(true);
    const [recipientName, setRecipientName] = useState("");
    const [recipientPhone, setRecipientPhone] = useState("");
    const [recipientAddress, setRecipientAddress] = useState("");
    const [recipientDetailAddress, setRecipientDetailAddress] = useState("");

    const [isEditMode, setIsEditMode] = useState(false); // [수정] 수정 모드 상태 추가

    // 다중 품목 카드형
    const [courierItems, setCourierItems] = useState<{id: string; cropName: string; cropIcon: string; unit: string; quantity: string; unitPrice: string;}[]>([]);
    const [shippingCost, setShippingCost] = useState("");
    const [shippingFeeType, setShippingFeeType] = useState('선불');
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [deliveryNote, setDeliveryNote] = useState("");

    // Common State
    const [cropName, setCropName] = useState('딸기');
    const [saleUnit, setSaleUnit] = useState('박스');
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed'>('completed');
    const [paymentMethod, setPaymentMethod] = useState('카드');

    // 가공품이면 규격(specs), 아니면 단위(units)
    const getEffectiveUnits = (crop: any) => {
        if (crop?.category === 'processed' && crop?.available_specs?.length > 0) return crop.available_specs;
        return crop?.available_units || ['박스'];
    };

    // 장바구니에 품목 즉시 추가 (탭 → 추가)
    const addToCart = (crop: any) => {
        setCourierItems(prev => [...prev, {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
            cropName: crop.crop_name,
            cropIcon: getCropIcon(crop.crop_name),
            unit: getEffectiveUnits(crop)[0],
            quantity: '', unitPrice: ''
        }]);
    };
    const removeCourierItem = (id: string) => setCourierItems(prev => prev.filter(i => i.id !== id));
    const updateCourierItem = (id: string, field: string, value: string) =>
        setCourierItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    const courierItemsTotal = useMemo(() =>
        courierItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0), [courierItems]);

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
            const res = await supabase.from('customers').select('*').eq('farm_id', farm.id).order('name');
            if (res.data) setCustomers(res.data as any);
            await fetchHistory();
        } finally { setLoading(false); }
    }, [farm?.id]);

    const fetchHistory = async () => {
        if (!farm?.id) return;
        const { data } = await supabase
            .from('sales_records')
            .select(`*, customer:customers(*)`)
            .eq('farm_id', farm.id)
            .eq('delivery_method', 'courier')
            .order('recorded_at', { ascending: false })
            .limit(30);
        if (data) setHistory(data as any);
    };

    useEffect(() => { if (initialized && farm?.id) fetchInitialData(); }, [initialized, farm?.id, fetchInitialData]);

    useEffect(() => {
        const term = searchTerm.trim().toLowerCase().replace(/-/g, '');
        if (!term || term.length < 1) {
            setSearchResult(customers.slice(0, 5));
            return;
        }
        const filtered = customers.filter(c => {
            const nameMatch = c.name && c.name.toLowerCase().includes(term);
            const contactMatch = c.contact && c.contact.replace(/-/g, '').includes(term);
            return nameMatch || contactMatch;
        });
        setSearchResult(filtered.slice(0, 5));
    }, [searchTerm, customers]);

    useEffect(() => {
        if (isSameAsOrderer) { setRecipientName(ordererName); setRecipientPhone(ordererPhone); }
    }, [isSameAsOrderer, ordererName, ordererPhone]);



    const handleResetAllStates = () => {
        setEditingRecordId(null); setEditingGroupId(null); setSelectedCustomerId(null); setSearchTerm("");
        setOrdererName(""); setOrdererPhone(""); setRecipientName(""); setRecipientPhone("");
        setRecipientAddress(""); setRecipientDetailAddress("");
        setCourierItems([]); setShippingCost("");
        setDeliveryNote(""); setIsSameAsOrderer(true);
        setShippingFeeType('선불');
        setPaymentStatus('completed'); setPaymentMethod('카드');
    };

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSave = async () => {
        if (!farm?.id || saving) return;
        if (!ordererName) { alert("주문자 성함을 입력해주세요."); return; }
        const validItems = courierItems.filter(i => Number(i.quantity) > 0);
        if (validItems.length === 0) { alert("품목을 추가하고 수량을 입력해주세요."); return; }
        const finalShipping = Number(stripNonDigits(shippingCost)) || 0;
        setSaving(true);
        try {
            const groupId = editingGroupId || crypto.randomUUID();
            // 기존 그룹/단건 삭제 후 재삽입
            if (editingGroupId) {
                await supabase.from('sales_records').delete().eq('farm_id', farm.id).eq('harvest_note', 'GRP:' + editingGroupId);
            } else if (editingRecordId) {
                await supabase.from('sales_records').delete().eq('id', editingRecordId);
            }
            const sharedData = {
                farm_id: farm.id, customer_id: selectedCustomerId, customer_name: ordererName, phone: ordererPhone,
                recipient_name: recipientName, recipient_phone: recipientPhone, address: recipientAddress, detail_address: recipientDetailAddress,
                delivery_note: deliveryNote, shipping_fee_type: shippingFeeType,
                sale_type: 'b2c', delivery_method: 'courier',
                is_settled: paymentStatus === 'completed', payment_status: paymentStatus, payment_method: paymentMethod,
                recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0],
                settled_at: paymentStatus === 'completed' ? selectedDate : null,
                harvest_note: 'GRP:' + groupId,
            };
            for (let idx = 0; idx < validItems.length; idx++) {
                const item = validItems[idx];
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const { error } = await supabase.from('sales_records').insert([{
                    ...sharedData,
                    crop_name: item.cropName, sale_unit: item.unit,
                    quantity: Number(item.quantity), price: lineTotal > 0 ? lineTotal : null,
                    shipping_cost: idx === 0 ? finalShipping : 0,
                }]);
                if (error) throw error;
            }
            handleResetAllStates();
            setIsEditMode(false);
            setDetailModal(null);
            setTimeout(() => fetchHistory(), 200);
            alert("✅ 기록이 성공적으로 저장되었습니다!");
            setErrorMsg(null);
        } catch (error: any) {
            console.error("저장 중 오류 상세:", JSON.stringify(error, null, 2));
            const msg = error.message || "알 수 없는 오류";
            setErrorMsg(msg);
            alert("저장 실패: " + msg);
        } finally {
            setSaving(false);
        }
    };

    // [FIX] 택배 아이콘 수정 - DB crop_icon 우선 적용
    const handleEdit = (group: SalesRecord[]) => {
        const first = group[0] as any;
        const gid = first.harvest_note?.startsWith('GRP:') ? first.harvest_note.slice(4) : null;
        setEditingGroupId(gid);
        setEditingRecordId(gid ? null : first.id);
        setIsEditMode(true);
        setCropName(first.crop_name || '딸기');
        setSaleUnit(first.sale_unit || '박스');
        setSelectedDate(first.recorded_at.split('T')[0]);
        setPaymentStatus(first.payment_status as 'pending' | 'completed');
        setPaymentMethod(first.payment_method || '카드');
        setCourierItems(group.map((r: any) => ({
            id: r.id,
            cropName: r.crop_name || '딸기',
            cropIcon: getCropIcon(r.crop_name || ''),
            unit: r.sale_unit || '박스',
            quantity: r.quantity?.toString() || '',
            unitPrice: r.quantity && r.price ? Math.floor(r.price / r.quantity).toString() : ''
        })));
        setOrdererName(first.customer_name || ""); setOrdererPhone(first.phone || "");
        setRecipientName(first.recipient_name || ""); setRecipientPhone(first.recipient_phone || "");
        setRecipientAddress(first.address || ""); setRecipientDetailAddress(first.detail_address || "");
        setShippingCost(first.shipping_cost?.toString() || "");
        setShippingFeeType(first.shipping_fee_type || '선불');
        setDeliveryNote(first.delivery_note || "");
        setIsSameAsOrderer(first.recipient_name === first.customer_name && first.recipient_phone === first.phone);
        if (first.customer) {
            setSelectedCustomerId(first.customer.id);
            setSearchTerm(first.customer.name);
        } else {
            setSearchTerm(first.customer_name || "");
        }
    };

    const handleDelete = async (group: SalesRecord[]) => {
        if (!confirm("삭제하시겠습니까?")) return;
        const first = group[0] as any;
        const gid = first.harvest_note?.startsWith('GRP:') ? first.harvest_note.slice(4) : null;
        if (gid) {
            await supabase.from('sales_records').delete().eq('farm_id', farm?.id).eq('harvest_note', 'GRP:' + gid);
        } else {
            await supabase.from('sales_records').delete().eq('id', first.id);
        }
        fetchHistory();
    };

    // 내역 그룹핑 (harvest_note GRP: 기준)
    const groupedHistory = useMemo(() => {
        const groups: Map<string, SalesRecord[]> = new Map();
        for (const item of history) {
            const hn = item.harvest_note;
            const gid = typeof hn === 'string' && hn.startsWith('GRP:') ? hn.slice(4) : item.id;
            if (!groups.has(gid)) groups.set(gid, []);
            groups.get(gid)!.push(item);
        }
        return Array.from(groups.values()).sort((a, b) =>
            new Date(b[0].recorded_at).getTime() - new Date(a[0].recorded_at).getTime()
        );
    }, [history]);

    const renderOrderForm = (inModal = false) => {
        const isFormActive = searchTerm.trim().length > 0 || ordererName.trim().length > 0 || inModal;

        return (
            <div className={`space-y-4 ${inModal ? 'max-h-[60vh] overflow-y-auto scrollbar-hide p-1' : ''}`}>
                {/* ① 주문자 정보 (먼저!) */}
                <div className="bg-white rounded-[2rem] shadow-xl border border-rose-100 p-5 space-y-3">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-rose-500 uppercase px-1">
                            {isFormActive ? '주문자 정보' : '주문자 검색 (입력 시 폼 활성화)'}
                        </label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
                            <input type="text" value={searchTerm} onChange={(e) => {
                                const val = e.target.value;
                                const formatted = val.match(/^\d/) ? formatPhone(val) : val;
                                setSearchTerm(formatted);
                                setOrdererName(formatted);
                                setSelectedCustomerId(null);
                            }}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black outline-none focus:border-rose-400 focus:bg-white transition-all shadow-inner"
                                placeholder="성함 혹은 연락처 검색..." />
                            {isSearchFocused && searchResult.length > 0 && selectedCustomerId === null && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-rose-200 rounded-2xl shadow-2xl z-[100] divide-y divide-slate-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                    {searchResult.map(c => (
                                        <button key={c.id}
                                            onClick={() => {
                                                setSelectedCustomerId(c.id);
                                                setOrdererName(c.name);
                                                setOrdererPhone(c.contact || "");
                                                setSearchTerm(c.name);
                                                if (c.address) setRecipientAddress(c.address);
                                                if (c.detail_address) setRecipientDetailAddress(c.detail_address);
                                            }}
                                            className="w-full p-4 hover:bg-rose-50 flex items-center justify-between text-left transition-colors active:bg-rose-100">
                                            <div>
                                                <p className="font-black text-slate-900">{c.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{c.contact || '연락처 없음'}</p>
                                                {c.address && <p className="text-[10px] text-slate-300 truncate max-w-[180px]">{c.address}</p>}
                                            </div>
                                            <div className="bg-rose-50 text-rose-500 p-1.5 rounded-lg">
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {isFormActive && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input type="text" value={ordererName} onChange={(e) => setOrdererName(e.target.value)} placeholder="주문자명" className="w-full pl-9 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black outline-none" /></div>
                                <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input type="text" value={ordererPhone} onChange={(e) => setOrdererPhone(formatPhone(e.target.value))} placeholder="연락처" className="w-full pl-9 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black outline-none" /></div>
                            </div>
                        )}
                    </div>
                </div>

                {isFormActive && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-4">
                        <div className="bg-white rounded-[2rem] shadow-xl border border-rose-100 p-5 space-y-3">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black text-rose-400 uppercase">배송지 정보</label>
                                    <button onClick={() => setIsSameAsOrderer(!isSameAsOrderer)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border
                                            ${isSameAsOrderer ? 'bg-rose-600 border-rose-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>
                                        <UserCheck className="w-3.5 h-3.5" /> 주문자고정
                                    </button>
                                </div>
                                {!isSameAsOrderer && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in slide-in-from-top-1">
                                        <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="수령인 성함" className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black" />
                                        <input type="text" value={recipientPhone} onChange={(e) => setRecipientPhone(formatPhone(e.target.value))} placeholder="수령인 연락처" className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black" />
                                    </div>
                                )}
                                <AddressSearch label="" value={recipientAddress} onChange={setRecipientAddress} className="!space-y-0" placeholder="배송지 주소 검색" />
                                <input type="text" value={recipientDetailAddress} onChange={(e) => setRecipientDetailAddress(e.target.value)} placeholder="동/호수/상세주소 직접 입력" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-rose-400" />
                            </div>

                            <div className="space-y-4 pt-4 border-t border-dashed border-slate-100">
                                {/* � 장바구니 (품목 탭 → 즉시 추가) */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1">🛒 품목 담기 ({courierItems.length})</label>
                                    </div>
                                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                                        {farmCrops.map((crop) => (
                                            <button key={crop.id}
                                                onClick={() => addToCart(crop)}
                                                className="min-w-[68px] flex flex-col items-center justify-center py-2.5 px-1.5 rounded-2xl border-2 transition-all gap-0.5 shrink-0 bg-white border-slate-100 hover:border-rose-300 hover:bg-rose-50 active:scale-95">
                                                <span className="text-2xl leading-none">{getCropIcon(crop.crop_name)}</span>
                                                <span className="text-[9px] font-black text-slate-800 whitespace-nowrap truncate max-w-[60px]">{crop.crop_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {courierItems.length === 0 && (
                                        <div className="text-center py-6 text-slate-300 text-xs font-bold border-2 border-dashed border-slate-100 rounded-2xl">
                                            위 품목을 탭하면 자동으로 추가됩니다
                                        </div>
                                    )}
                                    {courierItems.map((item) => (
                                        <div key={item.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{item.cropIcon}</span>
                                                    <span className="text-sm font-black text-slate-800">{item.cropName}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {(() => { const cr = farmCrops.find(c => c.crop_name === item.cropName); return cr ? getEffectiveUnits(cr) : [item.unit]; })().map((u: string) => (
                                                        <button key={u} onClick={() => updateCourierItem(item.id, 'unit', u)}
                                                            className={`text-[9px] font-bold px-2 py-1 rounded-lg transition-all ${item.unit === u ? 'bg-rose-500 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                            {u}
                                                        </button>
                                                    ))}
                                                    <button onClick={() => removeCourierItem(item.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors ml-0.5"><X className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-0.5">
                                                    <label className="text-[8px] font-black text-slate-400 px-1">수량</label>
                                                    <input type="text" value={item.quantity}
                                                        onChange={(e) => updateCourierItem(item.id, 'quantity', e.target.value.replace(/[^0-9]/g, ''))}
                                                        className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-center text-lg font-black outline-none focus:border-rose-300" placeholder="0" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <label className="text-[8px] font-black text-slate-400 px-1">단가 (원)</label>
                                                    <input type="text" value={item.unitPrice ? formatCurrency(item.unitPrice) : ""}
                                                        onChange={(e) => updateCourierItem(item.id, 'unitPrice', stripNonDigits(e.target.value))}
                                                        className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-center text-lg font-black outline-none focus:border-rose-300" placeholder="0원" />
                                                </div>
                                            </div>
                                            {(Number(item.quantity) > 0 && Number(item.unitPrice) > 0) && (
                                                <div className="text-right text-[11px] font-black text-emerald-600 pr-1">
                                                    소계: {formatCurrency((Number(item.quantity) * Number(item.unitPrice)))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {courierItems.length > 0 && (
                                        <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 text-center">
                                            <span className="text-[9px] font-black text-emerald-400">상품 합계</span>
                                            <p className="text-2xl font-black text-emerald-600">{formatCurrency(courierItemsTotal)}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5 col-span-2">
                                        <label className="text-[9px] font-black text-slate-400 px-1">택배비 구분 / 금액</label>
                                        <div className="flex gap-2">
                                            <div className="flex-[1.2] flex gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                                {['선불', '착불'].map(t => (
                                                    <button key={t}
                                                        onClick={() => {
                                                            setShippingFeeType(t);
                                                            if (t === '착불') setShippingCost("0");
                                                        }}
                                                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all
                                                            ${shippingFeeType === t ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className={`flex-1 bg-rose-50/30 p-1.5 rounded-2xl border flex flex-col items-center justify-center transition-all ${shippingFeeType === '착불' ? 'opacity-50 grayscale' : 'border-rose-100'}`}>
                                                <div className="flex items-center gap-1">
                                                    <input type="text"
                                                        value={shippingCost ? formatCurrency(shippingCost) : ""}
                                                        disabled={shippingFeeType === '착불'}
                                                        onChange={(e) => setShippingCost(stripNonDigits(e.target.value))}
                                                        className="w-full bg-transparent text-xl font-black text-center text-rose-600 outline-none"
                                                        placeholder="4,000원" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative border-t border-dashed border-slate-100 pt-4">
                                <AlignLeft className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none mt-2" />
                                <input type="text" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)}
                                    className="w-full pl-11 p-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl text-xs font-bold outline-none"
                                    placeholder="배송 특이사항 (예: 문 앞에 놓아주세요)" />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dashed border-slate-100">
                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                    {['카드', '현금', '계좌'].map(m => (<button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${paymentMethod === m ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400'}`}>{m}</button>))}
                                </div>
                                <button onClick={() => setPaymentStatus(paymentStatus === 'completed' ? 'pending' : 'completed')}
                                    className={`py-4 rounded-xl border-2 font-black text-xs transition-all flex items-center justify-center
                                        ${paymentStatus === 'completed' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-amber-400 bg-amber-50 text-amber-600'}`}>
                                    {paymentStatus === 'completed' ? '정산 완료' : '미정산 (외상)'}
                                </button>
                            </div>
                            {!inModal && (
                                <button onClick={handleSave} disabled={saving}
                                    className="w-full py-5 rounded-[1.25rem] text-lg font-black text-white bg-rose-600 shadow-2xl shadow-rose-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                    {saving ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>{editingRecordId ? '수정 내용 저장' : '택배 기록 저장'}</span></>}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>

            <div className="min-h-screen pb-20 bg-slate-50/30">
                <div className="max-w-2xl mx-auto p-3 md:p-3 space-y-4">

                    <div className="flex items-center justify-between px-1 gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                                택배 <Truck className="w-4 h-4 text-rose-500" />
                            </h1>
                            <div className="bg-rose-500 text-white px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                                <span className="text-[10px] font-black whitespace-nowrap">
                                    {new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setShowCalendar(!showCalendar)}
                            className={`h-10 px-4 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md border-2 shrink-0
                        ${showCalendar ? 'bg-rose-600 text-white border-rose-700' : 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50'}`}>
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

                    {!isEditMode && renderOrderForm(false)}
                    <div className="space-y-3 pb-10">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 px-1"><History className="w-4 h-4 text-slate-300" /> 택배 내역 (상세)</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={fetchHistory}
                                    disabled={loading}
                                    className={`p-3 bg-white border border-slate-100 text-slate-400 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:rotate-180 ${loading ? 'opacity-50' : ''}`}>
                                    <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {groupedHistory.map(group => {
                                const first = group[0];
                                const totalPrice = group.reduce((s, r) => s + (r.price || 0), 0);
                                const groupIcons = group.map(r => getCropIcon(r.crop_name || ''));
                                const qtySummary = group.length > 1
                                    ? group.map(r => `${r.quantity}${r.sale_unit}`).join('+')
                                    : `${first.quantity}${first.sale_unit}`;
                                return (
                                    <button key={first.id}
                                        onClick={() => setDetailModal(group)}
                                        className="w-full text-left bg-white p-3 rounded-2xl border border-slate-100 hover:border-rose-200 transition-all shadow-sm active:scale-[0.98] flex flex-col gap-1.5">
                                        {/* 상단: 아이콘 + 정산상태 */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-0.5">
                                                {groupIcons.map((icon, i) => (
                                                    <span key={i} className="text-xl leading-none">{icon}</span>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {group.length > 1 && (
                                                    <span className="text-[8px] font-black bg-rose-50 text-rose-400 px-1.5 py-0.5 rounded-full">{group.length}품목</span>
                                                )}
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${first.is_settled ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500 animate-pulse'}`}>
                                                    {first.is_settled ? '완료' : '미정산'}
                                                </span>
                                            </div>
                                        </div>
                                        {/* 중단: 이름 */}
                                        <div>
                                            <p className="text-[13px] font-black text-slate-900 truncate">
                                                {first.customer?.name || first.customer_name || '미지정'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 truncate">
                                                {first.crop_name} {qtySummary}
                                            </p>
                                        </div>
                                        {/* 하단: 금액 + 날짜 */}
                                        <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                                            <span className="text-[13px] font-black text-rose-600">{formatCurrency(totalPrice)}</span>
                                            <span className="text-[10px] font-bold text-slate-300">
                                                {new Date(first.recorded_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div >

            {/* ===== 택배 기록 상세/수정 팝업 모달 ===== */}
            {detailModal && detailModal.length > 0 && (() => {
                const dm = detailModal[0];
                const allItems = detailModal;
                const totalPrice = allItems.reduce((s, r) => s + (r.price || 0), 0);
                return (
                    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailModal(null)} />
                        <div className="relative bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl shadow-black/20 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-300">
                            {/* 헤더 */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-black text-slate-900">
                                        {isEditMode ? '내용 수정' : (
                                            <>{dm.customer_name || '미지정'}{dm.recipient_name && dm.recipient_name !== dm.customer_name ? ` → ${dm.recipient_name}` : ''}</>
                                        )}
                                    </h2>
                                    {!isEditMode && (
                                        <div className="space-y-0.5 mt-1">
                                            {allItems.map((item, idx) => (
                                                <p key={idx} className="text-xs text-slate-400 font-bold">
                                                    {getCropIcon(item.crop_name || '')} {item.crop_name} {item.quantity}{item.sale_unit} · {formatCurrency(item.price || 0)}
                                                </p>
                                            ))}
                                            {allItems.length > 1 && (
                                                <p className="text-xs font-black text-emerald-600 pt-0.5">합계: {formatCurrency(totalPrice)} · {dm.payment_method}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => { setDetailModal(null); setIsEditMode(false); }} className="p-2 rounded-full hover:bg-gray-100 text-gray-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {isEditMode ? renderOrderForm(true) : (
                                <>
                                    {/* 정산 상태 토글 */}
                                    <div>
                                        <label className="text-[10px] font-black text-gray-700 uppercase block mb-2 ml-1">정산 상태</label>
                                        <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                            <button
                                                onClick={async () => {
                                                    const gid = (dm as any).harvest_note?.startsWith('GRP:') ? (dm as any).harvest_note.slice(4) : null;
                                                    const updateData = { is_settled: true, payment_status: 'completed' };
                                                    if (gid) {
                                                        await supabase.from('sales_records').update(updateData).eq('farm_id', farm?.id).eq('harvest_note', 'GRP:' + gid);
                                                    } else {
                                                        await supabase.from('sales_records').update(updateData).eq('id', dm.id);
                                                    }
                                                    fetchHistory();
                                                    setDetailModal(allItems.map(r => ({ ...r, is_settled: true, payment_status: 'completed' })));
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${dm.is_settled ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-700'}`}>
                                                <CheckCircle className="w-4 h-4" /> 정산 완료
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const gid = (dm as any).harvest_note?.startsWith('GRP:') ? (dm as any).harvest_note.slice(4) : null;
                                                    const updateData = { is_settled: false, payment_status: 'pending' };
                                                    if (gid) {
                                                        await supabase.from('sales_records').update(updateData).eq('farm_id', farm?.id).eq('harvest_note', 'GRP:' + gid);
                                                    } else {
                                                        await supabase.from('sales_records').update(updateData).eq('id', dm.id);
                                                    }
                                                    fetchHistory();
                                                    setDetailModal(allItems.map(r => ({ ...r, is_settled: false, payment_status: 'pending' })));
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${!dm.is_settled ? 'bg-white shadow-sm text-amber-500' : 'text-gray-700'}`}>
                                                <Clock className="w-4 h-4" /> 미정산 (외상)
                                            </button>
                                        </div>
                                    </div>

                                    {/* 버튼들 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => { handleDelete(allItems); setDetailModal(null); }}
                                            className="py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-500 font-black text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all active:scale-95">
                                            <Trash2 className="w-4 h-4" /> 삭제
                                        </button>
                                        <button
                                            onClick={() => { handleEdit(allItems); }}
                                            className="py-4 rounded-2xl bg-rose-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95">
                                            <Edit2 className="w-4 h-4" /> 내용 수정
                                        </button>
                                    </div>
                                </>
                            )}

                            {isEditMode && (
                                <div className="flex gap-2 pt-1 border-t border-slate-100 mt-4">
                                    <button onClick={() => { setIsEditMode(false); handleResetAllStates(); }}
                                        className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm hover:bg-slate-200 transition-all">
                                        취소
                                    </button>
                                    <button onClick={() => {
                                        if (confirm("정말 삭제하시겠습니까? 삭제하시면 되돌릴 수 없습니다.")) {
                                            handleDelete(allItems);
                                            setIsEditMode(false);
                                            setDetailModal(null);
                                        }
                                    }}
                                        className="flex-1 py-3 rounded-2xl bg-rose-50 text-rose-500 font-black text-sm hover:bg-rose-100 transition-all">
                                        삭제
                                    </button>
                                    <button onClick={handleSave} disabled={saving}
                                        className={`flex-[1.5] py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${saving ? 'bg-indigo-400 cursor-not-allowed text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                                    >
                                        {saving ? (
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
                            )}
                        </div>
                    </div>
                );
            })()}
        </>
    );
}
