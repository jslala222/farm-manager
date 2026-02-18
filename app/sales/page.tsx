"use client";

import { useState, useEffect } from "react";
import { Save, TrendingUp, History, Clock, Trash2, ShoppingCart, Truck, Utensils, Edit2, X, Check, MapPin, UserSquare, DollarSign } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, SalesRecord } from "@/lib/supabase";

export default function SalesPage() {
    const { farm } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'nonghyup' | 'jam' | 'etc'>('nonghyup');
    const [history, setHistory] = useState<SalesRecord[]>([]);
    const [quantity, setQuantity] = useState("");
    const [price, setPrice] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [address, setAddress] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editType, setEditType] = useState<'nonghyup' | 'jam' | 'etc'>('nonghyup');
    const [editQuantity, setEditQuantity] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [editCustomer, setEditCustomer] = useState("");
    const [editAddress, setEditAddress] = useState("");
    const [editDate, setEditDate] = useState("");

    useEffect(() => {
        if (farm?.id) fetchHistory();
    }, [farm]);

    const fetchHistory = async () => {
        if (!farm?.id) return;
        setLoading(true);
        const { data } = await supabase
            .from('sales_records')
            .select('*')
            .eq('farm_id', farm.id)
            .order('recorded_at', { ascending: false })
            .limit(10);
        setHistory(data ?? []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!quantity || !farm?.id) { alert("수량을 입력해주세요!"); return; }
        setSaving(true);

        // Combine date with current time
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0];
        const dateTime = `${selectedDate}T${timeString}`;

        const { error } = await supabase.from('sales_records').insert({
            farm_id: farm.id,
            sale_type: activeTab,
            quantity: parseFloat(quantity),
            price: price ? parseInt(price) : null,
            customer_name: customerName || null,
            address: address || null,
            recorded_at: new Date(dateTime).toISOString(),
        });
        if (error) { alert(`저장 실패: ${error.message}`); }
        else {
            alert(`✅ 저장 완료!\n${selectedDate}`);
            setQuantity(""); setPrice(""); setCustomerName(""); setAddress("");
            fetchHistory(); // 목록 갱신
        }
        setSaving(false);
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        setSaving(true);

        let updateData: any = {
            sale_type: editType,
            quantity: parseFloat(editQuantity),
            price: editPrice ? parseInt(editPrice) : null,
            customer_name: editCustomer || null,
            address: editAddress || null,
        };

        if (editDate) {
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0];
            updateData.recorded_at = new Date(`${editDate}T${timeString}`).toISOString();
        }

        const { error } = await supabase.from('sales_records').update(updateData).eq('id', editingId);

        if (error) alert("수정 실패");
        else {
            setEditingId(null);
            fetchHistory();
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("이 판매 기록을 삭제하시겠습니까?")) return;
        const { error } = await supabase.from('sales_records').delete().eq('id', id);
        if (error) alert("삭제 실패");
        else fetchHistory();
    };

    const startEdit = (item: SalesRecord) => {
        setEditingId(item.id);
        setEditType(item.sale_type as any);
        setEditQuantity(item.quantity.toString());
        setEditPrice(item.price?.toString() || "");
        setEditCustomer(item.customer_name || "");
        setEditAddress(item.address || "");
        setEditDate(item.recorded_at.split('T')[0]);
    };

    const typeInfo = (type: string) => {
        switch (type) {
            case 'nonghyup': return { label: '농협 출하', icon: Truck, color: 'text-green-600 bg-green-50', unit: '박스' };
            case 'jam': return { label: '잼 가공', icon: Utensils, color: 'text-purple-600 bg-purple-50', unit: 'kg' };
            default: return { label: '택배/기타', icon: ShoppingCart, color: 'text-blue-600 bg-blue-50', unit: '박스' };
        }
    };

    const tabs = [
        { id: 'nonghyup', label: '🌾 농협 출하' },
        { id: 'jam', label: '🍯 잼 가공' },
        { id: 'etc', label: '📦 택배/기타' },
    ];

    const currentUnit = activeTab === 'jam' ? 'kg' : '박스';

    return (
        <div className="p-4 md:p-6 pb-24 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-green-600 rounded-xl shadow-lg shadow-green-200">
                    <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">판매/출하 관리</h1>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sales & Shipping</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* 탭 */}
                <div className="flex bg-white rounded-2xl border border-gray-100 shadow-sm p-1">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all
                                ${activeTab === tab.id
                                    ? 'bg-green-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-3xl border border-green-100 shadow-xl p-6 space-y-5 relative overflow-hidden">
                    {/* 날짜 선택 */}
                    <div className="flex justify-end">
                        <div className="relative">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-green-100 outline-none text-gray-700 transition-all"
                            />
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">
                                {currentUnit} 수량 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="0"
                                    className="w-full text-2xl font-black p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-green-50 outline-none transition-all text-gray-900 placeholder-gray-300" />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{currentUnit}</span>
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">
                                판매 금액 (선택)
                            </label>
                            <div className="relative">
                                <input type="text" value={price ? `${Number(price).toLocaleString()}원` : ""}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^\d]/g, '');
                                        setPrice(val);
                                    }}
                                    placeholder="0원"
                                    className="w-full text-lg font-bold p-4 pl-10 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-green-50 outline-none transition-all text-gray-900 placeholder-gray-300" />
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">거래처/주문자 (선택)</label>
                            <div className="relative">
                                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder={activeTab === 'nonghyup' ? "농협지점명" : "이름 입력"}
                                    className="w-full p-4 pl-10 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-green-50 outline-none transition-all text-sm font-bold placeholder-gray-300" />
                                <UserSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">배송지/비고 (선택)</label>
                            <div className="relative">
                                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                                    placeholder="주소 또는 메모"
                                    className="w-full p-4 pl-10 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-green-50 outline-none transition-all text-sm font-bold placeholder-gray-300" />
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    {activeTab === 'nonghyup' && !price && (
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-2">
                            <Truck className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-blue-600 font-bold leading-tight">
                                농협 정산 금액을 아직 모르시면 비워두셔도 됩니다. 나중에 '수정' 버튼을 눌러 입력하세요.
                            </p>
                        </div>
                    )}

                    <button onClick={handleSave} disabled={saving}
                        className="w-full h-16 bg-green-600 text-white rounded-2xl text-lg font-bold shadow-xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        <Save className="w-5 h-5" />
                        {saving ? '저장 중...' : '기록 저장하기'}
                    </button>
                </div>

                {/* 최근 내역 섹션 */}
                <section className="pt-4">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="text-sm font-bold text-gray-500 flex items-center gap-2 uppercase tracking-wide">
                            <History className="w-4 h-4" />
                            Recent History
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                <div className="w-8 h-8 border-4 border-green-50 border-t-green-600 rounded-full animate-spin"></div>
                                <p className="text-gray-400 font-bold text-xs">로딩 중...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 text-gray-300 text-xs font-bold">
                                아직 등록된 판매 내역이 없습니다.
                            </div>
                        ) : (
                            history.map((item) => {
                                const isEditing = editingId === item.id;
                                const info = typeInfo(item.sale_type);

                                if (isEditing) {
                                    return (
                                        <div key={item.id} className="bg-white rounded-2xl border-2 border-green-200 p-5 shadow-xl animate-in zoom-in-95 space-y-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <Edit2 className="w-3.5 h-3.5 text-green-500" />
                                                    <span className="text-[10px] font-bold text-green-600 uppercase">수정 모드</span>
                                                </div>
                                                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold outline-none" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 ml-1">구분</label>
                                                    <select value={editType} onChange={(e) => setEditType(e.target.value as any)}
                                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-green-300">
                                                        <option value="nonghyup">농협 출하</option>
                                                        <option value="jam">잼 가공</option>
                                                        <option value="etc">택배/기타</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 ml-1">수량 ({editType === 'jam' ? 'kg' : '박스'})</label>
                                                    <input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)}
                                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-green-300" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 ml-1">금액</label>
                                                    <input type="text" value={editPrice ? `${Number(editPrice).toLocaleString()}원` : ""}
                                                        onChange={(e) => setEditPrice(e.target.value.replace(/[^\d]/g, ''))}
                                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-green-300" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 ml-1">거래처/이름</label>
                                                    <input type="text" value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)}
                                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-green-300" />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-400 ml-1">주소/비고</label>
                                                <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-green-300" />
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                <button onClick={handleUpdate} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-lg">
                                                    <Check className="w-4 h-4" /> 저장
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="px-5 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs hover:bg-gray-200">
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.id} className="bg-white rounded-2xl border p-4 shadow-sm flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-300 hover:shadow-md hover:border-gray-200 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${info.color} border shadow-inner shrink-0`}>
                                                <info.icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-bold text-gray-900">{info.label}</span>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded-md">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="text-xs text-gray-600 font-bold flex items-center gap-1.5">
                                                        <span className="text-gray-900 text-sm">{item.quantity}{info.unit}</span>
                                                        {item.price && <span className="text-green-600 bg-green-50 px-1.5 rounded-md">₩ {item.price.toLocaleString()}</span>}
                                                    </div>
                                                    {(item.customer_name || item.address) && (
                                                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium mt-0.5">
                                                            {item.customer_name && <span className="flex items-center gap-1"><UserSquare className="w-3 h-3" />{item.customer_name}</span>}
                                                            {item.address && <span className="flex items-center gap-1 border-l border-gray-200 pl-2"><MapPin className="w-3 h-3" />{item.address}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEdit(item)} className="p-2.5 text-gray-300 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all active:scale-90">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
