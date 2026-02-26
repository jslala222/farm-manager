"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, Search, History, RefreshCcw, Save, Phone, User, ArrowRight, UserCheck, AlignLeft, Edit2, Trash2, Calendar as CalendarIcon, X, CheckCircle, Clock } from 'lucide-react';
import { useAuthStore } from "@/store/authStore";
import { supabase, SalesRecord, Customer } from "@/lib/supabase";
import { formatCurrency, formatPhone, stripNonDigits } from "@/lib/utils";
import AddressSearch from "@/components/AddressSearch";
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
    if (cropName.includes('참외') || cropName.includes('메론')) return '🍈';
    return '📦';
};

export default function CourierSalesPage() {
    const { farm, initialized } = useAuthStore();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [history, setHistory] = useState<SalesRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [farmCrops, setFarmCrops] = useState<any[]>([]);
    // 상세 팝업 모달 상태
    const [detailModal, setDetailModal] = useState<SalesRecord | null>(null);

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

    // [수정] 수량, 단가 상태 추가
    const [quantity, setQuantity] = useState("1");
    const [unitPrice, setUnitPrice] = useState("");
    const [shippingCost, setShippingCost] = useState(""); // 택배비 직접 입력
    const [courierTotalPrice, setCourierTotalPrice] = useState("");
    const [shippingFeeType, setShippingFeeType] = useState('선불'); // 선불/착불 상태
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
        setEditingRecordId(null); setSelectedCustomerId(null); setSearchTerm("");
        setOrdererName(""); setOrdererPhone(""); setRecipientName(""); setRecipientPhone("");
        setRecipientAddress(""); setRecipientDetailAddress("");
        setQuantity("1"); setUnitPrice(""); setShippingCost("");
        setCourierTotalPrice(""); setDeliveryNote(""); setIsSameAsOrderer(true);
        setShippingFeeType('선불');
        setPaymentStatus('completed'); setPaymentMethod('카드');
    };

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSave = async () => {
        if (!farm?.id || saving) return;
        if (!ordererName) { alert("주문자 성함을 입력해주세요."); return; }

        // [수정] 저장 전 데이터 정수화
        const finalPrice = Number(stripNonDigits(courierTotalPrice)) || 0;
        const finalShipping = Number(stripNonDigits(shippingCost)) || 0;
        const finalQuantity = Number(quantity) || 1;

        setSaving(true);
        try {
            const courierData = {
                farm_id: farm.id, customer_id: selectedCustomerId, customer_name: ordererName, phone: ordererPhone,
                recipient_name: recipientName, recipient_phone: recipientPhone, address: recipientAddress, detail_address: recipientDetailAddress,
                delivery_note: deliveryNote,
                quantity: finalQuantity,
                price: finalPrice,
                shipping_cost: finalShipping,
                shipping_fee_type: shippingFeeType,
                crop_name: cropName, sale_unit: saleUnit,
                sale_type: 'b2c',
                delivery_method: 'courier', is_settled: paymentStatus === 'completed', payment_status: paymentStatus, payment_method: paymentMethod,
                recorded_at: selectedDate + 'T' + new Date().toTimeString().split(' ')[0]
            };

            let result;
            if (editingRecordId) {
                result = await supabase.from('sales_records').update(courierData).eq('id', editingRecordId);
            } else {
                result = await supabase.from('sales_records').insert([courierData]);
            }

            if (result.error) throw result.error;

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

    const handleEdit = (record: any) => {
        setEditingRecordId(record.id);
        setIsEditMode(true);
        const targetCrop = farmCrops.find(c => c.crop_name === record.crop_name);
        setCropName(record.crop_name || '딸기');
        setSaleUnit(record.sale_unit || targetCrop?.available_units?.[0] || '박스');
        setSelectedDate(record.recorded_at.split('T')[0]); setPaymentStatus(record.payment_status as 'pending' | 'completed'); setPaymentMethod(record.payment_method || '카드');

        setQuantity(record.quantity?.toString() || "1");
        const calculatedUnitPrice = record.quantity && record.price ? Math.floor(record.price / record.quantity) : "";
        setUnitPrice(calculatedUnitPrice.toString());
        setCourierTotalPrice(record.price?.toString() || "");

        setOrdererName(record.customer_name || ""); setOrdererPhone(record.phone || "");
        setRecipientName(record.recipient_name || ""); setRecipientPhone(record.recipient_phone || "");
        setRecipientAddress(record.address || ""); setRecipientDetailAddress(record.detail_address || "");
        setShippingCost(record.shipping_cost?.toString() || "");
        setShippingFeeType(record.shipping_fee_type || '선불');
        setDeliveryNote(record.delivery_note || "");
        setIsSameAsOrderer(record.recipient_name === record.customer_name && record.recipient_phone === record.phone);
        if (record.customer) {
            setSelectedCustomerId(record.customer.id);
            setSearchTerm(record.customer.name);
        } else {
            setSearchTerm(record.customer_name || "");
        }
    };

    const handleDelete = async (id: string) => { if (!confirm("삭제하시겠습니까?")) return; const { error } = await supabase.from('sales_records').delete().eq('id', id); if (!error) fetchHistory(); };

    const renderOrderForm = (inModal = false) => {
        const isFormActive = searchTerm.trim().length > 0 || ordererName.trim().length > 0 || inModal;

        return (
            <div className={`space-y-4 ${inModal ? 'max-h-[60vh] overflow-y-auto scrollbar-hide p-1' : ''}`}>
                <div className="relative bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-white shadow-sm space-y-4">
                    <div className="flex gap-2">
                        {farmCrops.map((crop) => (
                            <button key={crop.id}
                                onClick={() => {
                                    setCropName(crop.crop_name);
                                    if (crop.available_units?.length > 0) setSaleUnit(crop.available_units[0]);
                                }}
                                className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl border-2 transition-all gap-1 min-w-0 relative
                                        ${cropName === crop.crop_name ? 'bg-rose-50 border-rose-500 shadow-sm ring-2 ring-rose-100 z-10' : 'bg-white border-slate-50 opacity-40 hover:opacity-100'}`}>
                                <span className="text-3xl leading-none mb-1">{getCropIcon(crop.crop_name)}</span>
                                <span className="text-[10px] font-black text-slate-800 tracking-tighter truncate w-full text-center px-1">{crop.crop_name}</span>
                                {cropName === crop.crop_name && (
                                    <div className="absolute -bottom-[21px] border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px] border-b-slate-100 z-20"></div>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex gap-1.5 overflow-x-auto scrollbar-hide">
                        {farmCrops.find(c => c.crop_name === cropName)?.available_units?.map((unit: string) => (
                            <button key={unit} onClick={() => setSaleUnit(unit)}
                                className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all whitespace-nowrap px-4
                                    ${saleUnit === unit ? 'bg-rose-600 text-white shadow-lg scale-[1.02]' : 'bg-white text-slate-400 border border-slate-100 opacity-60'}`}>
                                {unit}
                            </button>
                        )) || <div className="p-2 text-[10px] text-slate-400 font-bold w-full text-center">선택 가능한 단위가 없습니다</div>}
                    </div>
                </div>

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
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
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
                                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1">
                                        <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="수령인 성함" className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black" />
                                        <input type="text" value={recipientPhone} onChange={(e) => setRecipientPhone(formatPhone(e.target.value))} placeholder="수령인 연락처" className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black" />
                                    </div>
                                )}
                                <AddressSearch label="" value={recipientAddress} onChange={setRecipientAddress} className="!space-y-0" placeholder="배송지 주소 검색" />
                                <input type="text" value={recipientDetailAddress} onChange={(e) => setRecipientDetailAddress(e.target.value)} placeholder="동/호수/상세주소 직접 입력" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-rose-400" />
                            </div>

                            <div className="space-y-4 pt-4 border-t border-dashed border-slate-100">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5 flex flex-col">
                                        <label className="text-[9px] font-black text-slate-400 px-1">수량 ({saleUnit})</label>
                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center">
                                            <input type="text" value={quantity} onChange={(e) => {
                                                const rawQ = e.target.value.replace(/[^0-9]/g, '');
                                                setQuantity(rawQ);
                                                const q = Number(rawQ) || 0;
                                                const p = Number(unitPrice) || 0;
                                                if (q > 0 && p > 0) setCourierTotalPrice((q * p).toString());
                                                else setCourierTotalPrice("");
                                            }} className="w-full bg-transparent text-xl font-black text-center outline-none" placeholder="1" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 flex flex-col">
                                        <label className="text-[9px] font-black text-slate-400 px-1">단가 (원)</label>
                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center">
                                            <input type="text"
                                                value={unitPrice ? formatCurrency(unitPrice) : ""}
                                                onChange={(e) => {
                                                    const rawP = stripNonDigits(e.target.value);
                                                    setUnitPrice(rawP);
                                                    const q = Number(quantity) || 0;
                                                    const p = Number(rawP) || 0;
                                                    if (q > 0 && p > 0) setCourierTotalPrice((q * p).toString());
                                                    else setCourierTotalPrice("");
                                                }}
                                                className="w-full bg-transparent text-xl font-black text-center outline-none text-slate-700"
                                                placeholder="0원" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-rose-500 px-1">총 상품 금액 (수량 × 단가)</label>
                                    <div className="bg-emerald-50/10 p-2.5 rounded-2xl border-2 border-emerald-100/50 flex items-center gap-2">
                                        <input type="text"
                                            value={courierTotalPrice ? formatCurrency(courierTotalPrice) : ""}
                                            onChange={(e) => {
                                                const rawT = stripNonDigits(e.target.value);
                                                setCourierTotalPrice(rawT);
                                                const q = Number(quantity) || 0;
                                                const t = Number(rawT) || 0;
                                                if (q > 0) setUnitPrice(Math.floor(t / q).toString());
                                            }}
                                            className="w-full bg-transparent text-3xl font-black text-center text-emerald-600 outline-none"
                                            placeholder="0원" />
                                    </div>
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
                                    {saving ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>{editingRecordId ? '수정 내용 저장' : 'B2C 택배 기록 저장'}</span></>}
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
                                택배 (B2C) <Truck className="w-4 h-4 text-rose-500" />
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
                            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 px-1"><History className="w-4 h-4 text-slate-300" /> B2C 택배 내역 (상세)</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={fetchHistory}
                                    disabled={loading}
                                    className={`p-3 bg-white border border-slate-100 text-slate-400 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:rotate-180 ${loading ? 'opacity-50' : ''}`}>
                                    <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            {history.map(item => (
                                <button key={item.id}
                                    onClick={() => setDetailModal(item)}
                                    className="w-full text-left bg-white px-4 py-3 rounded-2xl border border-slate-100 hover:border-rose-200 transition-all flex justify-between items-center shadow-sm active:scale-[0.98]">
                                    <div className="flex-1 flex items-center gap-3 min-w-0">
                                        <span className="text-sm font-black text-slate-700 flex-shrink-0 whitespace-nowrap w-24">
                                            {getCropIcon(item.crop_name || "")} {item.crop_name || '미지정'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[14px] font-black text-slate-900 truncate">
                                                    {item.customer?.name || item.customer_name || '미지정'}
                                                </span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${item.is_settled ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500 animate-pulse'}`}>
                                                    {item.is_settled ? '완료' : '미정산'}
                                                </span>
                                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                                                    {item.payment_method || '미지정'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mt-0.5">
                                                <span className="text-rose-500 font-black">{item.quantity}{item.sale_unit}</span>
                                                <span className="w-px h-2 bg-slate-200" />
                                                <span className="text-slate-700 font-extrabold">{formatCurrency(item.price || 0)}</span>
                                                <span className="w-px h-2 bg-slate-200" />
                                                <span className="truncate max-w-[120px]">{item.recipient_name || '수령인동일'}</span>
                                                <span className="w-px h-2 bg-slate-200" />
                                                <span className="text-[10px]">{new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Edit2 className="w-4 h-4 text-slate-200 ml-2 shrink-0" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div >

            {/* ===== 택배 기록 상세/수정 팝업 모달 ===== */}
            {
                detailModal && (
                    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailModal(null)} />
                        <div className="relative bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl shadow-black/20 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-300">
                            {/* 헤더 */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-black text-slate-900">
                                        {isEditMode ? '내용 수정' : (
                                            <>{detailModal.customer_name || '미지정'}{detailModal.recipient_name && detailModal.recipient_name !== detailModal.customer_name ? ` → ${detailModal.recipient_name}` : ''}</>
                                        )}
                                    </h2>
                                    {!isEditMode && (
                                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                                            {detailModal.crop_name} {detailModal.quantity}{detailModal.sale_unit} · {formatCurrency(detailModal.price || 0)} · {detailModal.payment_method}
                                        </p>
                                    )}
                                </div>
                                <button onClick={() => { setDetailModal(null); setIsEditMode(false); }} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {isEditMode ? renderOrderForm(true) : (
                                <>
                                    {/* 정산 상태 토글 */}
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">정산 상태</label>
                                        <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                            <button
                                                onClick={async () => {
                                                    await supabase.from('sales_records').update({ is_settled: true, payment_status: 'completed' }).eq('id', detailModal.id);
                                                    fetchHistory();
                                                    setDetailModal({ ...detailModal, is_settled: true, payment_status: 'completed' });
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${detailModal.is_settled ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-400'}`}>
                                                <CheckCircle className="w-4 h-4" /> 정산 완료
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    await supabase.from('sales_records').update({ is_settled: false, payment_status: 'pending' }).eq('id', detailModal.id);
                                                    fetchHistory();
                                                    setDetailModal({ ...detailModal, is_settled: false, payment_status: 'pending' });
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${!detailModal.is_settled ? 'bg-white shadow-sm text-amber-500' : 'text-gray-400'}`}>
                                                <Clock className="w-4 h-4" /> 미정산 (외상)
                                            </button>
                                        </div>
                                    </div>

                                    {/* 버튼들 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => { handleDelete(detailModal.id); setDetailModal(null); }}
                                            className="py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-500 font-black text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all active:scale-95">
                                            <Trash2 className="w-4 h-4" /> 삭제
                                        </button>
                                        <button
                                            onClick={() => { handleEdit(detailModal); }}
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
                                        if (confirm("정말 삭제하시겠습니까? 삭제하시면 되돌릴 수 없으니, 자세히 확인 후 삭제하기 바랍니다.")) {
                                            handleDelete(detailModal.id);
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
                )
            }
        </>
    );
}
