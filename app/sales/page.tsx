"use client";

import { useState, useEffect } from "react";
import { Save, TrendingUp, History, Clock, Trash2, ShoppingCart, Truck, Utensils, Edit2, X, Check, MapPin, UserSquare } from "lucide-react";
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
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editType, setEditType] = useState<'nonghyup' | 'jam' | 'etc'>('nonghyup');
    const [editQuantity, setEditQuantity] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [editCustomer, setEditCustomer] = useState("");
    const [editAddress, setEditAddress] = useState("");

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
        const { error } = await supabase.from('sales_records').insert({
            farm_id: farm.id,
            sale_type: activeTab,
            quantity: parseFloat(quantity),
            price: price ? parseInt(price) : null,
            customer_name: customerName || null,
            address: address || null,
        });
        if (error) { alert(`저장 실패: ${error.message}`); }
        else {
            alert(`✅ 저장 완료!`);
            setQuantity(""); setPrice(""); setCustomerName(""); setAddress("");
            fetchHistory(); // 목록 갱신
        }
        setSaving(false);
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        setSaving(true);
        const { error } = await supabase.from('sales_records').update({
            sale_type: editType,
            quantity: parseFloat(editQuantity),
            price: editPrice ? parseInt(editPrice) : null,
            customer_name: editCustomer || null,
            address: editAddress || null,
        }).eq('id', editingId);

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
    };

    const typeInfo = (type: string) => {
        switch (type) {
            case 'nonghyup': return { label: '농협 출하', icon: Truck, color: 'text-green-600 bg-green-50' };
            case 'jam': return { label: '잼 가공', icon: Utensils, color: 'text-purple-600 bg-purple-50' };
            default: return { label: '택배/기타', icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' };
        }
    };

    const tabs = [
        { id: 'nonghyup', label: '🌾 농협 출하' },
        { id: 'jam', label: '🍯 잼 가공' },
        { id: 'etc', label: '📦 택배/기타' },
    ];

    return (
        <div className="p-4 md:p-6 pb-32 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-2xl shadow-sm">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">판매/출하 기록</h1>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Sales & Shipping</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* 탭 */}
                <div className="flex bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-50 p-1.5">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-4 rounded-[1.25rem] text-sm font-black transition-all
                                ${activeTab === tab.id
                                    ? 'bg-green-600 text-white shadow-lg shadow-green-100 scale-[1.02]'
                                    : 'text-gray-400 hover:text-gray-600'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-50 p-8 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>

                    <div className="relative">
                        <label className="block text-sm font-bold text-gray-400 mb-2 ml-1">
                            {activeTab === 'jam' ? '중량 (kg)' : '수량 (박스)'}
                        </label>
                        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                            placeholder="0"
                            className="w-full text-4xl font-black p-5 bg-gray-50 border-transparent rounded-[1.5rem] focus:bg-white focus:border-green-200 focus:ring-4 focus:ring-green-50 outline-none transition-all text-gray-900" />
                    </div>

                    {activeTab === 'etc' && (
                        <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2 ml-1">주문자 이름</label>
                                    <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="홍길동"
                                        className="w-full p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-green-200 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2 ml-1">판매 금액</label>
                                    <input type="text" value={price ? `${Number(price).toLocaleString()}원` : ""}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^\d]/g, '');
                                            setPrice(val);
                                        }}
                                        placeholder="0원"
                                        className="w-full p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-green-200 outline-none transition-all font-bold" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2 ml-1">배송지 주소</label>
                                <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                                    placeholder="정확한 주소 입력"
                                    className="w-full p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-green-200 outline-none h-24 resize-none transition-all" />
                            </div>
                        </div>
                    )}

                    {activeTab === 'nonghyup' && (
                        <div className="bg-blue-50/50 p-4 rounded-2xl text-[10px] text-blue-600 font-bold border border-blue-100 flex items-center gap-3">
                            <Truck className="w-4 h-4" />
                            <span>💡 농협 정산 금액은 추후 정산서 확인 후 입력하세요.</span>
                        </div>
                    )}

                    <button onClick={handleSave} disabled={saving}
                        className="w-full h-20 bg-green-600 text-white rounded-[2rem] text-xl font-black shadow-xl shadow-green-100 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                        <Save className="w-6 h-6" />
                        {saving ? '기록 중...' : (activeTab === 'etc' ? '주문 접수하기' : '출하 완료하기')}
                    </button>
                </div>

                {/* 최근 내역 섹션 */}
                <section className="pt-8">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <History className="w-5 h-5 text-gray-400" />
                            최근 판매/출하 내역
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-10 text-gray-300 animate-pulse">데이터 로딩 중...</div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 text-gray-300 text-sm font-medium">
                                아직 등록된 판매 내역이 없습니다.
                            </div>
                        ) : (
                            history.map((item) => {
                                const isEditing = editingId === item.id;
                                const info = typeInfo(item.sale_type);

                                if (isEditing) {
                                    return (
                                        <div key={item.id} className="bg-white rounded-[2rem] border-2 border-green-200 p-6 shadow-xl animate-in zoom-in-95 space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Edit2 className="w-4 h-4 text-green-500" />
                                                <span className="text-xs font-black text-green-600 uppercase">판매 기록 수정</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-gray-400">구분</label>
                                                    <select value={editType} onChange={(e) => setEditType(e.target.value as any)}
                                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none">
                                                        <option value="nonghyup">농협 출하</option>
                                                        <option value="jam">잼 가공</option>
                                                        <option value="etc">택배/기타</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-gray-400">수량 ({editType === 'jam' ? 'kg' : '박스'})</label>
                                                    <input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)}
                                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-gray-400">금액</label>
                                                    <input type="text" value={editPrice ? `${Number(editPrice).toLocaleString()}원` : ""}
                                                        onChange={(e) => setEditPrice(e.target.value.replace(/[^\d]/g, ''))}
                                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-gray-400">주문자</label>
                                                    <input type="text" value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)}
                                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400">주소</label>
                                                <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" />
                                            </div>

                                            <div className="flex gap-2">
                                                <button onClick={handleUpdate} className="flex-1 bg-gray-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                                                    <Check className="w-5 h-5" /> 수정 완료
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                                                    <X className="w-5 h-5" /> 취소
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.id} className="bg-white rounded-[1.5rem] border border-gray-100 p-5 shadow-sm flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${info.color} border shadow-sm`}>
                                                <info.icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-black text-gray-900">{info.label}</span>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="text-sm text-gray-500 font-bold">
                                                        {item.quantity} {item.sale_type === 'jam' ? 'kg' : '박스'}
                                                        {item.price && <span className="text-green-600 ml-1.5">· {item.price.toLocaleString()}원</span>}
                                                    </div>
                                                    {(item.customer_name || item.address) && (
                                                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                                                            {item.customer_name && <span className="flex items-center gap-1"><UserSquare className="w-2.5 h-2.5" />{item.customer_name}</span>}
                                                            {item.address && <span className="flex items-center gap-1 border-l border-gray-100 pl-2"><MapPin className="w-2.5 h-2.5" />{item.address}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEdit(item)} className="p-3 text-gray-300 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all">
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-3 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                                <Trash2 className="w-5 h-5" />
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
