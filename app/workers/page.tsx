"use client";

import { useState, useEffect } from "react";
import {
    Plus, Trash2, UserPlus, Phone, UserCheck, UserX,
    Edit2, Save, X, Users, Heart, Globe, Timer, MapPin, AlignLeft, Check, RefreshCcw
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Worker } from "@/lib/supabase";

export default function WorkersPage() {
    const { farm } = useAuthStore();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        if (farm) fetchWorkers();
    }, [farm]);

    const fetchWorkers = async () => {
        if (!farm?.id) return;
        setLoading(true);
        setErrorMsg(null);
        try {
            const { data, error } = await supabase.from('workers').select('*')
                .eq('farm_id', farm.id).order('created_at', { ascending: true });

            if (error) {
                console.error("Fetch Error Detail:", error);
                setErrorMsg(`데이터 로딩 실패: [${error.code}] ${error.message}. (RLS 설정 혹은 세션 문제일 수 있습니다.)`);
                setWorkers([]);
            } else {
                setWorkers(data ?? []);
            }
        } catch (err: any) {
            console.error("System Error:", err);
            setErrorMsg(`시스템 오류: ${err.message || '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
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
            notes: newNotes
        });
        if (error) {
            console.error(error);
            alert(`추가 실패: ${error.message}\n사장님, 마스터 SQL을 실행하셨나요? 제약 조건 문제일 수 있습니다.`);
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
        if (!confirm("정말 이 근로자를 삭제하겠습니까?\n과거 실적 데이터는 유지되지만 목록에서는 사라집니다.")) return;
        await supabase.from('workers').delete().eq('id', id);
        fetchWorkers();
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
                <div key={worker.id} className="bg-white rounded-3xl border-2 border-red-200 p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200 space-y-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Edit2 className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-bold text-red-600">근로자 정보 상세 수정</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 ml-1">이름</label>
                            <input value={editName} onChange={(e) => setEditName(e.target.value)}
                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none font-bold" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 ml-1">연락처</label>
                            <input value={editPhone} onChange={(e) => setEditPhone(formatPhoneNumber(e.target.value))}
                                placeholder="010-0000-0000"
                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 ml-1">구분</label>
                            <div className="grid grid-cols-4 gap-1">
                                {(['family', 'staff', 'foreign', 'part_time'] as const).map(r => (
                                    <button key={r} onClick={() => setEditRole(r)}
                                        className={`py-2 rounded-xl text-[10px] font-black transition-all border
                                            ${editRole === r ? 'bg-red-500 border-red-600 text-white shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>
                                        {roleInfo[r].label.split('/')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 ml-1">성별</label>
                            <div className="grid grid-cols-2 gap-1">
                                <button onClick={() => setEditGender('male')}
                                    className={`py-2 rounded-xl text-[10px] font-black border transition-all
                                        ${editGender === 'male' ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white text-gray-400 border-gray-100'}`}>남성</button>
                                <button onClick={() => setEditGender('female')}
                                    className={`py-2 rounded-xl text-[10px] font-black border transition-all
                                        ${editGender === 'female' ? 'bg-pink-500 border-pink-600 text-white' : 'bg-white text-gray-400 border-gray-100'}`}>여성</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 ml-1">주소</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-300" />
                            <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                                placeholder="거주지 주소 입력"
                                className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 ml-1">메모</label>
                        <div className="relative">
                            <AlignLeft className="absolute left-3 top-3.5 w-4 h-4 text-gray-300" />
                            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="특이사항, 업무 스타일 등 자유 기록"
                                className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none h-20 resize-none" />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={handleUpdateWorker} className="flex-1 bg-gray-900 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-gray-200 active:scale-95 transition-all">
                            <Check className="w-4 h-4" /> 정보 수정 완료
                        </button>
                        <button onClick={cancelEdit} className="px-6 py-4 bg-gray-100 text-gray-500 rounded-xl font-bold active:scale-95 transition-all">
                            취소
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div key={worker.id}
                className={`bg-white rounded-[2rem] border p-6 shadow-sm flex items-center justify-between group transition-all hover:shadow-xl hover:shadow-gray-100 hover:-translate-y-1
                    ${worker.is_active ? 'border-gray-50 bg-white' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border relative shadow-inner ${info.bg} ${info.border}`}>
                        <info.icon className={`w-7 h-7 ${info.color}`} />
                        <span className={`text-[9px] font-black absolute bottom-1 ${worker.gender === 'female' ? 'text-pink-500' : 'text-blue-500'}`}>
                            {worker.gender === 'female' ? '여성' : '남성'}
                        </span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-2xl text-gray-900">{worker.name}</span>
                            {!worker.is_active && <span className="text-[10px] font-black bg-gray-200 text-gray-500 px-2 py-1 rounded-full uppercase tracking-tighter">중단됨</span>}
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3 text-xs font-bold">
                                <span className={`${info.color} bg-white px-2 py-0.5 rounded-lg border ${info.border} text-[10px] tracking-tight`}>{info.label}</span>
                                {worker.phone && <span className="text-gray-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{worker.phone}</span>}
                            </div>
                            {worker.address && <p className="text-[11px] text-gray-400 truncate max-w-[200px] flex items-center gap-1"><MapPin className="w-3 h-3" />{worker.address}</p>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button onClick={() => toggleWorkerStatus(worker.id, worker.is_active)}
                        className={`p-3 rounded-2xl transition-all active:scale-90 ${worker.is_active ? 'text-gray-300 hover:bg-gray-100 hover:text-gray-500' : 'text-green-600 bg-green-50 hover:bg-green-100'}`}
                        title={worker.is_active ? '비활성화' : '활성화'}>
                        {worker.is_active ? <UserX className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
                    </button>
                    <button onClick={() => startEdit(worker)} className="p-3 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-2xl transition-all active:scale-90">
                        <Edit2 className="w-6 h-6" />
                    </button>
                    <button onClick={() => deleteWorker(worker.id)} className="p-3 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90">
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 pb-32 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-red-600 rounded-[1.5rem] shadow-xl shadow-red-200">
                        <Users className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tighter leading-tight">인력 현황 관리</h1>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">Worker Management System</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchWorkers}
                        className="p-4 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all active:rotate-180 duration-500"
                        title="새로고침">
                        <RefreshCcw className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsAdding(!isAdding)}
                        className={`px-6 py-4 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-2xl active:scale-95
                            ${isAdding ? 'bg-gray-100 text-gray-500' : 'bg-red-600 text-white shadow-red-200 hover:bg-red-700'}`}>
                        {isAdding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        {isAdding ? '닫기' : '근로자 추가'}
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2rem] animate-in slide-in-from-top-4">
                    <p className="text-red-600 font-black text-sm text-center">{errorMsg}</p>
                    <p className="text-red-400 text-[10px] text-center mt-2 font-bold">사장님, 마스터 SQL을 실행한 후 '새로고침' 버튼을 눌러보세요.</p>
                </div>
            )}

            {isAdding && (
                <div className="bg-white rounded-[3rem] border-2 border-red-50 shadow-2xl shadow-red-100/20 p-8 space-y-8 animate-in slide-in-from-top-6 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-30"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                        <div className="space-y-3">
                            <label className="block text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">이름 (필수)</label>
                            <input value={newName} onChange={(e) => setNewName(e.target.value)}
                                placeholder="성함 입력"
                                className="w-full text-2xl font-black p-5 bg-gray-50 border-transparent rounded-3xl focus:bg-white focus:border-red-200 focus:ring-8 focus:ring-red-50 outline-none transition-all text-gray-900" />
                        </div>
                        <div className="space-y-3">
                            <label className="block text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">연락처</label>
                            <input value={newPhone} onChange={(e) => setNewPhone(formatPhoneNumber(e.target.value))}
                                placeholder="010-0000-0000"
                                className="w-full p-5 bg-gray-50 border-transparent rounded-3xl focus:bg-white focus:border-red-200 focus:ring-8 focus:ring-red-50 outline-none transition-all text-gray-900 font-bold" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-4 ml-1 uppercase tracking-widest">인력 구분</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(['family', 'staff', 'foreign', 'part_time'] as const).map(r => (
                                    <button key={r} onClick={() => setNewRole(r)}
                                        className={`py-4 rounded-2xl border-2 text-[10px] font-black transition-all flex flex-col items-center gap-1 shadow-sm
                                            ${newRole === r
                                                ? 'bg-red-600 border-red-600 text-white shadow-xl shadow-red-100 scale-105'
                                                : 'bg-white border-gray-100 text-gray-400 hover:border-red-100'}`}>
                                        {roleInfo[r].label.split('/')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-4 ml-1 uppercase tracking-widest">성별</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setNewGender('male')}
                                    className={`py-4 rounded-2xl border-2 text-[10px] font-black transition-all shadow-sm
                                        ${newGender === 'male' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl shadow-indigo-100 scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-100'}`}>남성</button>
                                <button onClick={() => setNewGender('female')}
                                    className={`py-4 rounded-2xl border-2 text-[10px] font-black transition-all shadow-sm
                                        ${newGender === 'female' ? 'bg-rose-600 border-rose-700 text-white shadow-xl shadow-rose-100 scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-rose-100'}`}>여성</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">거주지 주소</label>
                        <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)}
                            placeholder="거주하시는 주소를 입력하세요"
                            className="w-full p-5 bg-gray-50 border-transparent rounded-3xl focus:bg-white focus:border-red-200 focus:ring-8 focus:ring-red-50 outline-none transition-all text-gray-900" />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-black text-gray-400 ml-1 uppercase tracking-widest">상세 메모</label>
                        <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                            placeholder="특이사항이나 업무 스타일 등을 자유롭게 메모하세요"
                            className="w-full p-5 bg-gray-50 border-transparent rounded-3xl focus:bg-white focus:border-red-200 focus:ring-8 focus:ring-red-50 outline-none h-32 resize-none transition-all text-gray-900" />
                    </div>

                    <button onClick={handleAddWorker}
                        className="w-full h-20 bg-red-600 text-white rounded-[2rem] text-2xl font-black shadow-2xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-4">
                        <UserPlus className="w-8 h-8" />
                        근로자 등록 확정
                    </button>
                </div>
            )}

            <div className="space-y-16">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <div className="w-12 h-12 border-4 border-red-100 border-t-red-600 rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-black text-lg animate-pulse">데이터 동기화 중...</p>
                    </div>
                ) :
                    (['family', 'staff', 'foreign', 'part_time'] as const).map(role => {
                        const filtered = workers.filter(w => w.role === role);
                        if (filtered.length === 0 && !isAdding) return null;

                        return (
                            <section key={role} className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                                <div className="flex items-center justify-between px-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-6 rounded-full ${roleInfo[role].color.replace('text', 'bg')}`}></div>
                                        <h2 className="text-2xl font-black text-gray-800 tracking-tighter">{roleInfo[role].label}</h2>
                                    </div>
                                    <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-4 py-1.5 rounded-full uppercase tracking-widest border border-gray-100">
                                        {filtered.length} <span className="text-gray-300">명 등록됨</span>
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-5">
                                    {filtered.map(worker => renderWorkerCard(worker))}
                                </div>
                            </section>
                        );
                    })
                }

                {!loading && workers.length === 0 && !isAdding && !errorMsg && (
                    <div className="text-center py-32 bg-gray-50 rounded-[4rem] border-4 border-dashed border-gray-100 animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-white rounded-3xl border border-gray-100 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-gray-100">
                            <UserPlus className="w-12 h-12 text-gray-200" />
                        </div>
                        <p className="text-gray-400 font-black text-2xl tracking-tighter">아직 등록된 근로자가 없습니다.</p>
                        <p className="text-gray-300 text-base font-bold mt-2">상단의 '근로자 추가' 버튼을 눌러주세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
