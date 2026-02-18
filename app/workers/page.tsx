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
                <div key={worker.id} className="bg-white rounded-2xl border-2 border-red-200 p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Edit2 className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-bold text-red-600">정보 수정</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Name</label>
                            <input value={editName} onChange={(e) => setEditName(e.target.value)}
                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none font-bold text-base" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Phone</label>
                            <input value={editPhone} onChange={(e) => setEditPhone(formatPhoneNumber(e.target.value))}
                                placeholder="010-0000-0000"
                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none font-bold text-base" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Role</label>
                            <div className="grid grid-cols-4 gap-1">
                                {(['family', 'staff', 'foreign', 'part_time'] as const).map(r => (
                                    <button key={r} onClick={() => setEditRole(r)}
                                        className={`py-2 rounded-lg text-[10px] font-bold transition-all border
                                            ${editRole === r ? 'bg-red-600 border-red-700 text-white shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>
                                        {roleInfo[r].label.split('/')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Gender</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setEditGender('male')}
                                    className={`py-2 rounded-lg text-[10px] font-bold border transition-all
                                        ${editGender === 'male' ? 'bg-indigo-600 border-indigo-700 text-white shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>남성</button>
                                <button onClick={() => setEditGender('female')}
                                    className={`py-2 rounded-lg text-[10px] font-bold border transition-all
                                        ${editGender === 'female' ? 'bg-rose-600 border-rose-700 text-white shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>여성</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-300" />
                            <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                                placeholder="주소 입력"
                                className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none text-sm" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Notes</label>
                        <div className="relative">
                            <AlignLeft className="absolute left-3 top-3.5 w-4 h-4 text-gray-300" />
                            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="특이사항 기록"
                                className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none h-20 resize-none text-sm" />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={handleUpdateWorker} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-gray-200 text-sm">
                            <Check className="w-4 h-4" /> 저장
                        </button>
                        <button onClick={cancelEdit} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold active:scale-95 transition-all text-sm">
                            취소
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div key={worker.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm flex items-center justify-between group transition-all hover:shadow-lg hover:border-gray-200
                    ${worker.is_active ? 'border-gray-100 bg-white' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border relative shadow-inner ${info.bg} ${info.border}`}>
                        <info.icon className={`w-6 h-6 ${info.color}`} />
                        <span className={`text-[9px] font-bold absolute bottom-1 ${worker.gender === 'female' ? 'text-pink-500' : 'text-blue-500'}`}>
                            {worker.gender === 'female' ? '여성' : '남성'}
                        </span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-xl text-gray-900">{worker.name}</span>
                            {!worker.is_active && <span className="text-[9px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full uppercase">중단</span>}
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs font-medium">
                                <span className={`${info.color} bg-white px-2 py-0.5 rounded-lg border ${info.border} text-[10px]`}>{info.label}</span>
                                {worker.phone && <span className="text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{worker.phone}</span>}
                            </div>
                            {worker.address && <p className="text-[10px] text-gray-400 flex items-center gap-1 px-1"><MapPin className="w-3 h-3" />{worker.address}</p>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button onClick={() => toggleWorkerStatus(worker.id, worker.is_active)} className={`p-2.5 rounded-xl transition-all active:scale-90 ${worker.is_active ? 'text-gray-300 hover:bg-gray-100 hover:text-gray-500' : 'bg-green-50 text-green-600'}`}>
                        {worker.is_active ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                    </button>
                    <button onClick={() => startEdit(worker)} className="p-2.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all active:scale-90">
                        <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => deleteWorker(worker.id)} className="p-2.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 pb-24 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-600 rounded-xl shadow-lg shadow-red-200">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">인력 현황 관리</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Worker Management</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchWorkers} className="p-3 bg-white border border-gray-100 text-gray-400 rounded-xl hover:bg-gray-50 shadow-sm transition-all active:rotate-180">
                        <RefreshCcw className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsAdding(!isAdding)}
                        className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all
                            ${isAdding ? 'bg-gray-100 text-gray-500' : 'bg-red-600 text-white shadow-red-200 hover:bg-red-700'}`}>
                        {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {isAdding ? '닫기' : '추가'}
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
                    <div className="bg-amber-100 p-2 rounded-xl shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                    <div>
                        <p className="text-amber-800 font-bold text-sm leading-tight">{errorMsg}</p>
                        <p className="text-amber-600 text-[10px] mt-1">Supabase 연결 상태 확인 필요</p>
                    </div>
                </div>
            )}

            {isAdding && (
                <div className="bg-white rounded-3xl border border-red-100 shadow-xl p-6 space-y-6 animate-in slide-in-from-top-6 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-400 ml-1 uppercase">Name</label>
                            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="실명 입력"
                                className="w-full text-lg font-bold p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-400 ml-1 uppercase">Phone</label>
                            <input value={newPhone} onChange={(e) => setNewPhone(formatPhoneNumber(e.target.value))} placeholder="010-0000-0000"
                                className="w-full text-lg font-bold p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 outline-none transition-all" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-2 ml-1 uppercase">Role</label>
                            <div className="grid grid-cols-4 gap-1">
                                {(['family', 'staff', 'foreign', 'part_time'] as const).map(r => (
                                    <button key={r} onClick={() => setNewRole(r)}
                                        className={`py-3 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center gap-1
                                            ${newRole === r
                                                ? 'bg-red-600 border-red-700 text-white shadow-lg'
                                                : 'bg-white border text-gray-400 border-gray-100 hover:bg-gray-50'}`}>
                                        {roleInfo[r].label.split('/')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-2 ml-1 uppercase">Gender</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setNewGender('male')}
                                    className={`py-3 rounded-xl border text-xs font-bold transition-all
                                        ${newGender === 'male' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>남성</button>
                                <button onClick={() => setNewGender('female')}
                                    className={`py-3 rounded-xl border text-xs font-bold transition-all
                                        ${newGender === 'female' ? 'bg-rose-600 border-rose-700 text-white shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>여성</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-400 ml-1 uppercase">Address</label>
                        <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="주소 입력"
                            className="w-full p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 outline-none transition-all text-sm font-medium" />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-400 ml-1 uppercase">Memo</label>
                        <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="메모 입력"
                            className="w-full p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 outline-none h-24 resize-none transition-all text-sm font-medium" />
                    </div>

                    <button onClick={handleAddWorker} className="w-full h-16 bg-red-600 text-white rounded-2xl text-lg font-bold shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                        <UserPlus className="w-6 h-6" /> 등록
                    </button>
                </div>
            )}

            <div className="space-y-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-10 h-10 border-4 border-red-50 border-t-red-600 rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-bold text-sm">로딩 중...</p>
                    </div>
                ) :
                    (['family', 'staff', 'foreign', 'part_time'] as const).map(role => {
                        const filtered = workers.filter(w => w.role === role);
                        if (filtered.length === 0 && !isAdding) return null;

                        return (
                            <section key={role} className="space-y-3">
                                <div className="flex items-center gap-3 px-2">
                                    <div className={`w-1.5 h-5 rounded-full ${roleInfo[role].color.replace('text', 'bg')}`}></div>
                                    <h2 className="text-lg font-bold text-gray-800">{roleInfo[role].label}</h2>
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md ml-1">{filtered.length}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {filtered.map(worker => renderWorkerCard(worker))}
                                </div>
                            </section>
                        );
                    })
                }

                {!loading && workers.length === 0 && !isAdding && !errorMsg && (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                        <p className="text-gray-400 font-bold text-sm">등록된 근로자가 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
