"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Plus, Trash2, Users, Save, CheckCircle,
    CalendarDays, AlertCircle, ChevronDown, ChevronUp, Pencil,
    ChevronLeft, ChevronRight
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Worker, AttendanceRecord, LaborCost } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ─── 상수 ─────────────────────────────────────────────────────────────────────
type Source = '인력사무소' | '개별직접';
type PaymentMethod = '현금' | '계좌이체' | '카드';

const GRADES = ['오야지', '상급', '중급', '하급', '기타'];
const PAYMENT_METHODS: PaymentMethod[] = ['현금', '계좌이체', '카드'];
const WORK_TYPES = ['농작물 수확', '시설관리', '농약살포', '비료작업', '잡일', '기타'];
const DAY_NAMES_KR = ['일', '월', '화', '수', '목', '금', '토'];

// ─── 로컬 행 타입 ──────────────────────────────────────────────────────────────
interface LaborRow {
    _key: number;           // 렌더링 키 (DB id 없을 수 있음)
    id?: string;
    source: Source;
    agency_name: string;
    grade: string;
    headcount: number;
    daily_wage: number;
    tip: number;
    payment_method: PaymentMethod;
    work_type: string;
    notes: string;
    paid: boolean;          // 지급완료 여부
}

let _keyCounter = 0;
const newRow = (overrides?: Partial<LaborRow>): LaborRow => ({
    _key: ++_keyCounter,
    source: '인력사무소',
    agency_name: '',
    grade: '중급',
    headcount: 1,
    daily_wage: 0,
    tip: 0,
    payment_method: '현금',
    work_type: '',
    notes: '',
    paid: false,
    ...overrides,
});

