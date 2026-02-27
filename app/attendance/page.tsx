"use client";

import { useState, useEffect } from "react";
import { Save, UserCheck, UserX, UserPlus, Clock, History, CalendarDays, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Worker, AttendanceRecord } from "@/lib/supabase";
import Link from "next/link";

export default function AttendancePage() {
    const { farm, initialized } = useAuthStore();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [presence, setPresence] = useState<Record<string, boolean>>({});
    const [wages, setWages] = useState<Record<string, string>>({});
    const [hours, setHours] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [headcounts, setHeadcounts] = useState<Record<string, string>>({});
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'record' | 'stats'>('record');
    const [pageError, setPageError] = useState<string | null>(null);
    const [roleStats, setRoleStats] = useState<Record<string, number>>({ family: 0, staff: 0, foreign: 0, part_time: 0 });
    const [dateRoleStats, setDateRoleStats] = useState<Record<string, Record<string, number>>>({});
    const [totalPresent, setTotalPresent] = useState(0);

    useEffect(() => {
        if (initialized) {
            if (farm) {
                setPageError(null);
                fetchWorkersAndAttendance();
                fetchHistory();
            } else {
                setLoading(false);
                setPageError("농장 정보를 불러올 수 없습니다. 권한 승인 대기 또는 로그인 상태를 확인해주세요.");
            }
        }
    }, [farm, initialized, selectedDate]);

    const fetchWorkersAndAttendance = async () => {
        if (!farm?.id) return;
        setLoading(true);

        const { data: workerData } = await supabase.from('workers').select('*')
            .eq('farm_id', farm.id).eq('is_active', true).order('name');
        const activeWorkers: Worker[] = workerData ?? [];
        setWorkers(activeWorkers);

        const { data: attendanceData } = await supabase.from('attendance_records').select('*')
            .eq('farm_id', farm.id).eq('work_date', selectedDate);

        const initialPresence: Record<string, boolean> = {};
        const initialWages: Record<string, string> = {};
        const initialHours: Record<string, string> = {};
        const initialNotes: Record<string, string> = {};
        const initialHeadcounts: Record<string, string> = {};

        activeWorkers.forEach((w: any) => {
            const record = attendanceData?.find(a => a.worker_id === w.id);
            initialPresence[w.id] = record ? record.is_present : false;
            initialWages[w.id] = record?.daily_wage?.toString() || "";
            initialHours[w.id] = record?.work_hours?.toString() || "";
            initialNotes[w.id] = record?.notes || "";
            initialHeadcounts[w.id] = record?.headcount?.toString() || "1";
        });

        setPresence(initialPresence);
        setWages(initialWages);
        setHours(initialHours);
        setNotes(initialNotes);
        setHeadcounts(initialHeadcounts);
        setLoading(false);
    };

    const fetchHistory = async () => {
        if (!farm?.id) return;
        const { data } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('farm_id', farm.id)
            .order('work_date', { ascending: false })
            .order('recorded_at', { ascending: false })
            .limit(100); // 넉넉히 가져와서 클라이언트에서 필터링

        if (data) {
            const uniqueHistory: AttendanceRecord[] = [];
            const seen = new Set();
            const rStats: Record<string, number> = { family: 0, staff: 0, foreign: 0, part_time: 0 };
            const drStats: Record<string, Record<string, number>> = {};
            let total = 0;

            data.forEach(item => {
                const key = `${item.work_date}_${item.worker_id || item.worker_name}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueHistory.push(item);

                    // 통계 계산 (활성 탭 기간 필터가 현재는 없으므로 히스토리 기반으로 최신 현황 집계하거나 별도 쿼리 필요할 수 있으나 우선 이력 기반)
                    if (item.is_present) {
                        const count = item.headcount || 1;
                        rStats[item.role] = (rStats[item.role] || 0) + count;
                        total += count;

                        const date = item.work_date;
                        if (!drStats[date]) drStats[date] = { family: 0, staff: 0, foreign: 0, part_time: 0 };
                        drStats[date][item.role] = (drStats[date][item.role] || 0) + count;
                    }
                }
            });

            setHistory(uniqueHistory);
            setRoleStats(rStats);
            setDateRoleStats(drStats);
            setTotalPresent(total);
        }
    };

    const toggle = (id: string) =>
        setPresence(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSave = async () => {
        if (!farm?.id) return;
        setSaving(true);

        try {
            // 1. 기존 선택된 날짜 기록 '모두' 삭제
            const { error: delError } = await supabase.from('attendance_records')
                .delete()
                .eq('farm_id', farm.id)
                .eq('work_date', selectedDate);

            if (delError) {
                console.error("기존 기록 삭제 중 오류:", delError);
                // 삭제 실패하더라도 중복 삽입 방지를 위해 로그만 남기고 진행할 수 있으나, 
                // 안전을 위해 사용자에게 알림
            }

            // 2. 신규 기록 삽입 (메모, 일당, 시간 포함)
            const insertData = workers.map(w => ({
                farm_id: farm.id,
                work_date: selectedDate,
                worker_id: w.id,
                worker_name: w.name,
                role: w.role,
                is_present: presence[w.id] || false,
                daily_wage: wages[w.id] ? parseInt(wages[w.id].toString().replace(/[^\d]/g, '')) : null,
                work_hours: hours[w.id] ? parseFloat(hours[w.id]) : null,
                headcount: (presence[w.id] && headcounts[w.id]) ? parseInt(headcounts[w.id]) : (presence[w.id] ? 1 : 0),
                notes: notes[w.id] || null
            }));

            const { error } = await supabase.from('attendance_records').insert(insertData);

            if (error) {
                console.error("저장 실패 상세:", error);
                alert(`저장 실패: ${error.message}\n(DB 스키마 변경이 반영되지 않았을 경우 페이지를 새로고침 후 다시 시도해 주세요.)`);
            } else {
                const totalHeadcount = workers.reduce((acc, w) => acc + (presence[w.id] ? parseInt(headcounts[w.id] || "1") : 0), 0);
                alert(`✅ 저장 완료!\n${selectedDate} - 총 ${totalHeadcount}명 출근 확인`);
                await fetchHistory();
            }
        } catch (err: any) {
            console.error("예상치 못한 오류:", err);
            alert(`오류 발생: ${err.message || '알 수 없는 오류가 발생했습니다.'}`);
        } finally {
            setSaving(false);
        }
    };

    const renderGroup = (title: string, role: string) => {
        const groupWorkers = workers.filter(w => w.role === role);
        if (groupWorkers.length === 0) return null;

        return (
            <section className="mb-10">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-base font-black text-gray-800 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                        {title}
                    </h2>
                    <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {groupWorkers.reduce((acc, w) => acc + (presence[w.id] ? parseInt(headcounts[w.id] || "1") : 0), 0)}명 출근 중
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {groupWorkers.map(worker => (
                        <div key={worker.id} className={`p-4 rounded-[2rem] border-2 transition-all shadow-sm
                            ${presence[worker.id] ? 'bg-blue-50 border-blue-200 shadow-blue-50/50' : 'bg-white border-gray-100'}`}>
                            <div className="flex items-center gap-4 mb-3">
                                <button onClick={() => toggle(worker.id)}
                                    className={`flex items-center gap-3 flex-1 text-left group`}>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0
                                        ${presence[worker.id] ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-gray-50'}`}>
                                        {presence[worker.id]
                                            ? <UserCheck className="w-6 h-6 text-white" />
                                            : <UserX className="w-6 h-6 text-gray-600" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-lg font-black truncate ${presence[worker.id] ? 'text-gray-900' : 'text-gray-700'}`}>{worker.name}</p>
                                        <p className={`text-[10px] font-bold ${presence[worker.id] ? 'text-blue-500' : 'text-gray-600'}`}>
                                            {presence[worker.id] ? '출근 완료' : '결근/대기'}
                                        </p>
                                    </div>
                                </button>
                            </div>
                            {presence[worker.id] && role === 'part_time' && (
                                <div className="flex gap-2 mb-3">
                                    <div className="flex-1">
                                        <label className="block text-[8px] font-bold text-gray-700 mb-0.5 ml-1 uppercase tracking-tighter">인원</label>
                                        <input type="number" placeholder="명" value={headcounts[worker.id] || ""}
                                            onChange={(e) => setHeadcounts({ ...headcounts, [worker.id]: e.target.value })}
                                            className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none h-9 text-center" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[8px] font-bold text-gray-700 mb-0.5 ml-1 uppercase tracking-tighter">시간</label>
                                        <input type="number" placeholder="h" value={hours[worker.id] || ""}
                                            onChange={(e) => setHours({ ...hours, [worker.id]: e.target.value })}
                                            className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none h-9 text-center" />
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="block text-[8px] font-bold text-gray-700 mb-0.5 ml-1 uppercase tracking-tighter">일당(원)</label>
                                        <input type="text" placeholder="일당" value={wages[worker.id] ? `${Number(wages[worker.id].replace(/[^\d]/g, '')).toLocaleString()}원` : ""}
                                            onChange={(e) => setWages({ ...wages, [worker.id]: e.target.value.replace(/[^\d]/g, '') })}
                                            className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none h-9 text-right" />
                                    </div>
                                </div>
                            )}
                            {presence[worker.id] && (
                                <div className="mt-2 relative animate-in slide-in-from-top-2">
                                    <input type="text" placeholder="특이사항 메모 (예: 오전 작업 / 병원 방문 등)" value={notes[worker.id] || ""}
                                        onChange={(e) => setNotes({ ...notes, [worker.id]: e.target.value })}
                                        className="w-full p-3 bg-white/50 border border-blue-50 rounded-xl text-[11px] font-medium focus:bg-white focus:border-blue-300 outline-none transition-all placeholder:text-gray-600 shadow-inner" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        );
    };

    return (
        <div className="p-4 md:p-3 pb-32 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-2xl shadow-sm">
                        <UserCheck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 leading-tight tracking-tighter">출근 체크</h1>
                        <div className="relative mt-1">
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                className="pl-6 pr-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black outline-none border border-blue-100 focus:bg-white transition-all uppercase tracking-widest" />
                            <CalendarDays className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 text-blue-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex bg-white rounded-2xl border border-gray-100 shadow-sm p-1">
                <button onClick={() => setActiveTab('record')}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2
                        ${activeTab === 'record' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <UserCheck className="w-4 h-4" /> 기록하기
                </button>
                <button onClick={() => setActiveTab('stats')}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2
                        ${activeTab === 'stats' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <History className="w-4 h-4" /> 통계보기
                </button>
            </div>

            {activeTab === 'record' ? (
                <>

                    {loading ? <div className="text-center py-24 text-gray-600 animate-pulse font-black text-lg">데이터 동기화 중...</div> : (
                        <>
                            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-50 p-4">
                                {renderGroup("💼 가족/식구", 'family')}
                                {renderGroup("🤝 일반직원", 'staff')}
                                {renderGroup("🌏 외국인 근로자", 'foreign')}
                                {renderGroup("⏳ 아르바이트", 'part_time')}

                                {workers.length === 0 && (
                                    <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                                        <p className="text-gray-700 mb-6 text-sm font-bold">등록된 활성 근로자가 없습니다.</p>
                                        <Link href="/workers" className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-xl shadow-blue-50 transition-all active:scale-95">
                                            <UserPlus className="w-5 h-5" /> 근로자 관리 바로가기
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {workers.length > 0 && (
                                <button onClick={handleSave} disabled={saving}
                                    className="w-full h-20 bg-gray-900 text-white rounded-[2rem] text-xl font-black shadow-2xl shadow-gray-200 hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                    <Save className="w-6 h-6" />
                                    {saving ? '동기화 중...' : '오늘 출근부 확정하기'}
                                </button>
                            )}

                            {/* 최근 출근 내역 섹션 (중복 제거됨) */}
                            <section className="pt-12">
                                <div className="flex items-center justify-between mb-6 px-3">
                                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                        <History className="w-6 h-6 text-gray-700" />
                                        출근 기록 히스토리
                                    </h2>
                                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em]">Latest Logs</span>
                                </div>

                                <div className="space-y-3">
                                    {history.length === 0 ? (
                                        <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-gray-600 text-sm font-black">
                                            저장된 출근 기록이 없습니다.
                                        </div>
                                    ) : (
                                        history.map((item) => (
                                            <div key={item.id} className="bg-white rounded-[1.5rem] border border-gray-50 p-4 shadow-sm flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-300">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex flex-col items-center justify-center border border-gray-50">
                                                        <span className="text-[8px] font-black text-blue-300 leading-none mb-1">{item.work_date.split('-')[1]}월</span>
                                                        <span className="text-lg font-black text-gray-800 leading-none">{item.work_date.split('-')[2]}</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-lg font-black text-gray-900">{item.worker_name}</span>
                                                            {item.is_present ? (
                                                                <div className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                                                                    <CheckCircle2 className="w-3 h-3" /> 출근
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-black text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md">결근</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[9px] text-gray-600 font-bold">
                                                            <Clock className="w-3 h-3" />
                                                            최종 확정: {new Date(item.recorded_at!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </>
                    )}
                </>
            ) : (
                <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                    {/* 상단 통합 카드 (수확 통계 스타일) */}
                    <div className="bg-blue-600 rounded-[2.5rem] p-4 text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">TOTAL ATTENDANCE</p>
                                <h2 className="text-4xl font-black tracking-tighter">{totalPresent.toLocaleString()} <span className="text-base font-medium opacity-70">명</span></h2>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-blue-100 font-bold uppercase opacity-60 mb-2">Role Breakdown</p>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold">임원/가족: {roleStats.family}명</p>
                                    <p className="text-sm font-bold">일반직원: {roleStats.staff}명</p>
                                    <p className="text-sm font-bold opacity-80">외국인: {roleStats.foreign}명</p>
                                    <p className="text-sm font-bold text-blue-200">아르바이트: {roleStats.part_time}명</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 유형별 현황 그리드 (동별 수확량 대응) */}
                    <section>
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <UserCheck className="w-5 h-5 text-blue-500" />
                            <h3 className="text-lg font-black text-gray-800">유형별 출근 현황</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all text-center">
                                <p className="text-[10px] font-black text-gray-700 mb-2 uppercase tracking-widest">💼 가족/식구</p>
                                <p className="text-2xl sm:text-3xl font-black text-blue-600">{roleStats.family}</p>
                            </div>
                            <div className="bg-white p-3 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all text-center">
                                <p className="text-[10px] font-black text-gray-700 mb-2 uppercase tracking-widest">🤝 일반직원</p>
                                <p className="text-2xl sm:text-3xl font-black text-gray-900">{roleStats.staff}</p>
                            </div>
                            <div className="bg-white p-3 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all text-center">
                                <p className="text-[10px] font-black text-gray-700 mb-2 uppercase tracking-widest">🌏 외국인</p>
                                <p className="text-2xl sm:text-3xl font-black text-gray-900">{roleStats.foreign}</p>
                            </div>
                            <div className="bg-white p-3 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all text-center">
                                <p className="text-[10px] font-black text-gray-700 mb-2 uppercase tracking-widest">⏳ 알바/단기</p>
                                <p className="text-2xl sm:text-3xl font-black text-blue-600">{roleStats.part_time}</p>
                            </div>
                        </div>
                    </section>

                    {/* 날짜별 추이 (수확 날짜별 추이 대응) */}
                    <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                            <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
                                <CalendarDays className="w-5 h-5 text-gray-700" />
                                날짜별 출근 추이
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {Object.keys(dateRoleStats).length === 0 ? (
                                <p className="px-6 py-12 text-center text-sm text-gray-600 font-bold">출근 기록이 없습니다.</p>
                            ) : (
                                Object.entries(dateRoleStats)
                                    .sort((a, b) => b[0].localeCompare(a[0]))
                                    .slice(0, 10)
                                    .map(([date, roles]) => {
                                        const total = Object.values(roles).reduce((a, b) => a + b, 0);
                                        return (
                                            <div key={date} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-700">{date}</span>
                                                    <span className="text-sm text-gray-700 font-bold mt-1">
                                                        식구 {roles.family} / 직원 {roles.staff} / 외국인 {roles.foreign} / 알바 {roles.part_time}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xl font-black text-gray-900">{total} <span className="text-xs text-gray-700 font-normal">명</span></span>
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
