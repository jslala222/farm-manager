"use client";

import { useState, useEffect, useRef } from "react";
import {
    Plus, Trash2, UserPlus, Phone, UserCheck, UserX,
    Edit2, Save, X, Users, Heart, Globe, Timer, MapPin, AlignLeft, Check, RefreshCcw, AlertTriangle, User, CreditCard
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Worker } from "@/lib/supabase";
import { formatPhone } from "@/lib/utils";
import AddressSearch from "@/components/AddressSearch";

export default function WorkersPage() {
    const { farm, initialized } = useAuthStore();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isLoadingRef = useRef(false);

    // New Worker State
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newRole, setNewRole] = useState<'family' | 'staff' | 'foreign' | 'part_time'>('family');
    const [newPhone, setNewPhone] = useState("");
    const [newGender, setNewGender] = useState<'male' | 'female'>('male');
    const [newAddress, setNewAddress] = useState("");
    const [newPostalCode, setNewPostalCode] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [newDailyWage, setNewDailyWage] = useState(""); // 기본 일당
    const [activeSubTab, setActiveSubTab] = useState<'list' | 'attendance' | 'payroll'>('list');

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editRole, setEditRole] = useState<'family' | 'staff' | 'foreign' | 'part_time'>('family');
    const [editPhone, setEditPhone] = useState("");
    const [editGender, setEditGender] = useState<'male' | 'female'>('male');
    const [editAddress, setEditAddress] = useState("");
    const [editPostalCode, setEditPostalCode] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editDailyWage, setEditDailyWage] = useState(""); // 수정용 기본 일당

    // Attendance State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});

    // Payroll State
    const [statsMonth, setStatsMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [payrollData, setPayrollData] = useState<any[]>([]);

    useEffect(() => {
        if (initialized) {
            if (farm) {
                fetchWorkers();
                fetchAttendances();
            } else {
                setLoading(false);
                setErrorMsg("농장 정보를 불러올 수 없습니다. 다시 로그인해 주세요.");
            }
        }
    }, [farm, initialized, selectedDate]);

    const fetchWorkers = async () => {
        if (!farm?.id) return;
        setLoading(true);
        isLoadingRef.current = true;
        setErrorMsg(null);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (isLoadingRef.current) {
                setLoading(false);
                isLoadingRef.current = false;
                setErrorMsg("데이터를 불러오는 데 시간이 너무 오래 걸리고 있습니다. 인터넷 연결이 원활하지 않거나, Supabase 서비스 점검 중일 수 있습니다. '새로고침' 아이콘을 눌러 다시 시도해 주세요.");
            }
        }, 15000); // 15초로 연장하여 안정성 확보

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
            if (err.message?.includes('default_daily_wage')) {
                setErrorMsg("인력 관리의 새로운 기능(일당 관리)용 필드가 누락되었습니다.");
            } else {
                setErrorMsg(`시스템 연결 오류: ${err.message || '알 수 없는 오류'}`);
            }
        } finally {
            setLoading(false);
            isLoadingRef.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
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
            postal_code: newPostalCode,
            notes: newNotes,
            is_active: true,
            default_daily_wage: parseInt(newDailyWage.replace(/,/g, "")) || 0
        });
        if (error) {
            console.error(error);
            alert(`추가 실패: ${error.message}`);
        } else {
            setNewName("");
            setNewPhone("");
            setNewAddress("");
            setNewPostalCode("");
            setNewNotes("");
            setNewDailyWage("");
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
        setEditPostalCode(worker.postal_code || "");
        setEditNotes(worker.notes || "");
        setEditDailyWage(worker.default_daily_wage?.toString() || "");
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
            postal_code: editPostalCode,
            notes: editNotes,
            default_daily_wage: parseInt(editDailyWage.replace(/,/g, "")) || 0
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

    // Attendance Logic
    const fetchAttendances = async () => {
        if (!farm?.id) return;
        try {
            const { data, error } = await supabase.from('attendance_records')
                .select('*')
                .eq('farm_id', farm.id)
                .eq('work_date', selectedDate);

            if (error) {
                console.error("[Attendance] Fetch Error:", error);
                if (error.message?.includes('actual_wage') || error.message?.includes('memo')) {
                    setErrorMsg("인력 관리 추가 기능용 필드가 누락되었습니다. [자동 복구]를 실행해 주세요.");
                }
            } else if (data) {
                const map: Record<string, any> = {};
                data.forEach(rec => {
                    if (rec.worker_id) map[rec.worker_id] = rec;
                });
                setAttendanceMap(map);
            }
        } catch (err: any) {
            console.error("[Attendance] System Error:", err);
        }
    };

    const handleAutoFix = async () => {
        if (!confirm("데이터베이스 구조를 자동으로 정례화하시겠습니까?\n(인건비 관리 및 정산에 필요한 모든 필드가 즉시 생성됩니다.)")) return;

        setLoading(true);
        const sql = `
            ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS default_daily_wage INTEGER DEFAULT 0;
            ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS actual_wage INTEGER;
            ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS memo TEXT;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS harvest_note TEXT;
            ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;
        `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            alert("자동 복구 도중 오류가 발생했습니다.\n사장님, 시스템 권한 문제로 인해 수동 조치가 필요할 수 있습니다.");
        } else {
            alert("DB 구조가 성공적으로 복구되었습니다! 이제 시원하게 사용하실 수 있습니다. 🍓");
            fetchWorkers();
            fetchAttendances();
        }
        setLoading(false);
    };

    const handleToggleAttendance = async (worker: Worker) => {
        if (!farm?.id) return;
        const existing = attendanceMap[worker.id];

        if (existing) {
            // 출근 취소 (삭제)
            const { error } = await supabase.from('attendance_records').delete().eq('id', existing.id);
            if (!error) {
                const newMap = { ...attendanceMap };
                delete newMap[worker.id];
                setAttendanceMap(newMap);
            }
        } else {
            // 출근 기록 생성
            const { data, error } = await supabase.from('attendance_records').insert({
                farm_id: farm.id,
                worker_id: worker.id,
                worker_name: worker.name,
                work_date: selectedDate,
                role: worker.role,
                is_present: true,
                actual_wage: worker.default_daily_wage || 0,
                memo: ""
            }).select().single();

            if (!error && data) {
                setAttendanceMap({ ...attendanceMap, [worker.id]: data });
            }
        }
    };

    const updateAttendanceField = async (workerId: string, field: string, value: any) => {
        const existing = attendanceMap[workerId];
        if (!existing) return;

        const { error } = await supabase.from('attendance_records')
            .update({ [field]: value })
            .eq('id', existing.id);

        if (!error) {
            setAttendanceMap({
                ...attendanceMap,
                [workerId]: { ...existing, [field]: value }
            });
        }
    };

    const fetchPayrollData = async () => {
        if (!farm?.id) return;
        const start = `${statsMonth}-01`;
        const end = `${statsMonth}-31`; // 간단히 31일로 설정 (PostgreSQL은 유연하게 처리)

        const { data, error } = await supabase.from('attendance_records')
            .select('*')
            .eq('farm_id', farm.id)
            .gte('work_date', start)
            .lte('work_date', end);

        if (!error && data) {
            // 근로자별 그룹화
            const stats: Record<string, any> = {};
            data.forEach(rec => {
                const key = rec.worker_id || rec.worker_name;
                if (!stats[key]) {
                    stats[key] = {
                        name: rec.worker_name,
                        count: 0,
                        totalWage: 0,
                        role: rec.role
                    };
                }
                stats[key].count += 1;
                stats[key].totalWage += (rec.actual_wage || 0);
            });
            setPayrollData(Object.values(stats));
        }
    };

    useEffect(() => {
        if (activeSubTab === 'payroll') {
            fetchPayrollData();
        }
    }, [activeSubTab, statsMonth]);

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
                <div key={worker.id} className="bg-white rounded-2xl border-2 border-red-200 p-3 shadow-xl animate-in fade-in zoom-in-95 duration-200 space-y-4">
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
                            <input value={editPhone} onChange={(e) => setEditPhone(formatPhone(e.target.value))}
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

                    <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-9">
                            <AddressSearch
                                label="주소"
                                value={editAddress}
                                onChange={(val) => setEditAddress(val)}
                                onAddressSelect={(res) => {
                                    setEditAddress(res.address);
                                    setEditPostalCode(res.zonecode);
                                }}
                                placeholder="거주지 주소 검색"
                            />
                        </div>
                        <div className="col-span-3 space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">우편번호</label>
                            <input value={editPostalCode} onChange={(e) => setEditPostalCode(e.target.value)}
                                className="w-full py-4 px-1 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none font-bold text-center text-sm" placeholder="00000" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Notes</label>
                        <div className="relative">
                            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="특이사항 기록"
                                className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-100 focus:bg-white focus:border-red-300 outline-none h-20 resize-none text-sm" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Default Daily Wage (기본 일당)</label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            <input value={editDailyWage} onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, "");
                                setEditDailyWage(val ? parseInt(val).toLocaleString() : "");
                            }}
                                placeholder="80,000원"
                                className="w-full p-4 pl-10 bg-rose-50 rounded-xl border border-rose-100 focus:bg-white focus:border-red-300 outline-none font-black text-rose-600" />
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
                            {worker.address && <p className="text-[10px] text-gray-400 flex items-start gap-1 px-1 leading-relaxed"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{worker.address}</p>}
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 italic">
                                    일당: {worker.default_daily_wage ? worker.default_daily_wage.toLocaleString() : '0'}원
                                </span>
                            </div>
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
        <div className="p-4 md:p-3 pb-20 max-w-2xl mx-auto space-y-3 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 bg-red-600 rounded-xl shadow-lg shadow-red-200 shrink-0">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight whitespace-nowrap">인력 현황 관리</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Worker Management</p>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={() => {
                            fetchWorkers();
                            fetchAttendances();
                        }}
                        disabled={loading}
                        className={`p-3 bg-white border border-gray-100 text-gray-400 rounded-xl hover:bg-gray-50 shadow-sm transition-all active:rotate-180 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
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
                <div className="bg-amber-50 border-2 border-amber-100 p-3 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-100 rounded-2xl text-amber-600"><AlertTriangle className="w-6 h-6" /></div>
                        <div className="flex-1">
                            <h3 className="font-black text-amber-900 text-sm">시스템 확인이 필요합니다 🍓</h3>
                            <p className="text-[11px] font-bold text-amber-700 leading-relaxed mt-1 break-keep">
                                {errorMsg}
                            </p>
                        </div>
                    </div>
                    {(errorMsg.includes('필드') || errorMsg.includes('누락') || errorMsg.includes('구조')) ? (
                        <button
                            onClick={handleAutoFix}
                            className="w-full bg-amber-600 text-white py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-amber-100 hover:bg-amber-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCcw className="w-4 h-4" /> 1초 만에 자동 복구 (Zero-Touch)
                        </button>
                    ) : (
                        <button onClick={fetchWorkers} className="w-full bg-white border border-amber-200 text-amber-600 py-3.5 rounded-2xl text-xs font-black hover:bg-amber-100 transition-all flex items-center justify-center gap-2">
                            <RefreshCcw className="w-4 h-4" /> 다시 시도하기
                        </button>
                    )}
                </div>
            )}

            {isAdding && (
                <div className="bg-white rounded-3xl border border-red-100 shadow-xl p-3 space-y-3 animate-in slide-in-from-top-6 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-400 ml-1 uppercase">Name</label>
                            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="실명 입력"
                                className="w-full text-lg font-bold p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-400 ml-1 uppercase">Phone</label>
                            <input value={newPhone} onChange={(e) => setNewPhone(formatPhone(e.target.value))} placeholder="010-0000-0000"
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

                    <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-9">
                            <AddressSearch
                                label="주소"
                                value={newAddress}
                                onChange={(val) => setNewAddress(val)}
                                onAddressSelect={(res) => {
                                    setNewAddress(res.address);
                                    setNewPostalCode(res.zonecode);
                                }}
                                placeholder="거주지 주소 검색"
                            />
                        </div>
                        <div className="col-span-3 space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase">우편번호</label>
                            <input value={newPostalCode} onChange={(e) => setNewPostalCode(e.target.value)}
                                className="w-full py-5 px-1 bg-gray-50 rounded-2xl border-transparent focus:bg-white focus:ring-4 focus:ring-red-50 outline-none text-center font-bold text-sm" placeholder="00000" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-400 ml-1 uppercase">Memo</label>
                        <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="메모 입력"
                            className="w-full p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 outline-none h-24 resize-none transition-all text-sm font-medium" />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-400 ml-1 uppercase">Default Daily Wage (기본 일당)</label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                            <input value={newDailyWage} onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, "");
                                setNewDailyWage(val ? parseInt(val).toLocaleString() : "");
                            }}
                                placeholder="80,000원"
                                className="w-full p-5 pl-12 bg-rose-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-red-50 outline-none font-black text-xl text-rose-600 transition-all" />
                        </div>
                    </div>

                    <button onClick={handleAddWorker} className="w-full h-16 bg-red-600 text-white rounded-2xl text-lg font-bold shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                        <UserPlus className="w-6 h-6" /> 등록
                    </button>
                </div>
            )}

            {activeSubTab === 'list' && (
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
            )}

            {activeSubTab === 'attendance' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* 날짜 선택기 */}
                    <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <button onClick={() => {
                            const d = new Date(selectedDate);
                            d.setDate(d.getDate() - 1);
                            setSelectedDate(d.toISOString().split('T')[0]);
                        }} className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 rotate-45" /></button>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Work Date</span>
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                className="text-lg font-black text-gray-900 bg-transparent outline-none text-center" />
                        </div>
                        <button onClick={() => {
                            const d = new Date(selectedDate);
                            d.setDate(d.getDate() + 1);
                            setSelectedDate(d.toISOString().split('T')[0]);
                        }} className="p-2 hover:bg-gray-100 rounded-xl transition-all"><Plus className="w-5 h-5" /></button>
                    </div>

                    <div className="space-y-3">
                        {workers.filter(w => w.is_active).map(worker => {
                            const report = attendanceMap[worker.id];
                            const isPresent = !!report;
                            const info = roleInfo[worker.role as keyof typeof roleInfo] || roleInfo.part_time;

                            return (
                                <div key={worker.id} className={`bg-white rounded-3xl border p-4 transition-all duration-300 ${isPresent ? 'border-green-500 ring-4 ring-green-50' : 'border-gray-100'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => handleToggleAttendance(worker)}
                                                className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all active:scale-90
                                                    ${isPresent ? 'bg-green-500 border-green-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                                                {isPresent ? <UserCheck className="w-7 h-7" /> : <User className="w-7 h-7" />}
                                            </button>
                                            <div>
                                                <h4 className="font-black text-lg text-gray-900">{worker.name}</h4>
                                                <p className="text-[10px] font-bold text-gray-400">{info.label}</p>
                                            </div>
                                        </div>

                                        {isPresent && (
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-2 bg-rose-50 px-3 py-1 rounded-xl border border-rose-100">
                                                    <span className="text-[10px] font-black text-rose-400">일당</span>
                                                    <input
                                                        type="text"
                                                        value={report.actual_wage?.toLocaleString() || '0'}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                                                            updateAttendanceField(worker.id, 'actual_wage', val);
                                                        }}
                                                        className="w-20 bg-transparent text-right font-black text-rose-600 outline-none"
                                                    />
                                                    <span className="text-[10px] font-bold text-rose-400">원</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {isPresent && (
                                        <div className="mt-3 relative">
                                            <AlignLeft className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-300" />
                                            <input
                                                placeholder="오늘 이 분의 업무나 컨디션은 어땠나요? (현장 일기)"
                                                value={report.memo || ""}
                                                onChange={(e) => updateAttendanceField(worker.id, 'memo', e.target.value)}
                                                className="w-full p-2 pl-9 bg-gray-50 rounded-xl text-xs font-medium text-gray-600 focus:bg-white border border-transparent focus:border-green-200 outline-none transition-all"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeSubTab === 'payroll' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* 월 선택기 */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600"><Timer className="w-5 h-5" /></div>
                            <div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Settlement Month</span>
                                <input type="month" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)}
                                    className="block text-lg font-black text-gray-900 bg-transparent outline-none mt-0.5" />
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Payout</span>
                            <span className="text-xl font-black text-indigo-600">
                                {payrollData.reduce((acc, curr) => acc + curr.totalWage, 0).toLocaleString()}원
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[320px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase">근로자</th>
                                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-center">출근일수</th>
                                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-right">총 정산액</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrollData.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-20 text-center text-sm text-gray-400 font-bold">기록이 없습니다.</td>
                                    </tr>
                                ) : payrollData.map((stat, idx) => (
                                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-all group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${roleInfo[stat.role as keyof typeof roleInfo]?.bg || 'bg-gray-100'}`}>
                                                    {stat.name[0]}
                                                </div>
                                                <span className="font-bold text-gray-900">{stat.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-lg text-xs font-black">{stat.count}일</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-black text-gray-900 group-hover:text-indigo-600 transition-colors">{stat.totalWage.toLocaleString()}원</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
