"use client";

import { useState, useEffect } from "react";
import { Users, Building2, Search, Plus, MapPin, Phone, Edit, Trash2, Star, Mail, Printer, CreditCard, NotebookText, Copy } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Partner, Customer } from "@/lib/supabase";
import { formatPhone, formatCurrency, stripNonDigits, formatBusinessNumber } from "@/lib/utils";
import NavBar from "@/components/NavBar";
import AddressSearch from "@/components/AddressSearch";

export default function ClientsPage() {
    const { farm, initialized } = useAuthStore();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'business' | 'individual'>('business');
    const [searchTerm, setSearchTerm] = useState("");

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partner | Customer | null>(null);

    // B2B 폼 데이터
    const [partnerFormData, setPartnerFormData] = useState<Partial<Partner>>({
        id: "",
        company_name: "",
        business_number: "",
        ceo_name: "",
        company_contact: "",
        manager_name: "",
        manager_contact: "",
        manager_email: "",
        fax_number: "",
        hq_address: "",
        hq_postal_code: "",
        hq_latitude: null,
        hq_longitude: null,
        delivery_address: "",
        delivery_postal_code: "",
        delivery_latitude: null,
        delivery_longitude: null,
        settlement_type: "후결제",
        payment_method: "계좌이체",
        special_notes: ""
    });

    // B2C 폼 데이터
    const [customerFormData, setCustomerFormData] = useState<Partial<Customer>>({
        id: "",
        name: "",
        contact: "",
        address: "",
        postal_code: "",
        latitude: null,
        longitude: null,
        is_vip: false,
        special_notes: ""
    });

    useEffect(() => {
        if (initialized && farm) {
            fetchData();
        }
    }, [farm, initialized]);

    // 탭 전환 시 검색어 초기화 (사장님 요청 사항)
    useEffect(() => {
        setSearchTerm("");
    }, [activeTab]);

    const fetchData = async () => {
        if (!farm?.id) return;
        setLoading(true);

        try {
            const [partnersRes, customersRes] = await Promise.all([
                supabase.from('partners').select('*').eq('farm_id', farm.id).order('company_name'),
                supabase.from('customers').select('*').eq('farm_id', farm.id).order('is_vip', { ascending: false }).order('name')
            ]);

            if (partnersRes.data) setPartners(partnersRes.data);
            if (customersRes.data) setCustomers(customersRes.data);
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item?: Partner | Customer) => {
        if (item) {
            setEditingItem(item);
            if ('company_name' in item) {
                setPartnerFormData({ ...item });
                setActiveTab('business');
            } else {
                setCustomerFormData({ ...item });
                setActiveTab('individual');
            }
        } else {
            setEditingItem(null);
            setPartnerFormData({
                id: "", company_name: "", business_number: "", ceo_name: "", company_contact: "", manager_name: "", manager_contact: "",
                manager_email: "", fax_number: "",
                hq_address: "", hq_postal_code: "", hq_latitude: null, hq_longitude: null,
                delivery_address: "", delivery_postal_code: "", delivery_latitude: null, delivery_longitude: null,
                settlement_type: "후결제", payment_method: "계좌이체", special_notes: ""
            });
            setCustomerFormData({
                id: "", name: "", contact: "", address: "",
                postal_code: "", latitude: null, longitude: null,
                is_vip: false, special_notes: ""
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!farm?.id) return;

        try {
            if (activeTab === 'business') {
                const data = {
                    farm_id: farm.id,
                    company_name: partnerFormData.company_name,
                    business_number: partnerFormData.business_number || null,
                    ceo_name: partnerFormData.ceo_name || null,
                    company_contact: partnerFormData.company_contact || null,
                    manager_name: partnerFormData.manager_name || null,
                    manager_contact: partnerFormData.manager_contact || null,
                    manager_email: partnerFormData.manager_email || null,
                    fax_number: partnerFormData.fax_number || null,
                    hq_address: partnerFormData.hq_address || null,
                    hq_postal_code: partnerFormData.hq_postal_code || null,
                    hq_latitude: partnerFormData.hq_latitude || null,
                    hq_longitude: partnerFormData.hq_longitude || null,
                    delivery_address: partnerFormData.delivery_address || null,
                    delivery_postal_code: partnerFormData.delivery_postal_code || null,
                    delivery_latitude: partnerFormData.delivery_latitude || null,
                    delivery_longitude: partnerFormData.delivery_longitude || null,
                    settlement_type: partnerFormData.settlement_type || '후결제',
                    payment_method: partnerFormData.payment_method || '계좌이체',
                    special_notes: partnerFormData.special_notes || null
                };

                const partnerId = partnerFormData.id || (editingItem && 'id' in editingItem ? editingItem.id : null);

                if (partnerId && partnerId !== "") {
                    const { error } = await supabase.from('partners').update(data).eq('id', partnerId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('partners').insert([data]);
                    if (error) throw error;
                }
            } else {
                if (!customerFormData.name) {
                    alert("고객명을 입력해주세요.");
                    return;
                }

                const data = {
                    farm_id: farm.id,
                    name: customerFormData.name,
                    contact: customerFormData.contact || null,
                    address: customerFormData.address || null,
                    postal_code: customerFormData.postal_code || null,
                    latitude: customerFormData.latitude || null,
                    longitude: customerFormData.longitude || null,
                    is_vip: customerFormData.is_vip || false,
                    special_notes: customerFormData.special_notes || null
                };

                const customerId = customerFormData.id || (editingItem && 'id' in editingItem ? editingItem.id : null);

                if (customerId && customerId !== "") {
                    const { error } = await supabase.from('customers').update(data).eq('id', customerId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('customers').insert([data]);
                    if (error) throw error;
                }
            }

            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            console.error("Save error detail:", error);
            alert(`저장 실패: ${error.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("정말 삭제하시겠습니까? 연결된 모든 판매 내역이 함께 삭제됩니다.")) return;
        const table = activeTab === 'business' ? 'partners' : 'customers';
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) alert(`삭제 실패: ${error.message}`);
        else fetchData();
    };

    const filteredPartners = partners.filter(p =>
        p.company_name.includes(searchTerm) ||
        (p.manager_contact && p.manager_contact.includes(searchTerm))
    );

    const filteredCustomers = customers.filter(c =>
        c.name.includes(searchTerm) ||
        (c.contact && c.contact.includes(searchTerm))
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <NavBar />

            <div className="p-4 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 leading-tight">거래처/고객 관리</h1>
                        <p className="text-xs text-indigo-600 font-bold mt-1 uppercase tracking-widest flex items-center gap-1">
                            <Star className="w-3 h-3 fill-indigo-600" /> B2B Partner & B2C Customer
                        </p>
                    </div>
                    <button onClick={() => handleOpenModal()}
                        className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
                        <Plus className="w-6 h-6" />
                    </button>
                </div>

                {/* 탭 전환 */}
                <div className="flex bg-white rounded-2x border border-gray-100 shadow-sm p-1.5 rounded-[1.25rem]">
                    <button onClick={() => setActiveTab('business')}
                        className={`flex-1 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2
                        ${activeTab === 'business' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
                        <Building2 className="w-4 h-4" /> B2B 거래처
                    </button>
                    <button onClick={() => setActiveTab('individual')}
                        className={`flex-1 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2
                        ${activeTab === 'individual' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
                        <Users className="w-4 h-4" /> B2C 개인고객
                    </button>
                </div>

                {/* 검색바 */}
                <div className="relative group">
                    <input type="text" placeholder={activeTab === 'business' ? "상호명, 연락처 검색..." : "고객명, 연락처 검색..."}
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 text-sm font-bold shadow-sm transition-all" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                </div>

                {/* 리스트 영역 */}
                {loading ? (
                    <div className="text-center py-20 text-gray-400 font-bold animate-pulse">데이터를 불러오고 있습니다...</div>
                ) : (
                    <div className="space-y-4">
                        {activeTab === 'business' ? (
                            filteredPartners.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-gray-300 font-black">등록된 거래처가 없습니다.</div>
                            ) : (
                                filteredPartners.map(partner => (
                                    <div key={partner.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 opacity-20 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
                                        <div className="flex items-start justify-between relative z-10">
                                            <div className="flex items-start gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner">
                                                    <Building2 className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <h3 className="text-xl font-black text-gray-900">{partner.company_name}</h3>
                                                        <span className="text-[11px] font-black bg-rose-100 text-rose-700 px-2 py-1 rounded-lg uppercase tracking-wider border border-rose-200">{partner.settlement_type}</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-sm text-gray-500 font-bold flex items-center gap-1.5">
                                                            <Phone className="w-4 h-4" /> {partner.manager_contact ? formatPhone(partner.manager_contact) : '없음'}
                                                            <span className="text-gray-300 mx-1">|</span>
                                                            <Users className="w-4 h-4 text-gray-400" /> {partner.manager_name || '담당자미정'}
                                                        </p>
                                                        {partner.delivery_address && (
                                                            <p className="text-xs text-gray-400 font-medium flex items-start gap-1.5 max-w-xs leading-relaxed">
                                                                <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> <span className="line-clamp-2">{partner.delivery_address}</span>
                                                            </p>
                                                        )}
                                                        {partner.special_notes && (
                                                            <div className="mt-3 p-4 bg-gray-50 rounded-2xl relative">
                                                                <NotebookText className="w-4 h-4 text-gray-300 absolute top-3 right-3" />
                                                                <p className="text-xs text-gray-600 font-medium leading-relaxed italic line-clamp-2">“{partner.special_notes}”</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => handleOpenModal(partner)} className="p-2.5 bg-gray-50 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(partner.id)} className="p-2.5 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )
                        ) : (
                            filteredCustomers.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-gray-300 font-black">등록된 개인 고객이 없습니다.</div>
                            ) : (
                                filteredCustomers.map(customer => (
                                    <div key={customer.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0 shadow-inner">
                                                    <Users className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <h3 className="text-xl font-black text-gray-900">{customer.name}</h3>
                                                        {customer.is_vip && <span className="text-xs font-black bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-yellow-700" /> 단골</span>}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-sm text-gray-500 font-bold flex items-center gap-1.5">
                                                            <Phone className="w-4 h-4" /> {customer.contact ? formatPhone(customer.contact) : '없음'}
                                                        </p>
                                                        {customer.address && (
                                                            <p className="text-xs text-gray-400 font-medium flex items-start gap-1.5 max-w-xs leading-relaxed">
                                                                <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> <span className="line-clamp-2">{customer.address}</span>
                                                            </p>
                                                        )}
                                                        {customer.special_notes && (
                                                            <div className="mt-3 p-4 bg-gray-50 rounded-2xl">
                                                                <p className="text-xs text-gray-600 font-medium italic line-clamp-1">“{customer.special_notes}”</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => handleOpenModal(customer)} className="p-2.5 bg-gray-50 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded-xl transition-all"><Edit className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(customer.id)} className="p-2.5 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                )}
            </div>

            {/* 모달 UI */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 leading-tight">
                                    {activeTab === 'business' ? 'B2B 파트너' : '개인 고객'} {editingItem ? '수정' : '등록'}
                                </h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Management Profile</p>
                            </div>
                            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner ${activeTab === 'business' ? 'bg-indigo-50 text-indigo-500' : 'bg-green-50 text-green-500'}`}>
                                {activeTab === 'business' ? <Building2 className="w-8 h-8" /> : <Users className="w-8 h-8" />}
                            </div>
                        </div>

                        <div className="space-y-5">
                            {activeTab === 'business' ? (
                                <div className="grid grid-cols-1 gap-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">상호명 (필수)</label>
                                            <input type="text" value={partnerFormData.company_name} onChange={(e) => setPartnerFormData({ ...partnerFormData, company_name: e.target.value })}
                                                placeholder="예: 논산농협" className="w-full p-5 bg-white border-2 border-gray-200 rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-gray-300 shadow-sm" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">사업자번호</label>
                                            <input type="text" value={partnerFormData.business_number || ""} onChange={(e) => setPartnerFormData({ ...partnerFormData, business_number: e.target.value })}
                                                placeholder="000-00-00000" className="w-full p-5 bg-white border-2 border-gray-200 rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-gray-300 shadow-sm" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">대표자명</label>
                                            <input type="text" value={partnerFormData.ceo_name || ""} onChange={(e) => setPartnerFormData({ ...partnerFormData, ceo_name: e.target.value })}
                                                placeholder="성함 입력" className="w-full p-5 bg-white border-2 border-gray-200 rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-gray-300 shadow-sm" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">본사 대표번호</label>
                                            <input type="text" value={partnerFormData.company_contact || ""} onChange={(e) => setPartnerFormData({ ...partnerFormData, company_contact: formatPhone(e.target.value) })}
                                                placeholder="041-000-0000" className="w-full p-5 bg-white border-2 border-gray-200 rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-gray-300 shadow-sm" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">담당자 성함</label>
                                            <input type="text" value={partnerFormData.manager_name || ""} onChange={(e) => setPartnerFormData({ ...partnerFormData, manager_name: e.target.value })}
                                                className="w-full p-5 bg-white border-2 border-gray-200 shadow-sm rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-600 outline-none transition-all" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">담당자 연락처</label>
                                            <input type="text" value={partnerFormData.manager_contact || ""} onChange={(e) => setPartnerFormData({ ...partnerFormData, manager_contact: formatPhone(e.target.value) })}
                                                placeholder="010-0000-0000" className="w-full p-5 bg-white border-2 border-gray-200 shadow-sm rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-gray-300" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1 flex items-center gap-1"><Printer className="w-4 h-4" /> 팩스</label>
                                            <input type="text" value={partnerFormData.fax_number || ""} onChange={(e) => setPartnerFormData({ ...partnerFormData, fax_number: formatPhone(e.target.value) })}
                                                placeholder="041-000-0000" className="w-full p-5 bg-white border-2 border-gray-200 shadow-sm rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-gray-300" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-rose-600 uppercase tracking-tight ml-1 flex items-center gap-1"><CreditCard className="w-4 h-4" /> 정산 방식 (중요)</label>
                                            <select value={partnerFormData.settlement_type} onChange={(e) => setPartnerFormData({ ...partnerFormData, settlement_type: e.target.value })}
                                                className="w-full p-5 bg-rose-50/30 border-2 border-rose-200 shadow-sm rounded-[1.25rem] text-base font-black focus:bg-white focus:border-rose-500 text-rose-900 outline-none transition-all appearance-none"
                                            >
                                                <option value="후결제">후결제 (정상)</option>
                                                <option value="선입금">선입금</option>
                                                <option value="월마감">월 단위 마감</option>
                                                <option value="카드선결제">카드 선결제</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1 flex items-center gap-1"><Mail className="w-4 h-4" /> 이메일 (세금계산서용)</label>
                                        <input type="email" value={partnerFormData.manager_email || ""} onChange={(e) => setPartnerFormData({ ...partnerFormData, manager_email: e.target.value })}
                                            className="w-full p-5 bg-white border-2 border-gray-200 shadow-sm rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-600 outline-none transition-all" />
                                    </div>

                                    <div className="grid grid-cols-12 gap-3 items-end">
                                        <div className="col-span-9">
                                            <AddressSearch
                                                label="본사 주소"
                                                value={partnerFormData.hq_address || ""}
                                                onChange={(val) => setPartnerFormData({ ...partnerFormData, hq_address: val })}
                                                onAddressSelect={(res) => setPartnerFormData({
                                                    ...partnerFormData,
                                                    hq_address: res.address,
                                                    hq_postal_code: res.zonecode
                                                })}
                                                placeholder="본사 사무실 주소 검색"
                                            />
                                        </div>
                                        <div className="col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight ml-1">우편번호</label>
                                            <input type="text" value={partnerFormData.hq_postal_code || ""}
                                                onChange={(e) => setPartnerFormData({ ...partnerFormData, hq_postal_code: e.target.value })}
                                                className="w-full py-5 px-1 bg-gray-50 border-2 border-transparent rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-200 outline-none text-center" placeholder="00000" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-12 gap-3 items-end">
                                        <div className="col-span-9">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">납품 주소</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setPartnerFormData({
                                                        ...partnerFormData,
                                                        delivery_address: partnerFormData.hq_address,
                                                        delivery_postal_code: partnerFormData.hq_postal_code
                                                    })}
                                                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 transition-all"
                                                >
                                                    <Copy className="w-3 h-3" /> 본사 동일
                                                </button>
                                            </div>
                                            <AddressSearch
                                                label=""
                                                value={partnerFormData.delivery_address || ""}
                                                onChange={(val) => setPartnerFormData({ ...partnerFormData, delivery_address: val })}
                                                onAddressSelect={(res) => setPartnerFormData({
                                                    ...partnerFormData,
                                                    delivery_address: res.address,
                                                    delivery_postal_code: res.zonecode
                                                })}
                                                placeholder="딸기 납품 하차지 주소 검색"
                                            />
                                        </div>
                                        <div className="col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight ml-1">우편번호</label>
                                            <input type="text" value={partnerFormData.delivery_postal_code || ""}
                                                onChange={(e) => setPartnerFormData({ ...partnerFormData, delivery_postal_code: e.target.value })}
                                                className="w-full py-5 px-1 bg-gray-50 border-2 border-transparent rounded-[1.25rem] text-base font-black focus:bg-white focus:border-indigo-200 outline-none text-center" placeholder="00000" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">거래처 특이사항 (메모)</label>
                                        <textarea value={partnerFormData.special_notes || ""} onChange={(e) => setPartnerFormData({ ...partnerFormData, special_notes: e.target.value })}
                                            placeholder="주거래 품목, 시간 엄수 사항 등..."
                                            className="w-full p-5 bg-gray-100/50 border-2 border-transparent rounded-[2rem] text-sm font-medium focus:bg-white focus:border-indigo-600 outline-none transition-all h-36 resize-none shadow-inner" />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">고객 성함 (필수)</label>
                                        <input type="text" value={customerFormData.name} onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                                            placeholder="예: 김철수" className="w-full p-5 bg-white border-2 border-gray-200 shadow-sm rounded-[1.25rem] text-base font-black focus:bg-white focus:border-green-600 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">연락처</label>
                                        <input type="text" value={customerFormData.contact || ""} onChange={(e) => setCustomerFormData({ ...customerFormData, contact: formatPhone(e.target.value) })}
                                            placeholder="010-0000-0000" className="w-full p-5 bg-white border-2 border-gray-200 shadow-sm rounded-[1.25rem] text-base font-black focus:bg-white focus:border-green-600 outline-none transition-all" />
                                    </div>
                                    <div className="grid grid-cols-12 gap-3 items-end">
                                        <div className="col-span-9">
                                            <AddressSearch
                                                label="배송지 주소"
                                                value={customerFormData.address || ""}
                                                onChange={(val) => setCustomerFormData({ ...customerFormData, address: val })}
                                                onAddressSelect={(res) => setCustomerFormData({
                                                    ...customerFormData,
                                                    address: res.address,
                                                    postal_code: res.zonecode
                                                })}
                                                placeholder="상세 배송지 주소 검색"
                                            />
                                        </div>
                                        <div className="col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight ml-1">우편번호</label>
                                            <input type="text" value={customerFormData.postal_code || ""}
                                                onChange={(e) => setCustomerFormData({ ...customerFormData, postal_code: e.target.value })}
                                                className="w-full py-5 px-1 bg-gray-50 border-2 border-transparent rounded-[1.25rem] text-base font-black focus:bg-white focus:border-green-200 outline-none text-center" placeholder="00000" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-[1.25rem] group cursor-pointer" onClick={() => setCustomerFormData({ ...customerFormData, is_vip: !customerFormData.is_vip })}>
                                        <input type="checkbox" checked={customerFormData.is_vip || false} onChange={() => { }}
                                            className="w-7 h-7 rounded-xl text-green-600 focus:ring-green-500 border-gray-200 shadow-sm transition-all" />
                                        <span className="text-base font-black text-gray-600 tracking-tight">단골 VIP 지정 (특별 관리 대상)</span>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-tight ml-1">고객 특이사항 (메모)</label>
                                        <textarea value={customerFormData.special_notes || ""} onChange={(e) => setCustomerFormData({ ...customerFormData, special_notes: e.target.value })}
                                            placeholder="선호하는 딸기 크기, 배송 요청 등..."
                                            className="w-full p-5 bg-gray-100/50 border-2 border-transparent rounded-[2.5rem] text-sm font-medium focus:bg-white focus:border-green-600 outline-none transition-all h-36 resize-none shadow-inner" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-4.5 bg-gray-50 text-gray-400 rounded-3xl font-black text-sm hover:bg-gray-100 transition-all border border-gray-100/50">
                                취소
                            </button>
                            <button onClick={handleSave}
                                className={`flex-[2] py-4.5 text-white rounded-3xl font-black text-sm shadow-2xl transition-all active:scale-95 ${activeTab === 'business' ? 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700' : 'bg-green-600 shadow-green-200 hover:bg-green-700'}`}>
                                정보 안전하게 저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
