"use client";

import { useState, useEffect } from "react";
import { Save, UserCheck, UserX, UserPlus, Clock, History, CalendarDays, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Worker, AttendanceRecord } from "@/lib/supabase";
import Link from "next/link";

export default function AttendancePage() {
    const { farm } = useAuthStore();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [presence, setPresence] = useState<Record<string, boolean>>({});
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (farm) {
            fetchWorkersAndTodayAttendance();
            fetchHistory();
        }
    }, [farm]);

    const fetchWorkersAndTodayAttendance = async () => {
        if (!farm?.id) return;
        setLoading(true);

        // 1. 근로자 목록 가져오기
        const { data: workerData } = await supabase.from('workers').select('*')
            .eq('farm_id', farm.id).eq('is_active', true).order('name');
        const activeWorkers = workerData ?? [];
        setWorkers(activeWorkers);

        // 2. 오늘의 출근 기록 가져오기
        const today = new Date().toISOString().split('T')[0];
        const { data: attendanceData } = await supabase.from('attendance_records').select('*')
            .eq('farm_id', farm.id).eq('work_date', today);

        // 3. 존재 상태 초기화 (기본값: false, 기록があれば 기록값 사용)
        const initialPresence: Record<string, boolean> = {};
        activeWorkers.forEach(w => {
            // 해당 인원의 가장 최신 기록 한 건만 체크 (중복 방지)
            const record = attendanceData?.filter(a => a.worker_id === w.id || a.worker_name === w.name)
                .sort((a, b) => new Date(b.recorded_at!).getTime() - new Date(a.recorded_at!).getTime())[0];
            initialPresence[w.id] = record ? record.is_present : false;
        });
        setPresence(initialPresence);
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
            // 중복 제거: 동일 날짜 + 동일 인물인 경우 최신 기록만 유지
            const uniqueHistory: AttendanceRecord[] = [];
            const seen = new Set();

            data.forEach(item => {
                const key = `${item.work_date}_${item.worker_id || item.worker_name}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueHistory.push(item);
                }
            });

            setHistory(uniqueHistory.slice(0, 15)); // 최종 15건만 노출
        }
    };

    const toggle = (id: string) =>
        setPresence(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSave = async () => {
        if (!farm?.id) return;
        setSaving(true);
        const today = new Date().toISOString().split('T')[0];

        // 1. 기존 오늘 기록 '모두' 삭제 (혹시 모를 중복 방지)
        const { error: delError } = await supabase.from('attendance_records')
            .delete()
            .eq('farm_id', farm.id)
            .eq('work_date', today);

        if (delError) console.error("기존 기록 삭제 중 오류:", delError);

        // 2. 신규 기록 삽입 (출근 인원만 저장하는 것이 아니라 전체 인원의 출근/결근 상태를 저장)
        const { error } = await supabase.from('attendance_records').insert(
            workers.map(w => ({
                farm_id: farm.id,
                work_date: today,
                worker_id: w.id,
                worker_name: w.name,
                role: w.role,
                is_present: presence[w.id] || false
            }))
        );

        if (error) alert(`저장 실패: ${error.message}`);
        else {
            alert(`✅ 저장 완료!\n총 ${Object.values(presence).filter(v => v).length}명 출근`);
            fetchHistory(); // 기록 갱신
        }
        setSaving(false);
    };

    const renderGroup = (title: string, role: string) => {
        const groupWorkers = workers.filter(w => w.role === role);
        if (groupWorkers.length === 0) return null;

        return (
            <section className="mb-8">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-base font-black text-gray-800 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                        {title}
                    </h2>
                    <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {groupWorkers.filter(w => presence[w.id]).length}명 출근 중
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {groupWorkers.map(worker => (
                        <button key={worker.id} onClick={() => toggle(worker.id)}
                            className={`flex flex-col items-center justify-center p-5 rounded-[2rem] border-2 transition-all active:scale-90
                                ${presence[worker.id]
                                    ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-100'
                                    : 'bg-white border-gray-100 text-gray-300'}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors
                                ${presence[worker.id] ? 'bg-white/20' : 'bg-gray-50'}`}>
                                {presence[worker.id]
                                    ? <UserCheck className="w-6 h-6 text-white" />
                                    : <UserX className="w-6 h-6 text-gray-300" />}
                            </div>
                            <span className={`text-lg font-black leading-none mb-1 ${presence[worker.id] ? 'text-white' : 'text-gray-400'}`}>
                                {worker.name}
                            </span>
                            <span className={`text-[10px] font-bold ${presence[worker.id] ? 'text-blue-100' : 'text-gray-300'}`}>
                                {presence[worker.id] ? '출근 완료' : '결근/대기'}
                            </span>
                        </button>
                    ))}
                </div>
            </section>
        );
    };

    return (
        <div className="p-4 md:p-6 pb-32 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-2xl shadow-sm">
                        <UserCheck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 leading-tight tracking-tighter">출근 체크</h1>
                        <p className="text-[11px] text-gray-400 font-black flex items-center gap-1 uppercase tracking-widest">
                            <CalendarDays className="w-3" /> {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? <div className="text-center py-24 text-gray-300 animate-pulse font-black text-lg">데이터 동기화 중...</div> : (
                <>
                    <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-50 p-8">
                        {renderGroup("💼 가족/식구", 'family')}
                        {renderGroup("🌏 외국인 근로자", 'foreign')}
                        {renderGroup("⏳ 아르바이트", 'part_time')}

                        {workers.length === 0 && (
                            <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                                <p className="text-gray-400 mb-6 text-sm font-bold">등록된 활성 근로자가 없습니다.</p>
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
                                <History className="w-6 h-6 text-gray-400" />
                                출근 기록 히스토리
                            </h2>
                            <span className="text-[9px] text-gray-300 font-black uppercase tracking-[0.2em]">Latest Logs</span>
                        </div>

                        <div className="space-y-3">
                            {history.length === 0 ? (
                                <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-gray-300 text-sm font-black">
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
                                                        <span className="text-[10px] font-black text-gray-300 bg-gray-50 px-2 py-0.5 rounded-md">결근</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-[9px] text-gray-300 font-bold">
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
        </div>
    );
}
