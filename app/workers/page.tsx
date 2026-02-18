"use client";

import { useState, useEffect, useRef } from "react";
import {
    Plus, Trash2, UserPlus, Phone, UserCheck, UserX,
    Edit2, Save, X, Users, Heart, Globe, Timer, MapPin, AlignLeft, Check, RefreshCcw, AlertTriangle, User
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Worker } from "@/lib/supabase";

export default function WorkersPage() {
    const { farm, initialized } = useAuthStore();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // New Worker State
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newRole, setNewRole] = useState<'family' | 'staff' | 'foreign' | 'part_time'>('family');
    const [newPhone, setNewPhone] = useState("");
    const [newGender, setNewGender] = useState<'male' | 'female'>('male');
    const [newAddress, setNewAddress] = useState("");
    const [newNotes, setNewNotes] = useState("");

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editRole, setEditRole] = useState<'family' | 'staff' | 'foreign' | 'part_time'>('family');
    const [editPhone, setEditPhone] = useState("");
    const [editGender, setEditGender] = useState<'male' | 'female'>('male');
    const [editAddress, setEditAddress] = useState("");
    const [editNotes, setEditNotes] = useState("");

    useEffect(() => {
        if (initialized) {
            if (farm) {
                fetchWorkers();
            } else {
                setLoading(false);
                setErrorMsg("농장 정보를 불러올 수 없습니다. 다시 로그인해 주세요.");
            }
        }
    }, [farm, initialized]);

    const fetchWorkers = async () => {
        if (!farm?.id) return;
        setLoading(true);
        setErrorMsg(null);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (loading) {
                setLoading(false);
                setErrorMsg("서버 응답이 지연되고 있습니다. 인터넷 연결을 확인하거나 새로고침 해주세요.");
            }
        }, 8000);

        try {
            console.log("[Worker] Fetching workers for farm:", farm.id);
            const { data, error } = await supabase.from('workers').select('*')
                .eq('farm_id', farm.id).order('name', { ascending: true });

            if (error) {
                console.error("[Worker] Fetch Error:", error);
                setErrorMsg(`데이터 로딩 실패: [${error.code}] ${error.message}`);
                setWorkers([]);
            } else {
                setWorkers(data ?? []);
                setErrorMsg(null);
            }
        } catch (err: any) {
            console.error("[Worker] System Error:", err);
            setErrorMsg(`시스템 연결 오류: ${err.message || '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
    };

    const formatPhoneNumber = (value: string) => {
        const numbers = value.replace(/[^\d]/g, '');
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    };

    const handleAddWorker = async () => {
        if (!newName || !farm?.id) {
            alert("이름을 입력해주세요.");
            return;
        }
        const { error } = await supabase.from('workers').insert({
            farm_id: farm.id,
            name: newName,
            role: newRole,
            phone: newPhone,
            gender: newGender,
            address: newAddress,
            notes: newNotes,
            is_active: true
        });
        if (error) {
            console.error(error);
            alert(`추가 실패: ${error.message}`);
        } else {
            setNewName("");
            setNewPhone("");
            setNewAddress("");
            setNewNotes("");
            setNewGender('male');
            setIsAdding(false);
            fetchWorkers();
        }
    };

    const startEdit = (worker: Worker) => {
        setEditingId(worker.id);
        setEditName(worker.name);
        setEditRole(worker.role as any);
        setEditPhone(worker.phone || "");
        setEditGender(worker.gender || 'male');
        setEditAddress(worker.address || "");
        setEditNotes(worker.notes || "");
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const handleUpdateWorker = async () => {
        if (!editingId || !editName) return;
        const { error } = await supabase.from('workers').update({
            name: editName,
            role: editRole,
            phone: editPhone,
            gender: editGender,
            address: editAddress,
            notes: editNotes
        }).eq('id', editingId);

        if (error) alert("수정 실패: " + error.message);
        else {
            setEditingId(null);
            fetchWorkers();
        }
    };

    const toggleWorkerStatus = async (id: string, isActive: boolean) => {
        await supabase.from('workers').update({ is_active: !isActive }).eq('id', id);
        fetchWorkers();
    };

    const deleteWorker = async (id: string) => {
        if (!confirm("정말 이 근로자를 삭제하겠습니까?\n과거 기록 데이터는 유지되지만 목록에서는 제거됩니다.")) return;
        const { error } = await supabase.from('workers').delete().eq('id', id);
        if (error) alert("삭제 실패: " + error.message);
        else fetchWorkers();
    };

    const roleInfo = {
        family: { label: "가족/식구", icon: Heart, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
        staff: { label: "일반직원", icon: UserCheck, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
        foreign: { label: "외국인", icon: Globe, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
        part_time: { label: "아르바이트", icon: Timer, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" }
    };

    const renderWorkerCard = (worker: Worker) => {
        const isEditing = editingId === worker.id;
        const info = roleInfo[worker.role as keyof typeof roleInfo] || roleInfo.part_time;

        if (isEditing) {
            return (
                <div key={worker.id} className="bg-white rounded-[2.5rem] border-2 border-red-200 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Edit2 className="w-5 h-5 text-red-500" />
                        <span className="text-lg font-black text-red-600">근로원 상세 정보 수정</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">Name</label>
                            <input value={editName} onChange={(e) => setEditName(e.target.value)}
                                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none font-bold text-xl" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">Phone</label>
                            <input value={editPhone} onChange={(e) => setEditPhone(formatPhoneNumber(e.target.value))}
                                placeholder="010-0000-0000"
                                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none font-bold text-xl" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">Role</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(['family', 'staff', 'foreign', 'part_time'] as const).map(r => (
                                    <button key={r} onClick={() => setEditRole(r)}
                                        className={`py-3 rounded-xl text-[10px] font-black transition-all border
                                            ${editRole === r ? 'bg-red-600 border-red-700 text-white shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>
                                        {roleInfo[r].label.split('/')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">Gender</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setEditGender('male')}
                                    className={`py-3 rounded-xl text-[10px] font-black border transition-all
                                        ${editGender === 'male' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>남성</button>
                                <button onClick={() => setEditGender('female')}
                                    className={`py-3 rounded-xl text-[10px] font-black border transition-all
                                        ${editGender === 'female' ? 'bg-rose-600 border-rose-700 text-white shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>여성</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
                            <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                                placeholder="거주지 주소"
                                className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">Notes</label>
                        <div className="relative">
                            <AlignLeft className="absolute left-4 top-4 w-5 h-5 text-gray-300" />
                            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="업무 특성, 건강 상태 등 특이사항"
                                className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none h-24 lg:h-32 resize-none" />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <button onClick={handleUpdateWorker} className="flex-1 bg-gray-900 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-gray-200">
                            <Check className="w-6 h-6" /> 정보 수정 완료
                        </button>
                        <button onClick={cancelEdit} className="px-10 py-5 bg-gray-100 text-gray-500 rounded-2xl font-black active:scale-95 transition-all">
                            취소
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div key={worker.id}
                className={`bg-white rounded-[2.5rem] border p-7 shadow-sm flex items-center justify-between group transition-all hover:shadow-2xl hover:shadow-gray-100 hover:-translate-y-1
                    ${worker.is_active ? 'border-gray-50 bg-white' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <div className="flex items-center gap-6">
                    <div className={`w-20 h-20 rounded-3xl flex flex-col items-center justify-center border relative shadow-inner ${info.bg} ${info.border}`}>
                        <info.icon className={`w-8 h-8 ${info.color}`} />
                        <span className={`text-[10px] font-black absolute bottom-1.5 ${worker.gender === 'female' ? 'text-pink-500' : 'text-blue-500'}`}>
                            {worker.gender === 'female' ? '여성' : '남성'}
                        </span>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <span className="font-black text-3xl text-gray-900 tracking-tighter">{worker.name}</span>
                            {!worker.is_active && <span className="text-[10px] font-black bg-gray-200 text-gray-500 px-3 py-1 rounded-full uppercase tracking-widest">중단</span>}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-4 text-sm font-bold">
                                <span className={`${info.color} bg-white px-3 py-1 rounded-xl border ${info.border} text-xs tracking-tight shadow-sm`}>{info.label}</span>
                                {worker.phone && <span className="text-gray-400 flex items-center gap-2 font-black tracking-tight"><Phone className="w-4 h-4" />{worker.phone}</span>}
                            </div>
                            {worker.address && <p className="text-[11px] text-gray-300 font-bold flex items-center gap-1.5 px-1"><MapPin className="w-3.5 h-3.5" />{worker.address}</p>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button onClick={() => toggleWorkerStatus(worker.id, worker.is_active)} className={`p-4 rounded-[1.5rem] transition-all active:scale-90 ${worker.is_active ? 'text-gray-300 hover:bg-gray-100 hover:text-gray-500' : 'bg-green-50 text-green-600'}`}>
                        {worker.is_active ? <UserX className="w-7 h-7" /> : <UserCheck className="w-7 h-7" />}
                    </button>
                    <button onClick={() => startEdit(worker)} className="p-4 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-[1.5rem] transition-all active:scale-90">
                        <Edit2 className="w-7 h-7" />
                    </button>
                    <button onClick={() => deleteWorker(worker.id)} className="p-4 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-[1.5rem] transition-all active:scale-90">
                        <Trash2 className="w-7 h-7" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 pb-32 max-w-3xl mx-auto space-y-10 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-red-600 rounded-[2rem] shadow-2xl shadow-red-200 rotate-3">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tighter leading-none">인력 현황 관리</h1>
                        <p className="text-xs text-gray-400 font-black uppercase tracking-[0.3em] mt-2">Worker Management</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchWorkers} className="p-5 bg-white border border-gray-100 text-gray-400 rounded-3xl hover:bg-gray-50 shadow-sm transition-all active:rotate-180">
                        <RefreshCcw className="w-6 h-6" />
                    </button>
                    <button onClick={() => setIsAdding(!isAdding)}
                        className={`px-8 py-5 rounded-3xl font-black text-base flex items-center gap-3 shadow-2xl active:scale-95 transition-all
                            ${isAdding ? 'bg-gray-100 text-gray-500' : 'bg-red-600 text-white shadow-red-200 hover:bg-red-700'}`}>
                        {isAdding ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                        {isAdding ? '닫기' : '근로자 추가'}
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-amber-50 border-2 border-amber-100 p-8 rounded-[3rem] flex items-center gap-6 animate-in slide-in-from-top-6">
                    <div className="bg-amber-200 p-4 rounded-3xl shrink-0"><AlertTriangle className="w-8 h-8 text-amber-700" /></div>
                    <div>
                        <p className="text-amber-800 font-black text-lg tracking-tight leading-tight">{errorMsg}</p>
                        <p className="text-amber-600 text-xs mt-1.5 font-bold uppercase tracking-widest">Action Required: Check Supabase RLS or execute recovery SQL.</p>
                    </div>
                </div>
            )}

            {isAdding && (
                <div className="bg-white rounded-[3.5rem] border-2 border-red-50 shadow-2xl p-10 space-y-10 animate-in slide-in-from-top-8 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-red-50 rounded-full -mr-40 -mt-40 blur-3xl opacity-30"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative">
                        <div className="space-y-3">
                            <label className="block text-xs font-black text-gray-400 ml-2 uppercase tracking-widest">Name (Required)</label>
                            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="실성함 입력"
                                className="w-full text-3xl font-black p-6 bg-gray-50 border-transparent rounded-[2rem] focus:bg-white focus:ring-8 focus:ring-red-50 outline-none transition-all tracking-tighter" />
                        </div>
                        <div className="space-y-3">
                            <label className="block text-xs font-black text-gray-400 ml-2 uppercase tracking-widest">Phone Number</label>
                            <input value={newPhone} onChange={(e) => setNewPhone(formatPhoneNumber(e.target.value))} placeholder="010-0000-0000"
                                className="w-full text-xl font-black p-6 bg-gray-50 border-transparent rounded-[2rem] focus:bg-white focus:ring-8 focus:ring-red-50 outline-none transition-all" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-4 ml-2 uppercase tracking-widest">Worker Role</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(['family', 'staff', 'foreign', 'part_time'] as const).map(r => (
                                    <button key={r} onClick={() => setNewRole(r)}
                                        className={`py-5 rounded-2xl border-2 text-[10px] font-black transition-all flex flex-col items-center gap-2
                                            ${newRole === r
                                                ? 'bg-red-600 border-red-700 text-white shadow-xl shadow-red-100 scale-105'
                                                : 'bg-white border-gray-50 text-gray-400 hover:border-red-100 shadow-sm'}`}>
                                        {roleInfo[r].label.split('/')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-4 ml-2 uppercase tracking-widest">Gender</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setNewGender('male')}
                                    className={`py-5 rounded-3xl border-2 text-sm font-black transition-all
                                        ${newGender === 'male' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl shadow-indigo-100 scale-105' : 'bg-white border-gray-50 text-gray-400 hover:border-indigo-100 shadow-sm'}`}>남성</button>
                                <button onClick={() => setNewGender('female')}
                                    className={`py-5 rounded-3xl border-2 text-sm font-black transition-all
                                        ${newGender === 'female' ? 'bg-rose-600 border-rose-700 text-white shadow-xl shadow-rose-100 scale-105' : 'bg-white border-gray-50 text-gray-400 hover:border-rose-100 shadow-sm'}`}>여성</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-black text-gray-400 ml-2 uppercase tracking-widest">Residential Address</label>
                        <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="현재 거주하시는 상세 주소"
                            className="w-full p-6 bg-gray-50 border-transparent rounded-[2rem] focus:bg-white focus:ring-8 focus:ring-red-50 outline-none transition-all font-bold" />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-black text-gray-400 ml-2 uppercase tracking-widest">Character & Memo</label>
                        <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="성격, 업무 스타일, 주의사항 등을 자유롭게 기록하세요"
                            className="w-full p-6 bg-gray-50 border-transparent rounded-[2rem] focus:bg-white focus:ring-8 focus:ring-red-50 outline-none h-40 resize-none transition-all font-bold" />
                    </div>

                    <button onClick={handleAddWorker} className="w-full h-24 bg-red-600 text-white rounded-[2.5rem] text-3xl font-black shadow-2xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-5">
                        <UserPlus className="w-10 h-10" /> 근로자 등록 확정
                    </button>
                </div>
            )}

            <div className="space-y-20">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-6">
                        <div className="w-16 h-16 border-8 border-red-50 border-t-red-600 rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-black text-2xl animate-pulse tracking-tighter">데이터 동기화 진행 중...</p>
                    </div>
                ) :
                    (['family', 'staff', 'foreign', 'part_time'] as const).map(role => {
                        const filtered = workers.filter(w => w.role === role);
                        if (filtered.length === 0 && !isAdding) return null;

                        return (
                            <section key={role} className="space-y-8 animate-in slide-in-from-bottom-12 duration-1000">
                                <div className="flex items-center gap-4 px-6">
                                    <div className={`w-3 h-8 rounded-full ${roleInfo[role].color.replace('text', 'bg')}`}></div>
                                    <h2 className="text-3xl font-black text-gray-800 tracking-tighter">{roleInfo[role].label}</h2>
                                    <span className="text-[10px] font-black text-gray-300 bg-gray-50 px-4 py-1 rounded-full uppercase tracking-tighter ml-2">{filtered.length} Active</span>
                                </div>
                                <div className="grid grid-cols-1 gap-7">
                                    {filtered.map(worker => renderWorkerCard(worker))}
                                </div>
                            </section>
                        );
                    })
                }

                {!loading && workers.length === 0 && !isAdding && !errorMsg && (
                    <div className="text-center py-40 bg-gray-50 rounded-[5rem] border-8 border-dashed border-gray-100 animate-in zoom-in-95 duration-700">
                        <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                            <User className="w-14 h-14 text-gray-100" />
                        </div>
                        <p className="text-gray-300 font-black text-3xl tracking-tighter">근로자 데이터가 비어 있습니다.</p>
                        <p className="text-gray-200 text-lg font-bold mt-4">상단의 '추가' 버튼을 눌러 첫 번째 근로자를 등록하세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