const rowSubtotal = (r: LaborRow) => r.headcount * r.daily_wage + (r.tip || 0);

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function LaborPage() {
    const { farm, initialized } = useAuthStore();
    const queryClient = useQueryClient();

    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);

    const moveDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        const next = d.toISOString().split('T')[0];
        if (next <= today) setSelectedDate(next);
    };

    const moveWeek = (direction: number) => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + direction * 7);
        const next = d.toISOString().split('T')[0];
        if (next <= today) setSelectedDate(next);
    };
    const [rows, setRows] = useState<LaborRow[]>([]);
    const [attendance, setAttendance] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [showWeekSummary, setShowWeekSummary] = useState(true);

    // ── 직원/식구 목록 ──────────────────────────────────────────────────────────
    const { data: workers = [] } = useQuery({
        queryKey: ['workers-staff', farm?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('workers')
                .select('*')
                .eq('farm_id', farm!.id)
                .eq('is_active', true)
                .in('role', ['staff', 'family', 'foreign'])
                .order('name');
            return (data ?? []) as Worker[];
        },
        enabled: !!farm?.id,
    });

    // ── labor_costs 로드 ────────────────────────────────────────────────────────
    const { data: dbCosts = [] } = useQuery({
        queryKey: ['labor_costs', farm?.id, selectedDate],
        queryFn: async () => {
            const { data } = await supabase
                .from('labor_costs')
                .select('*')
                .eq('farm_id', farm!.id)
                .eq('work_date', selectedDate)
                .order('created_at');
            return (data ?? []) as LaborCost[];
        },
        enabled: !!farm?.id,
    });

    // ── attendance 로드 ─────────────────────────────────────────────────────────
    const { data: dbAttendance = [] } = useQuery({
        queryKey: ['attendance', farm?.id, selectedDate],
        queryFn: async () => {
            const { data } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('farm_id', farm!.id)
                .eq('work_date', selectedDate);
            return (data ?? []) as AttendanceRecord[];
        },
        enabled: !!farm?.id,
    });

    // ── 주간 날짜 계산 (월~일) ──────────────────────────────────────────────────
    const weekDates = useMemo(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        const dow = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
        return Array.from({ length: 7 }, (_, i) => {
            const dd = new Date(monday);
            dd.setDate(monday.getDate() + i);
            return dd.toISOString().split('T')[0];
        });
    }, [selectedDate]);

    // ── 주간 labor_costs 조회 ───────────────────────────────────────────────────
    const { data: weekCosts = [] } = useQuery({
        queryKey: ['labor_costs_week', farm?.id, weekDates[0]],
        queryFn: async () => {
            const { data } = await supabase
                .from('labor_costs')
                .select('*')
                .eq('farm_id', farm!.id)
                .gte('work_date', weekDates[0])
                .lte('work_date', weekDates[6]);
            return (data ?? []) as LaborCost[];
        },
        enabled: !!farm?.id,
    });

    // ── 주간 attendance 조회 ────────────────────────────────────────────────────
    const { data: weekAttendance = [] } = useQuery({
        queryKey: ['attendance_week', farm?.id, weekDates[0]],
        queryFn: async () => {
            const { data } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('farm_id', farm!.id)
                .gte('work_date', weekDates[0])
                .lte('work_date', weekDates[6]);
            return (data ?? []) as AttendanceRecord[];
        },
        enabled: !!farm?.id,
    });

    // ── 주간 요약 계산 ──────────────────────────────────────────────────────────
    const weekSummary = useMemo(() => {
        return weekDates.map(date => {
            const costs = weekCosts.filter(c => c.work_date === date);
            const att = weekAttendance.filter(a => a.work_date === date && a.is_present);
            const laborHeadcount = costs.reduce((s, c) => s + c.headcount, 0);
            const laborTotal = costs.reduce((s, c) => s + c.headcount * c.daily_wage + (c.tip || 0), 0);
            const staffCount = att.length;
            const total = laborHeadcount + staffCount;
            const bySource: Record<string, { headcount: number; amount: number }> = {};
            costs.forEach(c => {
                const key = c.source === '인력사무소' && c.agency_name
                    ? c.agency_name
                    : c.source === '인력사무소' ? '인력사무소' : '개별직접';
                if (!bySource[key]) bySource[key] = { headcount: 0, amount: 0 };
                bySource[key].headcount += c.headcount;
                bySource[key].amount += c.headcount * c.daily_wage + (c.tip || 0);
            });
            return { date, laborHeadcount, laborTotal, staffCount, total, bySource };
        });
    }, [weekDates, weekCosts, weekAttendance]);

    // ── 월간 데이터 조회 ────────────────────────────────────────────────────────
    const monthStr = selectedDate.slice(0, 7); // YYYY-MM
    const monthLastDay = new Date(
        parseInt(monthStr.split('-')[0]),
        parseInt(monthStr.split('-')[1]),
        0
    ).getDate();
    const monthStart = `${monthStr}-01`;
    const monthEnd = `${monthStr}-${String(monthLastDay).padStart(2, '0')}`;

    const { data: monthCosts = [] } = useQuery({
        queryKey: ['labor_costs_month', farm?.id, monthStr],
        queryFn: async () => {
            const { data } = await supabase
                .from('labor_costs')
                .select('source, headcount, daily_wage, tip')
                .eq('farm_id', farm!.id)
                .gte('work_date', monthStart)
                .lte('work_date', monthEnd);
            return (data ?? []) as Pick<LaborCost, 'source' | 'headcount' | 'daily_wage' | 'tip'>[];
        },
        enabled: !!farm?.id,
    });

    const { data: monthAttendance = [] } = useQuery({
        queryKey: ['attendance_month', farm?.id, monthStr],
        queryFn: async () => {
            const { data } = await supabase
                .from('attendance_records')
                .select('is_present')
                .eq('farm_id', farm!.id)
                .gte('work_date', monthStart)
                .lte('work_date', monthEnd)
                .eq('is_present', true);
            return (data ?? []) as { is_present: boolean }[];
        },
        enabled: !!farm?.id,
    });

    const monthSummary = useMemo(() => {
        const staffDays = monthAttendance.length;
        const agencyCount = monthCosts
            .filter(c => c.source === '인력사무소')
            .reduce((s, c) => s + c.headcount, 0);
        const directCount = monthCosts
            .filter(c => c.source === '개별직접')
            .reduce((s, c) => s + c.headcount, 0);
        const totalCost = monthCosts.reduce((s, c) => s + c.headcount * c.daily_wage + (c.tip || 0), 0);
        const totalTip = monthCosts.reduce((s, c) => s + (c.tip || 0), 0);
        return { staffDays, agencyCount, directCount, totalCost, totalTip };
    }, [monthCosts, monthAttendance]);

    // ── DB → 로컬 state 동기화 ──────────────────────────────────────────────────
    useEffect(() => {
        setRows(
            dbCosts.length > 0
                ? dbCosts.map(c => newRow({
                    id: c.id,
                    source: c.source as Source,
                    agency_name: c.agency_name ?? '',
                    grade: c.grade,
                    headcount: c.headcount,
                    daily_wage: c.daily_wage,
                    tip: c.tip ?? 0,
                    payment_method: c.payment_method as PaymentMethod,
                    work_type: c.work_type ?? '',
                    notes: c.notes ?? '',
                    paid: !!c.expenditure_id,
                }))
                : []
        );
    }, [dbCosts]);

    useEffect(() => {
        const att: Record<string, boolean> = {};
        workers.forEach(w => {
            att[w.id] = dbAttendance.some(a => a.worker_id === w.id && a.is_present);
        });
        setAttendance(att);
    }, [dbAttendance, workers]);

    // ── 행 조작 ─────────────────────────────────────────────────────────────────
    const addRow = () => {
        const r = newRow();
        setRows(prev => [...prev, r]);
        setExpandedRows(prev => new Set([...prev, r._key]));
    };

    const updateRow = (key: number, field: keyof LaborRow, value: unknown) =>
        setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));

    const removeRow = (key: number) =>
        setRows(prev => prev.filter(r => r._key !== key));

    const toggleExpand = (key: number) =>
        setExpandedRows(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });

    // ── 합계 계산 ───────────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        const byMethod: Record<PaymentMethod, number> = { 현금: 0, 계좌이체: 0, 카드: 0 };
        let grand = 0;
        rows.forEach(r => {
            const sub = rowSubtotal(r);
            byMethod[r.payment_method] += sub;
            grand += sub;
        });
        return { byMethod, grand };
    }, [rows]);

    // ── 저장 ────────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!farm?.id) return;
        setSaving(true);
        try {
            // 미지급 항목만 삭제 후 재저장
            await supabase
                .from('labor_costs')
                .delete()
                .eq('farm_id', farm.id)
                .eq('work_date', selectedDate)
                .is('expenditure_id', null);

            const unpaid = rows.filter(r => !r.paid);
            if (unpaid.length > 0) {
                await supabase.from('labor_costs').insert(
                    unpaid.map(r => ({
                        farm_id: farm.id,
                        work_date: selectedDate,
                        source: r.source,
                        agency_name: r.agency_name || null,
                        grade: r.grade,
                        headcount: r.headcount,
                        daily_wage: r.daily_wage,
                        tip: r.tip || 0,
                        payment_method: r.payment_method,
                        work_type: r.work_type || null,
                        notes: r.notes || null,
                    }))
                );
            }

            // 직원/식구 출근 기록 저장
            await supabase
                .from('attendance_records')
                .delete()
                .eq('farm_id', farm.id)
                .eq('work_date', selectedDate)
                .in('role', ['staff', 'family', 'foreign']);

            const presentWorkers = workers.filter(w => attendance[w.id]);
            if (presentWorkers.length > 0) {
                await supabase.from('attendance_records').insert(
                    presentWorkers.map(w => ({
                        farm_id: farm.id,
                        work_date: selectedDate,
                        worker_id: w.id,
                        worker_name: w.name,
                        role: w.role,
                        is_present: true,
                        headcount: 1,
                    }))
                );
            }

            queryClient.invalidateQueries({ queryKey: ['labor_costs'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            queryClient.invalidateQueries({ queryKey: ['labor_costs_week'] });
            queryClient.invalidateQueries({ queryKey: ['attendance_week'] });
            queryClient.invalidateQueries({ queryKey: ['labor_costs_month'] });
            queryClient.invalidateQueries({ queryKey: ['attendance_month'] });
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 2000);
        } catch (err: any) {
            alert(`저장 실패: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    // ── 지급완료 → 지출 등록 ───────────────────────────────────────────────────
    const handlePay = async () => {
        if (!farm?.id || totals.grand === 0) return;
        const unpaid = rows.filter(r => !r.paid);
        if (unpaid.length === 0) {
            alert('이미 모두 지급완료 처리된 항목입니다.');
            return;
        }
        const unpaidTotal = unpaid.reduce((s, r) => s + rowSubtotal(r), 0);
        if (!confirm(`미지급 합계 ${unpaidTotal.toLocaleString()}원을\n지출에 등록하시겠습니까?`)) return;

        setSaving(true);
        try {
            await handleSave();

            // 지급방식별로 지출 등록
            const byMethod: Record<string, number> = {};
            unpaid.forEach(r => {
                byMethod[r.payment_method] = (byMethod[r.payment_method] || 0) + rowSubtotal(r);
            });

            const { data: expRecords } = await supabase
                .from('expenditures')
                .insert(
                    Object.entries(byMethod).map(([method, amount]) => ({
                        farm_id: farm.id,
                        main_category: '인건비',
                        sub_category: '아르바이트(일당)',
                        category: '인건비',
                        amount,
                        expense_date: selectedDate,
                        payment_method: method,
                        notes: `${selectedDate} 알바/용역 (${method})`,
                    }))
                )
                .select();

            // labor_costs에 expenditure_id 연결
            if (expRecords && expRecords.length > 0) {
                await supabase
                    .from('labor_costs')
                    .update({ expenditure_id: expRecords[0].id })
                    .eq('farm_id', farm.id)
                    .eq('work_date', selectedDate)
                    .is('expenditure_id', null);
            }

            queryClient.invalidateQueries({ queryKey: ['labor_costs'] });
            queryClient.invalidateQueries({ queryKey: ['expenditures'] });
            alert(`✅ 지급 완료!\n${unpaidTotal.toLocaleString()}원이 지출에 등록되었습니다.`);
        } catch (err: any) {
            alert(`오류: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (!initialized) return <div className="p-8 text-center text-gray-400 text-sm">로딩 중...</div>;
    if (!farm) return <div className="p-8 text-center text-gray-400 text-sm">농장 정보를 불러올 수 없습니다.</div>;

    const unpaidTotal = rows.filter(r => !r.paid).reduce((s, r) => s + rowSubtotal(r), 0);

    const monthNum = parseInt(monthStr.split('-')[1]);

    return (
        <div className="p-4 md:p-6 pb-40 max-w-2xl mx-auto space-y-5">

            {/* ── 월간 요약 스트립 ── */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">
                        {monthNum}월 인력 현황 총계
                    </span>
                    <span className="text-[10px] font-bold text-orange-300">
                        알바 총 {monthSummary.agencyCount + monthSummary.directCount}명
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {monthSummary.staffDays > 0 && (
                        <span className="text-[11px] font-bold text-gray-500">
                            직원/식구 <span className="text-blue-600 font-black">{monthSummary.staffDays}명</span>
                        </span>
                    )}
                    <span className="text-[11px] font-bold text-gray-500">
                        알바{' '}
                        <span className="text-orange-600 font-black">인력 {monthSummary.agencyCount}명</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="text-orange-600 font-black">개별 {monthSummary.directCount}명</span>
                    </span>
                    <span className="text-[11px] font-bold text-gray-500">
                        비용 <span className="text-orange-700 font-black">{monthSummary.totalCost.toLocaleString()}원</span>
                    </span>
                    {monthSummary.totalTip > 0 && (
                        <span className="text-[11px] font-bold text-gray-500">
                            팁 <span className="text-orange-500 font-black">{monthSummary.totalTip.toLocaleString()}원</span>
                        </span>
                    )}
                </div>
            </div>

            {/* ── 헤더 ── */}
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-100 rounded-2xl shadow-sm">
                        <Users className="w-6 h-6 text-orange-600" />
                    </div>
                    <h1 className="text-xl font-black text-gray-900 tracking-tighter">일일 현황</h1>
                </div>

                {/* 날짜 네비게이션 - 전체 너비 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => moveDate(-1)}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-orange-100 hover:text-orange-600 text-gray-500 transition-all active:scale-95 shrink-0"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="relative flex-1">
                        <input
                            type="date"
                            value={selectedDate}
                            max={today}
                            onChange={e => e.target.value <= today && setSelectedDate(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-base font-black outline-none border border-orange-200 focus:bg-white transition-all"
                        />
                        <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 pointer-events-none" />
                    </div>

                    <button
                        onClick={() => moveDate(1)}
                        disabled={selectedDate >= today}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-orange-100 hover:text-orange-600 text-gray-500 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    {selectedDate < today && (
                        <button
                            onClick={() => setSelectedDate(today)}
                            className="px-3 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-black active:scale-95 transition-transform shrink-0"
                        >
                            오늘
                        </button>
                    )}
                </div>
            </div>

            {/* ── 주간 인력 현황 ── */}
            <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {/* 헤더 + 주 이동 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <button
                        onClick={() => moveWeek(-1)}
                        className="p-1.5 rounded-lg bg-gray-100 hover:bg-orange-100 text-gray-500 hover:text-orange-600 transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowWeekSummary(p => !p)}
                        className="flex items-center gap-2 text-xs font-black text-gray-700"
                    >
                        <CalendarDays className="w-3.5 h-3.5 text-orange-400" />
                        주간 인력 현황
                        <span className="text-[10px] text-gray-400 font-normal">
                            {weekDates[0].slice(5).replace('-', '/')}&nbsp;~&nbsp;{weekDates[6].slice(5).replace('-', '/')}
                        </span>
                        {showWeekSummary
                            ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                    <button
                        onClick={() => moveWeek(1)}
                        disabled={weekDates[6] >= today}
                        className="p-1.5 rounded-lg bg-gray-100 hover:bg-orange-100 text-gray-500 hover:text-orange-600 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {showWeekSummary && (
                    <>
                        {/* 7일 칩 */}
                        <div className="flex overflow-x-auto px-3 py-3 gap-2 scrollbar-hide">
                            {weekSummary.map(({ date, total }) => {
                                const d = new Date(date + 'T00:00:00');
                                const dayName = DAY_NAMES_KR[d.getDay()];
                                const dayNum = parseInt(date.slice(8));
                                const isSelected = date === selectedDate;
                                const isToday = date === today;
                                const isFuture = date > today;
                                return (
                                    <button
                                        key={date}
                                        onClick={() => !isFuture && setSelectedDate(date)}
                                        disabled={isFuture}
                                        className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-2xl shrink-0 transition-all min-w-[52px] active:scale-95 ${
                                            isSelected
                                                ? 'bg-orange-500 text-white shadow-md shadow-orange-100'
                                                : isFuture
                                                ? 'bg-gray-50 opacity-30 cursor-not-allowed'
                                                : total > 0
                                                ? 'bg-orange-50 hover:bg-orange-100'
                                                : 'bg-gray-50 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className={`text-[9px] font-black ${isSelected ? 'text-orange-200' : 'text-gray-400'}`}>
                                            {dayName}
                                        </span>
                                        <span className={`text-base font-black leading-none ${
                                            isSelected ? 'text-white'
                                            : isToday ? 'text-orange-500'
                                            : 'text-gray-800'
                                        }`}>
                                            {dayNum}
                                        </span>
                                        <span className={`text-[10px] font-bold leading-none mt-0.5 ${
                                            isSelected ? 'text-orange-100'
                                            : total > 0 ? 'text-orange-500'
                                            : 'text-gray-300'
                                        }`}>
                                            {isFuture ? '—' : total > 0 ? `${total}명` : '없음'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 선택된 날 상세 */}
                        {(() => {
                            const sel = weekSummary.find(w => w.date === selectedDate);
                            if (!sel) return null;
                            const d = new Date(selectedDate + 'T00:00:00');
                            const dayName = DAY_NAMES_KR[d.getDay()];
                            const mm = selectedDate.slice(5, 7);
                            const dd = selectedDate.slice(8);
                            return (
                                <div className="px-4 pb-4 border-t border-orange-50">
                                    <div className="flex items-center justify-between py-2.5">
                                        <span className="text-[11px] font-black text-gray-500">
                                            {mm}/{dd}({dayName}) 상세
                                        </span>
                                        {sel.total > 0 && (
                                            <div className="flex gap-3">
                                                <span className="text-[10px] font-bold text-gray-400">
                                                    총 <span className="text-orange-600 font-black">{sel.total}명</span>
                                                </span>
                                                <span className="text-[10px] font-black text-orange-600">
                                                    {sel.laborTotal.toLocaleString()}원
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {sel.total === 0 ? (
                                        <p className="text-[11px] text-gray-300 font-bold text-center py-2">기록 없음</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {sel.staffCount > 0 && (
                                                <div className="flex items-center justify-between bg-blue-50 rounded-xl px-3 py-2">
                                                    <span className="text-[11px] font-black text-blue-700">직원 / 식구</span>
                                                    <span className="text-[11px] font-black text-blue-600">
                                                        {sel.staffCount}명
                                                        <span className="text-[9px] text-blue-300 font-medium ml-1">(월급 별도)</span>
                                                    </span>
                                                </div>
                                            )}
                                            {Object.entries(sel.bySource).map(([key, val]) => (
                                                <div key={key} className="flex items-center justify-between bg-orange-50/70 rounded-xl px-3 py-2">
                                                    <span className="text-[11px] font-black text-orange-800 truncate max-w-[140px]">{key}</span>
                                                    <span className="text-[11px] font-black text-orange-600 shrink-0">
                                                        {val.headcount}명 · {val.amount.toLocaleString()}원
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}
            </section>

            {/* ── 알바/용역 섹션 ── */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-orange-400 rounded-full" />
                        알바 / 용역
                    </h2>
                    <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" /> 행 추가
                    </button>
                </div>

                {rows.length === 0 ? (
                    <div className="text-center py-10 text-gray-300 text-sm bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        + 행 추가 버튼으로 인력 투입을 기록하세요
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rows.map(row => {
                            const expanded = expandedRows.has(row._key);
                            const sub = rowSubtotal(row);
                            return (
                                <div
                                    key={row._key}
                                    className={`rounded-2xl border shadow-sm overflow-hidden ${row.paid ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-white border-gray-100'}`}
                                >
                                    {/* 요약 행 (항상 보임) */}
                                    <div className="flex items-center gap-2 px-4 py-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${row.source === '인력사무소' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                                    {row.source === '인력사무소' && row.agency_name ? row.agency_name : row.source}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">{row.grade}</span>
                                                <span className="text-[10px] text-gray-400">{row.headcount}명</span>
                                                <span className="text-[10px] font-bold text-gray-600">{row.daily_wage.toLocaleString()}원</span>
                                                {row.tip > 0 && <span className="text-[10px] text-orange-500 font-bold">+팁{row.tip.toLocaleString()}</span>}
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${row.payment_method === '현금' ? 'bg-green-50 text-green-600' : row.payment_method === '카드' ? 'bg-indigo-50 text-indigo-600' : 'bg-sky-50 text-sky-600'}`}>
                                                    {row.payment_method}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-orange-600 shrink-0">{sub.toLocaleString()}원</span>
                                        {row.paid
                                            ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                                            : <button
                                                onClick={() => toggleExpand(row._key)}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all shrink-0 ${expanded ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-orange-500'}`}
                                            >
                                                <Pencil className="w-3 h-3" />
                                                {expanded ? '닫기' : '수정'}
                                            </button>
                                        }
                                    </div>

                                    {/* 상세 편집 (펼침) */}
                                    {expanded && !row.paid && (
                                        <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
                                            {/* 출처 + 등급 + 지급방식 */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 mb-1 block">출처</label>
                                                    <select
                                                        value={row.source}
                                                        onChange={e => updateRow(row._key, 'source', e.target.value)}
                                                        className="w-full text-xs font-bold bg-gray-50 border border-gray-100 rounded-xl px-2 py-2 outline-none"
                                                    >
                                                        <option value="인력사무소">인력사무소</option>
                                                        <option value="개별직접">개별직접</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 mb-1 block">등급</label>
                                                    <select
                                                        value={row.grade}
                                                        onChange={e => updateRow(row._key, 'grade', e.target.value)}
                                                        className="w-full text-xs font-bold bg-gray-50 border border-gray-100 rounded-xl px-2 py-2 outline-none"
                                                    >
                                                        {GRADES.map(g => <option key={g}>{g}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 mb-1 block">지급방식</label>
                                                    <select
                                                        value={row.payment_method}
                                                        onChange={e => updateRow(row._key, 'payment_method', e.target.value as PaymentMethod)}
                                                        className="w-full text-xs font-bold bg-gray-50 border border-gray-100 rounded-xl px-2 py-2 outline-none"
                                                    >
                                                        {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* 사무소명 (인력사무소인 경우) */}
                                            {row.source === '인력사무소' && (
                                                <input
                                                    type="text"
                                                    placeholder="사무소명 (예: ○○인력)"
                                                    value={row.agency_name}
                                                    onChange={e => updateRow(row._key, 'agency_name', e.target.value)}
                                                    className="w-full text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none"
                                                />
                                            )}

                                            {/* 인원 × 단가 + 팁 */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 mb-1 block">인원 (명)</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={row.headcount === 0 ? '' : String(row.headcount)}
                                                        onChange={e => {
                                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                                            updateRow(row._key, 'headcount', raw === '' ? 0 : parseInt(raw));
                                                        }}
                                                        onBlur={() => { if (!row.headcount) updateRow(row._key, 'headcount', 1); }}
                                                        className="w-full text-sm font-black text-center bg-gray-50 border border-gray-100 rounded-xl px-2 py-2 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 mb-1 block">단가 (원)</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        placeholder="0"
                                                        value={row.daily_wage ? row.daily_wage.toLocaleString() : ''}
                                                        onChange={e => {
                                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                                            updateRow(row._key, 'daily_wage', raw === '' ? 0 : parseInt(raw));
                                                        }}
                                                        className="w-full text-sm font-black text-right bg-gray-50 border border-gray-100 rounded-xl px-2 py-2 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-orange-400 mb-1 block">팁 (원)</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        placeholder="0"
                                                        value={row.tip ? row.tip.toLocaleString() : ''}
                                                        onChange={e => {
                                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                                            updateRow(row._key, 'tip', raw === '' ? 0 : parseInt(raw));
                                                        }}
                                                        className="w-full text-sm font-black text-right bg-orange-50 border border-orange-100 rounded-xl px-2 py-2 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* 작업명 + 메모 */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 mb-1 block">작업명</label>
                                                    <select
                                                        value={row.work_type}
                                                        onChange={e => updateRow(row._key, 'work_type', e.target.value)}
                                                        className="w-full text-xs bg-gray-50 border border-gray-100 rounded-xl px-2 py-2 outline-none"
                                                    >
                                                        <option value="">선택 안함</option>
                                                        {WORK_TYPES.map(t => <option key={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 mb-1 block">메모</label>
                                                    <input
                                                        type="text" placeholder="특이사항"
                                                        value={row.notes}
                                                        onChange={e => updateRow(row._key, 'notes', e.target.value)}
                                                        className="w-full text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* 소계 + 삭제 */}
                                            <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                                <button
                                                    onClick={() => removeRow(row._key)}
                                                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600 font-bold"
                                                >
                                                    <Trash2 className="w-3 h-3" /> 삭제
                                                </button>
                                                <span className="text-lg font-black text-orange-600">
                                                    {sub.toLocaleString()}원
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── 직원/식구 투입 기록 ── */}
            {workers.length > 0 && (
                <section>
                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-3">
                        <span className="w-1.5 h-4 bg-blue-400 rounded-full" />
                        직원 / 식구 투입
                        <span className="text-[9px] text-gray-400 font-normal">(월급 별도 처리)</span>
                    </h2>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex flex-wrap gap-2">
                            {workers.map(w => (
                                <button
                                    key={w.id}
                                    onClick={() => setAttendance(prev => ({ ...prev, [w.id]: !prev[w.id] }))}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${attendance[w.id] ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                >
                                    {attendance[w.id] && <CheckCircle className="w-3.5 h-3.5" />}
                                    {w.name}
                                    <span className={`text-[9px] ${attendance[w.id] ? 'text-blue-200' : 'text-gray-300'}`}>
                                        {w.role === 'family' ? '식구' : w.role === 'foreign' ? '외국인' : '직원'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {Object.values(attendance).some(Boolean) && (
                            <p className="text-[10px] text-blue-400 font-bold mt-3">
                                {workers.filter(w => attendance[w.id]).map(w => w.name).join(', ')} 투입 기록됨
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* ── 합계 요약 ── */}
            {rows.length > 0 && (
                <section className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 mb-0.5">오늘 지급 합계</p>
                            {unpaidTotal < totals.grand && (
                                <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    {(totals.grand - unpaidTotal).toLocaleString()}원 지급완료
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-orange-600">{totals.grand.toLocaleString()}원</p>
                            {unpaidTotal > 0 && unpaidTotal !== totals.grand && (
                                <p className="text-xs text-orange-400 font-bold">미지급 {unpaidTotal.toLocaleString()}원</p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {(Object.entries(totals.byMethod) as [PaymentMethod, number][]).map(([method, amount]) =>
                            amount > 0 && (
                                <div key={method} className="bg-white rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 border border-orange-100">
                                    {method}: <span className="text-orange-600">{amount.toLocaleString()}원</span>
                                </div>
                            )
                        )}
                    </div>
                </section>
            )}

            {/* ── 하단 버튼 ── */}
            <div className="fixed bottom-16 md:bottom-4 left-0 right-0 px-4 md:left-56 z-30 pointer-events-none">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-lg border border-gray-100 flex gap-2 pointer-events-auto">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black active:scale-95 transition-all disabled:opacity-50
                                ${savedFlash ? 'bg-green-500 text-white' : 'bg-gray-800 text-white'}`}
                        >
                            <Save className="w-4 h-4" />
                            {savedFlash ? '저장됨 ✓' : '저장'}
                        </button>
                        {unpaidTotal > 0 && (
                            <button
                                onClick={handlePay}
                                disabled={saving}
                                className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-orange-500 text-white rounded-xl text-sm font-black active:scale-95 transition-transform disabled:opacity-50 shadow-md shadow-orange-100"
                            >
                                <CheckCircle className="w-4 h-4" />
                                지급완료 → 지출 등록
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
