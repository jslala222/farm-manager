"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Minus, Trash2, Sprout, Clock, History, Edit2, X, Check, BarChart3, CalendarDays, RefreshCcw, NotebookPen, LayoutGrid, ChevronRight, ChevronLeft } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, FarmHouse, HarvestRecord } from "@/lib/supabase";
import Calendar from "@/components/Calendar";

// [bkit] 기록 필터링 및 그룹화 헬퍼 함수
function bkit_filtered_diaries(diaries: any[], houseFilter: number | null) {
    return diaries
        .filter(d => !houseFilter || d.house_number === houseFilter)
        .reduce((acc: Record<string, any[]>, curr: any) => {
            if (!acc[curr.date]) acc[curr.date] = [];
            acc[curr.date].push(curr);
            return acc;
        }, {});
}

const getLocalISOString = (date: Date) => {
    const offset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(date.getTime() + offset);
    return kstDate.toISOString().split('T')[0];
};

export default function HarvestPage() {
    const { farm, initialized } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'record' | 'analysis' | 'history'>('record');

    // Data State
    const [houses, setHouses] = useState<FarmHouse[]>([]);
    const [history, setHistory] = useState<HarvestRecord[]>([]);
    const [pageError, setPageError] = useState<string | null>(null);

    // Record State
    const [selectedHouse, setSelectedHouse] = useState<number | null>(null);
    const [selectedGrade, setSelectedGrade] = useState<'sang' | 'jung' | 'ha'>('sang');
    const [quantity, setQuantity] = useState(1);
    const [houseNotes, setHouseNotes] = useState<Record<number, string>>({}); // 동별 메모 저장 객체
    const harvestNote = selectedHouse ? (houseNotes[selectedHouse] || "") : ""; // 현재 선택된 동의 메모
    const [selectedDate, setSelectedDate] = useState(() => getLocalISOString(new Date()));
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDiaryModalOpen, setIsDiaryModalOpen] = useState(false); // 일지 작성 모달 상태
    const [isArchiveOpen, setIsArchiveOpen] = useState(false); // 아카이브 모달 상태
    const [allDiaries, setAllDiaries] = useState<any[]>([]); // 전체 일지 데이터
    const [isHouseHistoryOpen, setIsHouseHistoryOpen] = useState(false); // 동별 히스토리 모달 상태
    const [houseHistory, setHouseHistory] = useState<any[]>([]); // 특정 동의 기록 데이터
    const [archiveHouseFilter, setArchiveHouseFilter] = useState<number | null>(null); // 아카이브 내 동별 필터
    const [harvestedDates, setHarvestedDates] = useState<Record<string, number[]>>({}); // 수확 활동이 있는 날짜들

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editHouse, setEditHouse] = useState<number>(0);
    const [editGrade, setEditGrade] = useState<'sang' | 'jung' | 'ha'>('sang');
    const [editQuantity, setEditQuantity] = useState<number>(0);
    const [editDate, setEditDate] = useState("");
    // 수확 기록 수정 팝업 모달
    const [harvestEditModal, setHarvestEditModal] = useState<HarvestRecord | null>(null);

    // Analysis State
    const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [statsDate, setStatsDate] = useState(new Date().toISOString().split('T')[0]); // 지정일 통계용 날짜
    const [statsWeekStart, setStatsWeekStart] = useState<string>(""); // 주간 통계 시작일
    const [statsMonth, setStatsMonth] = useState<{ year: number, month: number }>({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1
    }); // 월간 통계용 연/월
    const [houseStats, setHouseStats] = useState<Record<number, number>>({});
    const [dateStats, setDateStats] = useState<Record<string, number>>({});
    const [gradeStats, setGradeStats] = useState<Record<string, number>>({ sang: 0, jung: 0, ha: 0 });
    const [dateGradeStats, setDateGradeStats] = useState<Record<string, Record<string, number>>>({});
    const [houseGradeStats, setHouseGradeStats] = useState<Record<number, Record<string, number>>>({});
    const [totalHarvest, setTotalHarvest] = useState(0);

    useEffect(() => {
        if (activeTab === 'analysis') {
            fetchStats();
        }
    }, [statsPeriod, statsDate, statsWeekStart, statsMonth, activeTab]);

    useEffect(() => {
        if (initialized && farm?.id) {
            fetchDiaries(); // 날짜 변경 시 일지 불러오기
        }
    }, [selectedDate, farm, initialized]);

    useEffect(() => {
        if (initialized) {
            if (farm?.id) {
                setPageError(null);
                fetchHouses();
                fetchHistory();
                fetchHarvestedDates();
                // fetchStats(); // 탭 전환 시에도 호출되도록 변경 필요 시 대응 -> 이제는 analysis 탭의 useEffect에서 처리
            } else {
                setPageError("농장 정보를 불러올 수 없습니다. 권한 승인 대기 또는 로그인 상태를 확인해주세요.");
            }
        }
    }, [farm, initialized]); // activeTab, statsPeriod 제거

    const fetchHouses = async () => {
        const { data } = await supabase
            .from('farm_houses')
            .select('*')
            .eq('farm_id', farm!.id)
            // .eq('is_active', true) // 사장님 요청: 휴작동도 일지 작성을 위해 표시하도록 필터 제거
            .order('house_number');
        setHouses(data ?? []);
    };

    const fetchHistory = async () => {
        if (!farm?.id) return;
        setLoading(true);
        const { data } = await supabase
            .from('harvest_records')
            .select('*')
            .eq('farm_id', farm.id)
            .order('recorded_at', { ascending: false })
            .limit(10);
        setHistory(data ?? []);
        setLoading(false);
    };

    const fetchDiaries = async () => {
        if (!farm?.id) return;
        // 선택된 날짜의 모든 하우스 일지를 가져옴
        const { data } = await supabase
            .from('house_diaries')
            .select('*')
            .eq('farm_id', farm.id)
            .eq('date', selectedDate);

        const diaryMap: Record<number, string> = {};
        data?.forEach(d => {
            diaryMap[d.house_number] = d.note;
        });
        setHouseNotes(diaryMap);
    };

    const fetchAllDiaries = async () => {
        if (!farm?.id) return;
        setLoading(true);
        // 모든 하우스 일지를 날짜 역순으로 가져옴
        const { data } = await supabase
            .from('house_diaries')
            .select('*')
            .eq('farm_id', farm.id)
            .order('date', { ascending: false })
            .order('house_number', { ascending: true });

        setAllDiaries(data ?? []);
        setLoading(false);
    };

    const fetchHouseDiaries = async (houseNum: number) => {
        if (!farm?.id) return;
        setLoading(true);
        // 특정 동의 모든 기록을 역순으로 가져옴
        const { data } = await supabase
            .from('house_diaries')
            .select('*')
            .eq('farm_id', farm.id)
            .eq('house_number', houseNum)
            .order('date', { ascending: false });

        setHouseHistory(data ?? []);
        setLoading(false);
    };

    const fetchHarvestedDates = async () => {
        if (!farm?.id) return;
        // 모든 수확 기록을 가져와서 날짜와 동 번호를 매핑 (성능 최적화를 위해 특정 범위만 가져올 수도 있음)
        const { data } = await supabase
            .from('harvest_records')
            .select('recorded_at, house_number')
            .eq('farm_id', farm.id);

        if (!data) return;

        const dateMap: Record<string, number[]> = {};
        data.forEach(item => {
            const date = item.recorded_at.split('T')[0];
            if (!dateMap[date]) dateMap[date] = [];
            if (!dateMap[date].includes(item.house_number)) {
                dateMap[date].push(item.house_number);
            }
        });
        setHarvestedDates(dateMap);
    };

    const fetchStats = async () => {
        if (!farm?.id) return;

        let query = supabase
            .from('harvest_records')
            .select('quantity, grade, house_number, recorded_at')
            .eq('farm_id', farm.id);

        const now = new Date();
        if (statsPeriod === 'today') {
            const today = getLocalISOString(new Date());
            query = query.gte('recorded_at', `${today}T00:00:00+09:00`).lte('recorded_at', `${today}T23:59:59+09:00`);
        } else if (statsPeriod === 'week') {
            // 주간 통계 로직 (일요일부터 토요일까지)
            let start = statsWeekStart;
            if (!start) {
                const d = new Date();
                const day = d.getDay();
                const diff = d.getDate() - day; // 이번 주 일요일로 이동
                const sunday = new Date(d.setDate(diff));
                start = getLocalISOString(sunday);
            }
            const startDate = new Date(start);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            const end = getLocalISOString(endDate);
            query = query.gte('recorded_at', `${start}T00:00:00+09:00`).lte('recorded_at', `${end}T23:59:59+09:00`);
        } else if (statsPeriod === 'month') {
            // 월간 통계 로직
            const start = `${statsMonth.year}-${String(statsMonth.month).padStart(2, '0')}-01`;
            const lastDay = new Date(statsMonth.year, statsMonth.month, 0).getDate();
            const end = `${statsMonth.year}-${String(statsMonth.month).padStart(2, '0')}-${lastDay}`;
            query = query.gte('recorded_at', `${start}T00:00:00+09:00`).lte('recorded_at', `${end}T23:59:59+09:00`);
        } else if (statsPeriod === 'custom') {
            query = query.gte('recorded_at', `${statsDate}T00:00:00+09:00`).lte('recorded_at', `${statsDate}T23:59:59+09:00`);
        }

        const { data } = await query;
        if (!data) return;

        // Aggregate Stats
        const hStats: Record<number, number> = {};
        const dStats: Record<string, number> = {};
        const gStats: Record<string, number> = { sang: 0, jung: 0, ha: 0 };
        const dgStats: Record<string, Record<string, number>> = {};
        const hgStats: Record<number, Record<string, number>> = {};
        let total = 0;

        data.forEach(item => {
            // House Stats
            hStats[item.house_number] = (hStats[item.house_number] || 0) + item.quantity;

            // Date Stats
            const date = new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
            dStats[date] = (dStats[date] || 0) + item.quantity;

            // Grade Stats
            gStats[item.grade] = (gStats[item.grade] || 0) + item.quantity;

            // Date + Grade Stats
            if (!dgStats[date]) dgStats[date] = { sang: 0, jung: 0, ha: 0 };
            dgStats[date][item.grade] += item.quantity;

            // House + Grade Stats
            if (!hgStats[item.house_number]) hgStats[item.house_number] = { sang: 0, jung: 0, ha: 0 };
            hgStats[item.house_number][item.grade] += item.quantity;

            total += item.quantity;
        });

        setHouseStats(hStats);
        setDateStats(dStats);
        setGradeStats(gStats);
        setDateGradeStats(dgStats);
        setHouseGradeStats(hgStats);
        setTotalHarvest(total);
    };

    const handleSave = async () => {
        if (!selectedHouse || !farm?.id) {
            alert("하우스 동을 선택해주세요!");
            return;
        }

        // 선택된 하우스의 정보 확인 (휴작 여부 체크 및 작물 정보 획득)
        const selectedHouseData = houses.find(h => h.house_number === selectedHouse);
        if (selectedHouseData && !selectedHouseData.is_active) {
            const confirmHarvest = confirm(`⚠️ 현재 이 동은 '휴작' 상태입니다. 그래도 수확 기록을 남기시겠습니까?`);
            if (!confirmHarvest) return;
        }

        setSaving(true);
        const currentCrop = selectedHouseData?.current_crop || '딸기';

        // Combine date with current time to preserve order if multiple entries on same day
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0]; // HH:MM:SS
        const dateTime = `${selectedDate}T${timeString}`;

        const { error } = await supabase.from('harvest_records').insert({
            farm_id: farm.id,
            house_number: selectedHouse,
            grade: selectedGrade,
            quantity,
            crop_name: currentCrop, // 작물 이름 스냅샷 저장
            recorded_at: new Date(dateTime).toISOString()
        });
        if (error) {
            alert(`저장 실패: ${error.message}`);
        } else {
            alert(`✅ 저장 완료!\n${selectedDate}\n${selectedHouse}동 / ${gradeLabel(selectedGrade)} / ${quantity}박스`);
            setQuantity(1);
            // 메모 초기화하지 않고 유지 (사용자 피드백 반영: 하루는 유지되어야 함)
            fetchHistory();
            fetchHarvestedDates(); // 수확 후 달력 업데이트
        }
        setSaving(false);
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        setSaving(true);

        // For update, we might want to keep original time or update date. 
        // Simple approach: if date changed, use that date + current time or 12:00.
        // But for now, let's keep it simple and just update fields. 
        // If editDate is implemented, we use it.

        let updateData: any = {
            house_number: editHouse,
            grade: editGrade,
            quantity: editQuantity
        };

        if (editDate) {
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0];
            updateData.recorded_at = new Date(`${editDate}T${timeString}`).toISOString();
        }

        const { error } = await supabase.from('harvest_records').update(updateData).eq('id', editingId);

        if (error) alert("수정 실패");
        else {
            setEditingId(null);
            // 수정 후 통계 및 메모 다시 불러오기 (정합성 유지)
            fetchHistory();
            fetchStats();
        }
        setSaving(false);
    };

    const handleUpdateNote = async () => {
        if (!selectedHouse || !farm?.id) {
            alert("농장 정보 또는 하우스가 선택되지 않았습니다.");
            return;
        }
        setSaving(true);

        try {
            // house_diaries 테이블에 Upsert (동별/날짜별 유일한 일지 유지 및 수시 수정)
            const { error } = await supabase
                .from('house_diaries')
                .upsert({
                    farm_id: farm.id,
                    house_number: selectedHouse,
                    date: selectedDate,
                    note: harvestNote
                }, { onConflict: 'farm_id,house_number,date' });

            if (error) {
                console.error("[Diary] Save error:", error);
                alert(`일지 저장 실패: ${error.message} (날짜: ${selectedDate})`);
            } else {
                alert(`✅ ${selectedDate} 현장 리포트가 저장되었습니다.`);
                fetchDiaries(); // 최신 데이터 다시 불러오기
            }
        } catch (err: any) {
            console.error("[Diary] Unexpected error:", err);
            alert(`일지 저장 중 예기치 못한 오류 발생: ${err.message || err.toString()}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("이 기록을 삭제하시겠습니까?")) return;
        const { error } = await supabase.from('harvest_records').delete().eq('id', id);
        if (error) alert("삭제 실패");
        else {
            fetchHistory();
            fetchHarvestedDates(); // 삭제 후 달력 업데이트
        }
    };

    const startEdit = (item: HarvestRecord) => {
        setEditingId(item.id);
        setEditHouse(item.house_number);
        setEditGrade(item.grade);
        setEditQuantity(item.quantity);
        setEditDate(item.recorded_at.split('T')[0]); // YYYY-MM-DD
    };

    const gradeLabel = (g: string) => ({ sang: '특/상', jung: '중', ha: '하' }[g] ?? g);
    const gradeColor = (g: string) => ({ sang: 'text-red-600 bg-red-50', jung: 'text-orange-600 bg-orange-50', ha: 'text-yellow-600 bg-yellow-50' }[g] ?? 'text-gray-600 bg-gray-50');

    return (
        <div className="p-4 md:p-3 pb-20 max-w-2xl mx-auto space-y-3 animate-in fade-in duration-500">
            <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 bg-green-100 rounded-xl shadow-lg shadow-green-100 shrink-0">
                        <Sprout className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight whitespace-nowrap">수확 관리</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Harvest Tracking</p>
                    </div>
                </div>

                {/* 탭 전환 버튼 */}
                <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
                    <button onClick={() => setActiveTab('record')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'record' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                        수확하기
                    </button>
                    <button onClick={() => {
                        setActiveTab('history');
                        fetchAllDiaries();
                    }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                        영농일지
                    </button>
                    <button onClick={() => setActiveTab('analysis')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'analysis' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                        통계보기
                    </button>
                </div>
            </div>

            {pageError && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
                    <div className="bg-red-100 p-2 rounded-xl shrink-0"><BarChart3 className="w-5 h-5 text-red-600" /></div>
                    <div>
                        <p className="text-red-800 font-bold text-sm leading-tight">{pageError}</p>
                        <p className="text-red-600 text-[10px] mt-1">관리자 승인이 필요할 수 있습니다.</p>
                    </div>
                </div>
            )}

            {activeTab === 'record' ? (
                /* === 기록 뷰 (전문가 대안: 클린 UI) === */
                <div className="space-y-3 animate-in slide-in-from-left-4 duration-300">
                    {/* 상단: 오늘의 하우스 컨디션 요약 (사장님 요청 대안) */}
                    {Object.keys(houseNotes).length > 0 && (
                        <div className="bg-blue-50/50 rounded-3xl border border-blue-100 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                                    <NotebookPen className="w-4 h-4" /> 오늘의 하우스 컨디션 리포트
                                </h2>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className="text-[10px] font-black text-blue-500 bg-white px-2.5 py-1 rounded-lg shadow-sm border border-blue-100 hover:bg-blue-50 transition-colors uppercase tracking-tighter"
                                >
                                    더 보기
                                </button>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {Object.entries(houseNotes).sort((a, b) => Number(a[0]) - Number(b[0])).map(([house, note]) => (
                                    <button
                                        key={house}
                                        onClick={() => {
                                            setSelectedHouse(Number(house));
                                            setIsDiaryModalOpen(true);
                                        }}
                                        className="bg-white p-3 rounded-2xl border border-blue-50 shadow-sm min-w-[140px] text-left group hover:border-blue-300 transition-all shrink-0"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-lg">{house}동</span>
                                            <Edit2 className="w-2.5 h-2.5 text-gray-300 group-hover:text-blue-400" />
                                        </div>
                                        <p className="text-[11px] text-gray-600 line-clamp-2 font-medium leading-relaxed">{note}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 날짜 선택 및 수기 기록 폼 통합 카드 */}
                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-3 space-y-8">
                            {/* 섹션 1: 날짜 및 하우스 */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                        하우스 및 날짜 선택
                                    </h2>
                                </div>

                                <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                                    <Calendar
                                        selectedDate={selectedDate}
                                        onChange={(date) => setSelectedDate(date)}
                                        harvestedDates={harvestedDates}
                                    />
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {houses.length === 0 ? (
                                        <div className="col-span-2 sm:col-span-4 py-8 flex flex-col items-center gap-3">
                                            <p className="text-xs text-slate-400 font-bold">하우스 정보가 로드되지 않았습니다.</p>
                                            <button
                                                onClick={() => fetchHouses()}
                                                className="px-6 py-2.5 bg-blue-50 text-blue-600 text-xs font-black rounded-2xl border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-all active:scale-95"
                                            >
                                                <RefreshCcw className="w-4 h-4" /> 정보 다시 불러오기
                                            </button>
                                        </div>
                                    ) : (
                                        houses.map((h) => {
                                            const isSelected = selectedHouse === h.house_number;
                                            const isStrawberry = [1, 2, 3].includes(h.house_number);
                                            const isFallow = !h.is_active;

                                            let colorClass = "";
                                            if (isSelected) {
                                                if (isStrawberry) {
                                                    colorClass = "bg-red-600 text-white border-red-700 shadow-lg shadow-red-100 scale-105";
                                                } else if (h.house_number === 6) {
                                                    colorClass = "bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-100 scale-105";
                                                } else if (h.house_number === 7) {
                                                    colorClass = "bg-sky-500 text-white border-sky-600 shadow-lg shadow-sky-100 scale-105";
                                                } else if (h.house_number === 8) {
                                                    colorClass = "bg-indigo-500 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-105";
                                                } else if (isFallow) {
                                                    colorClass = "bg-gray-600 text-white border-gray-700 shadow-lg shadow-gray-100 scale-105";
                                                } else {
                                                    colorClass = "bg-green-600 text-white border-green-700 shadow-lg shadow-green-100 scale-105";
                                                }
                                            } else {
                                                if (isFallow) colorClass = "bg-gray-50 border-gray-100 text-gray-300 opacity-60";
                                                else colorClass = "bg-white border-gray-100 text-gray-900 hover:border-gray-200";
                                            }

                                            return (
                                                <button
                                                    key={h.id}
                                                    onClick={() => setSelectedHouse(h.house_number)}
                                                    className={`h-16 rounded-2xl transition-all flex flex-col items-center justify-center border leading-none gap-1 ${colorClass}`}
                                                >
                                                    <span className="text-xl font-black">{h.house_number}</span>
                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? 'opacity-90' : 'opacity-60'}`}>
                                                        {h.current_crop || (h.is_active ? '딸기' : '휴작')}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {selectedHouse && (
                                    <div className="flex items-center justify-between bg-gray-50/50 p-3 rounded-2xl border border-dashed border-gray-200 animate-in fade-in zoom-in-95">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex flex-col items-center justify-center border border-green-50">
                                                <span className="text-[10px] font-black text-green-600 leading-none">{selectedHouse}동</span>
                                                <span className="text-[7px] font-bold text-gray-400 tracking-tighter mt-0.5">{houses.find(h => h.house_number === selectedHouse)?.current_crop || '딸기'}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    fetchHouseDiaries(selectedHouse);
                                                    setIsHouseHistoryOpen(true);
                                                }}
                                                className="text-[10px] font-black text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                                            >
                                                <History className="w-3 h-3" /> 과거 기록 추적
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setIsDiaryModalOpen(true)}
                                            className="bg-white px-3 py-1.5 rounded-xl shadow-sm text-[10px] font-black text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                            기록하기
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 섹션 2: 등급 및 수량 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                                <div className="space-y-4">
                                    <h2 className="text-sm font-black text-gray-900 flex items-center gap-2 px-1">
                                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                                        등급 선택
                                    </h2>
                                    <div className="space-y-2">
                                        {(['sang', 'jung', 'ha'] as const).map((g) => (
                                            <button
                                                key={g}
                                                onClick={() => setSelectedGrade(g)}
                                                className={`w-full py-3.5 px-4 rounded-2xl text-[11px] font-black flex items-center justify-between transition-all border ${selectedGrade === g
                                                    ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm ring-1 ring-orange-200'
                                                    : 'bg-white border-gray-50 text-gray-400 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {gradeLabel(g)}
                                                {selectedGrade === g && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4 flex flex-col items-center">
                                    <h2 className="text-sm font-black text-gray-900 flex items-center gap-2 self-start px-1">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                        수량 (BOX)
                                    </h2>
                                    <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full">
                                        <div className="relative w-full max-w-full sm:max-w-[200px]">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={quantity}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                                    setQuantity(val === '' ? 0 : parseInt(val));
                                                }}
                                                className="w-full p-3 bg-white border-2 border-green-100 rounded-[2rem] text-2xl sm:text-4xl font-black text-center text-green-600 outline-none focus:border-green-500 transition-all shadow-sm"
                                            />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black text-green-200">BOX</span>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Enter Quantity</span>
                                    </div>
                                </div>
                            </div>

                            {/* 저장 버튼 */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full bg-green-600 text-white h-16 rounded-[24px] text-lg font-black shadow-xl shadow-green-100 hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {saving ? '저장 중...' : '기록 저장하기'}
                            </button>
                        </div>
                    </div>

                    {/* 일지 작성 모달 (사장님 요청 대안) */}
                    {isDiaryModalOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                                <div className="p-4 pb-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                            <NotebookPen className="w-6 h-6 text-blue-500" />
                                            {selectedHouse}동 현장 리포트
                                        </h3>
                                        <p className="text-[10px] text-blue-400 font-bold mt-1 uppercase tracking-widest leading-none">Field Management Diary</p>
                                    </div>
                                    <button onClick={() => setIsDiaryModalOpen(false)} className="p-2 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-tighter ml-1">오늘의 하우스 컨실션 및 특이사항</label>
                                        <textarea
                                            value={houseNotes[selectedHouse!] || ""}
                                            onChange={(e) => {
                                                if (selectedHouse) {
                                                    setHouseNotes(prev => ({
                                                        ...prev,
                                                        [selectedHouse]: e.target.value
                                                    }));
                                                }
                                            }}
                                            placeholder="하우스 온도, 과실 발육 상태, 알박기 작업 등 사장님께 필요한 중요 내용을 기록하세요..."
                                            className="w-full p-3 bg-gray-50 border-none rounded-[32px] text-base sm:text-lg font-bold h-32 sm:h-48 outline-none focus:ring-4 focus:ring-blue-50 transition-all resize-none shadow-inner"
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setIsDiaryModalOpen(false)}
                                            className="flex-1 py-4.5 bg-gray-50 text-gray-400 text-xs font-black rounded-3xl hover:bg-gray-100 transition-colors"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await handleUpdateNote();
                                                setIsDiaryModalOpen(false);
                                            }}
                                            disabled={saving}
                                            className="flex-[2] py-4.5 bg-blue-600 text-white text-xs font-black rounded-3xl shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Check className="w-4 h-4" />
                                            리포트 저장
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 일지 아카이브 모달 (사장님 요청: 날짜별 모아보기) */}
                    {isArchiveOpen && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-gray-50 w-full max-w-md h-[80vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                                <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                            <History className="w-6 h-6 text-blue-600" />
                                            현장 리포트 아카이브
                                        </h3>
                                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest leading-none">Field Report History</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={archiveHouseFilter || ""}
                                            onChange={(e) => setArchiveHouseFilter(e.target.value ? Number(e.target.value) : null)}
                                            className="text-xs font-black bg-gray-50 border-none rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                                        >
                                            <option value="">전체</option>
                                            {houses.map(h => (
                                                <option key={h.id} value={h.house_number}>{h.house_number}동</option>
                                            ))}
                                        </select>
                                        <button onClick={() => {
                                            setIsArchiveOpen(false);
                                            setArchiveHouseFilter(null);
                                        }} className="p-2 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                                            <X className="w-5 h-5 text-gray-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                            <RefreshCcw className="w-8 h-8 animate-spin opacity-20" />
                                            <span className="text-xs font-bold">기록을 불러오는 중...</span>
                                        </div>
                                    ) : allDiaries.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                                            <NotebookPen className="w-12 h-12 opacity-10" />
                                            <span className="text-xs font-bold">기록된 일지가 없습니다.</span>
                                        </div>
                                    ) : (
                                        /* 날짜별로 그룹화하여 표시 (필터 적용) */
                                        Object.entries(
                                            allDiaries
                                                .filter(d => !archiveHouseFilter || d.house_number === archiveHouseFilter)
                                                .reduce((acc: Record<string, any[]>, curr: any) => {
                                                    if (!acc[curr.date]) acc[curr.date] = [];
                                                    acc[curr.date].push(curr);
                                                    return acc;
                                                }, {} as Record<string, any[]>)
                                        ).sort((a: [string, any[]], b: [string, any[]]) => b[0].localeCompare(a[0])).map(([date, diaries]: [string, any[]]) => (
                                            <div key={date} className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-px bg-gray-200 flex-1"></div>
                                                    <span className="text-[11px] font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{date}</span>
                                                    <div className="h-px bg-gray-200 flex-1"></div>
                                                </div>
                                                <div className="grid gap-2">
                                                    {(diaries as any[]).sort((a: any, b: any) => a.house_number - b.house_number).map((d: any) => (
                                                        <div key={d.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-2 group">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{d.house_number}동 리포트</span>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedDate(d.date);
                                                                        setSelectedHouse(d.house_number);
                                                                        setIsArchiveOpen(false);
                                                                        setIsDiaryModalOpen(true);
                                                                    }}
                                                                    className="p-1.5 opacity-0 group-hover:opacity-100 bg-gray-50 rounded-lg text-gray-400 hover:text-blue-500 transition-all"
                                                                >
                                                                    <Edit2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <p className="text-base text-gray-700 leading-relaxed font-bold">
                                                                {d.note}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="p-3 bg-white border-t border-gray-100 shrink-0">
                                    <button
                                        onClick={() => setIsArchiveOpen(false)}
                                        className="w-full py-4 bg-gray-900 text-white text-sm font-black rounded-[24px] shadow-xl shadow-gray-100"
                                    >
                                        확인 완료
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 동별 히스토리 모달 (사장님 요청: 특정 동 집중 보기) */}
                    {isHouseHistoryOpen && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-white w-full max-w-sm h-[70vh] rounded-[48px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-20 duration-500">
                                <div className="p-4 pb-4 flex items-center justify-between shrink-0">
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                            <History className="w-6 h-6 text-green-600" />
                                            {selectedHouse}동 히스토리
                                        </h3>
                                        <p className="text-[10px] text-green-500 font-bold mt-1 uppercase tracking-widest leading-none">House Management History</p>
                                    </div>
                                    <button onClick={() => setIsHouseHistoryOpen(false)} className="p-2 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                            <RefreshCcw className="w-8 h-8 animate-spin opacity-20" />
                                            <span className="text-xs font-bold">기록을 불러오는 중...</span>
                                        </div>
                                    ) : houseHistory.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                                            <NotebookPen className="w-12 h-12 opacity-10" />
                                            <span className="text-xs font-bold text-center">해당 동의 기록이 없습니다.</span>
                                        </div>
                                    ) : (
                                        houseHistory.map((h: any) => (
                                            <div key={h.id} className="relative pl-6 pb-6 border-l-2 border-gray-50 last:pb-0">
                                                <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-200"></div>
                                                <div className="space-y-2">
                                                    <span className="text-[11px] font-black text-gray-400 font-mono tracking-tighter">{h.date}</span>
                                                    <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100/50 group hover:border-green-200 transition-all">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="w-1.5 h-1.5 bg-green-200 rounded-full"></div>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedDate(h.date);
                                                                    setIsHouseHistoryOpen(false);
                                                                    setIsDiaryModalOpen(true);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 bg-white rounded-lg shadow-sm text-gray-400 hover:text-green-600 transition-all"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <p className="text-base text-gray-600 leading-relaxed font-black">{h.note}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="p-4 pt-0 shrink-0">
                                    <button
                                        onClick={() => setIsHouseHistoryOpen(false)}
                                        className="w-full py-5 bg-gray-900 text-white text-xs font-black rounded-3xl shadow-xl shadow-gray-200"
                                    >
                                        기록 확인 완료
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 최근 내역 */}
                    <section className="pt-4">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-sm font-bold text-gray-500 flex items-center gap-2 uppercase tracking-wide">
                                <History className="w-4 h-4" /> Recent History
                            </h2>
                        </div>
                        <div className="space-y-3">
                            {history.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 text-gray-300 text-xs font-bold">
                                    기록이 없습니다.
                                </div>
                            ) : (
                                history.map((item) => {
                                    const isEditing = editingId === item.id;
                                    if (isEditing) {
                                        return (
                                            <div key={item.id} className="bg-white rounded-2xl border-2 border-green-200 p-4 shadow-lg space-y-3 animate-in fade-in">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold outline-none" />
                                                        <select value={editHouse} onChange={(e) => setEditHouse(Number(e.target.value))} className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold outline-none">{houses.map(h => <option key={h.id} value={h.house_number}>{h.house_number}동</option>)}</select>
                                                        <select value={editGrade} onChange={(e) => setEditGrade(e.target.value as any)} className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold outline-none"><option value="sang">특/상</option><option value="jung">중</option><option value="ha">하</option></select>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setEditQuantity(Math.max(1, editQuantity - 1))} className="p-1 bg-gray-100 rounded-lg"><Minus className="w-3 h-3" /></button>
                                                        <span className="text-sm font-black w-6 text-center">{editQuantity}</span>
                                                        <button onClick={() => setEditQuantity(editQuantity + 1)} className="p-1 bg-green-100 rounded-lg"><Plus className="w-3 h-3 text-green-600" /></button>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={handleUpdate} className="flex-1 bg-gray-900 text-white py-2 rounded-lg font-bold text-xs">수정</button>
                                                    <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-100 text-gray-500 py-2 rounded-lg font-bold text-xs">취소</button>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <button key={item.id}
                                            onClick={() => setHarvestEditModal(item)}
                                            className="w-full text-left bg-white rounded-2xl border border-gray-50 p-2.5 px-4 shadow-sm flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300 active:scale-[0.98] hover:border-green-200 transition-all">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="flex items-center gap-2 min-w-[60px]">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">House</span>
                                                    <span className="text-sm font-black text-gray-900">{item.house_number}</span>
                                                </div>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border whitespace-nowrap ${gradeColor(item.grade)}`}>
                                                        {gradeLabel(item.grade)}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-base font-black text-gray-900 tracking-tighter">{item.quantity}</span>
                                                        <span className="text-[9px] text-gray-400 font-black uppercase">Box</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-0.5 bg-gray-50/50 px-2.5 py-1.5 rounded-xl border border-gray-100/50">
                                                    <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                                                        <CalendarDays className="w-2.5 h-2.5" />
                                                        {new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-900 font-black">
                                                        <Clock className="w-2.5 h-2.5 text-green-500" />
                                                        {new Date(item.recorded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <Edit2 className="w-3.5 h-3.5 text-gray-200 ml-4 shrink-0" />
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </div>
            ) : activeTab === 'history' ? (
                /* === 전체 기록 뷰 (아카이브 통합) === */
                <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-white border-b border-gray-100 flex items-center justify-between p-2 rounded-2xl shadow-sm">
                        <div>
                            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 px-2 py-1">
                                <History className="w-4 h-4 text-blue-600" />
                                영농일지 아카이브
                            </h3>
                        </div>
                        <select
                            value={archiveHouseFilter || ""}
                            onChange={(e) => setArchiveHouseFilter(e.target.value ? Number(e.target.value) : null)}
                            className="text-[10px] font-black bg-gray-50 border-none rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                        >
                            <option value="">전체 하우스</option>
                            {houses.map(h => (
                                <option key={h.id} value={h.house_number}>{h.house_number}동</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                                <RefreshCcw className="w-8 h-8 animate-spin opacity-20" />
                                <span className="text-xs font-bold">기록을 불러오는 중...</span>
                            </div>
                        ) : allDiaries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2 bg-white rounded-3xl border-2 border-dashed border-gray-50">
                                <NotebookPen className="w-12 h-12 opacity-10" />
                                <span className="text-xs font-bold">기록된 일지가 없습니다.</span>
                            </div>
                        ) : (
                            Object.entries(
                                bkit_filtered_diaries(allDiaries, archiveHouseFilter) as Record<string, any[]>
                            ).sort((a, b) => b[0].localeCompare(a[0])).map(([date, diaries]) => (
                                <div key={date} className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-px bg-gray-200 flex-1"></div>
                                        <span className="text-[11px] font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{date}</span>
                                        <div className="h-px bg-gray-200 flex-1"></div>
                                    </div>
                                    <div className="grid gap-2">
                                        {(diaries as any[]).sort((a: any, b: any) => a.house_number - b.house_number).map((d: any) => (
                                            <div key={d.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2 group hover:border-blue-200 transition-all">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{d.house_number}동 리포트</span>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDate(d.date);
                                                            setSelectedHouse(d.house_number);
                                                            setActiveTab('record');
                                                            setIsDiaryModalOpen(true);
                                                        }}
                                                        className="p-1.5 opacity-0 group-hover:opacity-100 bg-gray-50 rounded-lg text-gray-400 hover:text-blue-500 transition-all"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <p className="text-base text-gray-900 leading-relaxed font-black">
                                                    {d.note}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                /* === 통계 뷰 === */
                <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto scrollbar-hide gap-1">
                        {(['today', 'custom', 'week', 'month'] as const).map((p) => (
                            <button key={p}
                                onClick={() => {
                                    setStatsPeriod(p);
                                    if (p === 'week') {
                                        const d = new Date();
                                        const day = d.getDay();
                                        const diff = d.getDate() - day;
                                        const sunday = new Date(d.setDate(diff));
                                        setStatsWeekStart(getLocalISOString(sunday));
                                    }
                                }}
                                className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-black transition-all whitespace-nowrap ${statsPeriod === p ? 'bg-white shadow-sm text-green-600' : 'text-gray-400'}`}>
                                {p === 'today' ? '오늘' : p === 'custom' ? '지정일' : p === 'week' ? '이번 주' : '이번 달'}
                            </button>
                        ))}
                    </div>

                    {statsPeriod === 'custom' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                            <Calendar
                                selectedDate={statsDate}
                                onChange={(date) => setStatsDate(date)}
                                harvestedDates={harvestedDates}
                            />
                        </div>
                    )}

                    {statsPeriod === 'week' && (
                        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Weekly Navigation</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            const d = new Date(statsWeekStart || new Date());
                                            d.setDate(d.getDate() - 7);
                                            setStatsWeekStart(d.toISOString().split('T')[0]);
                                        }}
                                        className="p-1.5 bg-gray-50 rounded-lg text-gray-400 hover:text-gray-900"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const d = new Date();
                                            const day = d.getDay();
                                            const diff = d.getDate() - day;
                                            const sunday = new Date(d.setDate(diff));
                                            setStatsWeekStart(sunday.toISOString().split('T')[0]);
                                        }}
                                        className="px-2 text-[9px] font-black bg-gray-50 rounded-lg text-gray-500"
                                    >
                                        이번 주
                                    </button>
                                    <button
                                        onClick={() => {
                                            const d = new Date(statsWeekStart || new Date());
                                            d.setDate(d.getDate() + 7);
                                            setStatsWeekStart(d.toISOString().split('T')[0]);
                                        }}
                                        className="p-1.5 bg-gray-50 rounded-lg text-gray-400 hover:text-gray-900"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2 min-w-max pb-1">
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date(statsWeekStart || (() => {
                                        const now = new Date();
                                        const day = now.getDay();
                                        const diff = now.getDate() - day;
                                        return new Date(now.setDate(diff));
                                    })());
                                    d.setDate(d.getDate() + i);
                                    const dateStr = d.toISOString().split('T')[0];
                                    const hasHarvest = (harvestedDates[dateStr] || []).length > 0;
                                    const hList = harvestedDates[dateStr] || [];
                                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                                    return (
                                        <div key={i} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 min-w-[56px] ${isToday ? 'border-red-400 bg-orange-50/30' : 'border-gray-50 bg-white'}`}>
                                            <span className="text-[10px] font-black text-gray-300 uppercase">
                                                {['일', '월', '화', '수', '목', '금', '토'][i]}
                                            </span>
                                            <span className={`text-base font-black ${isToday ? 'text-red-600' : 'text-gray-900'}`}>
                                                {d.getDate()}
                                            </span>
                                            <div className="flex gap-0.5 mt-1 h-1.5 flex-wrap justify-center">
                                                {hList.slice(0, 6).map(hNum => {
                                                    const hColors: Record<number, string> = {
                                                        1: "bg-red-400", 2: "bg-red-400", 3: "bg-red-400",
                                                        6: "bg-orange-400", 7: "bg-sky-400", 8: "bg-indigo-400"
                                                    };
                                                    return <div key={hNum} className={`w-1.5 h-1.5 rounded-full ${hColors[hNum] || "bg-green-400"} shadow-sm`} />;
                                                })}
                                                {hList.length > 6 && <div className="text-[6px] font-bold text-gray-400 leading-none">+</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {statsPeriod === 'month' && (
                        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
                            <div className="flex items-center gap-3 mb-4">
                                <button
                                    onClick={() => setStatsMonth({ ...statsMonth, year: statsMonth.year - 1 })}
                                    className="p-2 hover:bg-gray-50 rounded-xl"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                                </button>
                                <span className="text-sm font-black text-gray-900">{statsMonth.year}년</span>
                                <button
                                    onClick={() => setStatsMonth({ ...statsMonth, year: statsMonth.year + 1 })}
                                    className="p-2 hover:bg-gray-50 rounded-xl"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {Array.from({ length: 12 }).map((_, i) => {
                                    const m = i + 1;
                                    const isSelected = statsMonth.month === m;
                                    const isCurrentMonth = new Date().getFullYear() === statsMonth.year && new Date().getMonth() + 1 === m;

                                    return (
                                        <button
                                            key={m}
                                            onClick={() => setStatsMonth({ ...statsMonth, month: m })}
                                            className={`py-3 rounded-2xl text-xs font-black transition-all border-2 ${isSelected
                                                ? 'bg-green-600 border-green-700 text-white shadow-lg'
                                                : isCurrentMonth
                                                    ? 'bg-white border-red-500 text-red-600'
                                                    : 'bg-white border-gray-50 text-gray-500 hover:border-green-100'
                                                }`}
                                        >
                                            {m}월
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-green-600 rounded-3xl p-5 text-white shadow-xl shadow-green-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <div className="flex justify-between items-start mb-4 gap-2">
                            <div className="min-w-0">
                                <p className="text-green-100 text-xs font-bold uppercase tracking-widest mb-1">Total Harvest</p>
                                <h2 className="text-3xl font-black tracking-tighter truncate">{totalHarvest.toLocaleString()} <span className="text-base font-medium opacity-70">Box</span></h2>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-green-100 font-bold uppercase opacity-60">Grade</p>
                                <div className="space-y-0.5 mt-1">
                                    <p className="text-sm font-black">특/상: {gradeStats.sang}박스</p>
                                    <p className="text-sm font-black">중: {gradeStats.jung}박스</p>
                                    <p className="text-sm font-black text-green-200">하: {gradeStats.ha}박스</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 동별 통계 */}
                    <section className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-gray-400" /> 동별 수확량
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {houses.map(h => {
                                const count = houseStats[h.house_number] || 0;
                                const gBreakdown = houseGradeStats[h.house_number] || { sang: 0, jung: 0, ha: 0 };
                                return (
                                    <div key={h.id} className={`p-3 rounded-[24px] border transition-all ${count > 0 ? 'bg-white border-green-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="text-xs font-black text-gray-400 uppercase tracking-tighter">{h.house_number}동</div>
                                            <div className="text-[9px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded-lg">TOT</div>
                                        </div>
                                        <div className={`text-2xl font-black mb-2 tracking-tighter truncate ${count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                            {count.toLocaleString()}
                                            <span className="text-[10px] font-medium ml-0.5 opacity-40">B</span>
                                        </div>
                                        <div className="space-y-2 pt-3 border-t border-gray-50">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-400">특/상</span>
                                                <span className="text-base font-black text-orange-600">{gBreakdown.sang}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-400">중</span>
                                                <span className="text-base font-black text-blue-600">{gBreakdown.jung}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-400">하</span>
                                                <span className="text-base font-black text-gray-500">{gBreakdown.ha}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* 날짜별 통계 */}
                    {statsPeriod !== 'today' && (
                        <section className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-gray-400" /> 날짜별 추이
                            </h3>
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
                                {Object.keys(dateStats).length === 0 ? (
                                    <div className="text-center py-6 text-xs text-gray-400">데이터가 없습니다.</div>
                                ) : (
                                    Object.entries(dateStats).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, count]) => {
                                        const dg = dateGradeStats[date] || { sang: 0, jung: 0, ha: 0 };
                                        return (
                                            <div key={date} className="flex items-center justify-between p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors rounded-lg">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-500">{date}</span>
                                                    <span className="text-sm text-gray-400 font-bold mt-0.5">
                                                        특 {dg.sang} / 중 {dg.jung} / 하 {dg.ha}
                                                    </span>
                                                </div>
                                                <span className="text-base font-black text-gray-900">{count.toLocaleString()} <span className="text-xs text-gray-400 font-normal">Box</span></span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    )}
                </div>
            )}
        {/* ===== 수확 기록 수정 팝업 모달 ===== */}
        {harvestEditModal && (

            <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setHarvestEditModal(null)} />
                <div className="relative bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl shadow-black/20 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-300">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-black text-gray-900">
                                {harvestEditModal.house_number}동 · {gradeLabel(harvestEditModal.grade)} {harvestEditModal.quantity}박스
                            </h2>
                            <p className="text-xs text-gray-400 font-bold mt-0.5">
                                {new Date(harvestEditModal.recorded_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <button onClick={() => setHarvestEditModal(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* 수정 폼 */}
                    <div className="space-y-3">
                        {/* 동 / 등급 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 block mb-1.5 ml-1">동 선택</label>
                                <select
                                    value={editHouse || harvestEditModal.house_number}
                                    onChange={(e) => setEditHouse(Number(e.target.value))}
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none">
                                    {houses.map(h => <option key={h.id} value={h.house_number}>{h.house_number}동</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 block mb-1.5 ml-1">등급</label>
                                <select
                                    value={editGrade || harvestEditModal.grade}
                                    onChange={(e) => setEditGrade(e.target.value as any)}
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none">
                                    <option value="sang">특/상</option>
                                    <option value="jung">중</option>
                                    <option value="ha">하</option>
                                </select>
                            </div>
                        </div>

                        {/* 수량 */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 block mb-1.5 ml-1">수량 (BOX)</label>
                            <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-3">
                                <button onClick={() => setEditQuantity(Math.max(1, (editQuantity || harvestEditModal.quantity) - 1))}
                                    className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm">
                                    <Minus className="w-4 h-4" />
                                </button>
                                <input type="number" min="1"
                                    value={editQuantity || harvestEditModal.quantity}
                                    onChange={(e) => setEditQuantity(Number(e.target.value))}
                                    className="flex-1 text-center text-2xl font-black text-gray-900 bg-transparent outline-none" />
                                <button onClick={() => setEditQuantity((editQuantity || harvestEditModal.quantity) + 1)}
                                    className="w-10 h-10 flex items-center justify-center bg-green-500 text-white rounded-xl shadow-sm">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* 날짜 */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 block mb-1.5 ml-1">날짜</label>
                            <input type="date"
                                value={editDate || harvestEditModal.recorded_at.split('T')[0]}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-black outline-none" />
                        </div>
                    </div>

                    {/* 버튼들 */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={async () => {
                                if (!confirm('이 기록을 삭제하시겠습니까?')) return;
                                await handleDelete(harvestEditModal.id);
                                setHarvestEditModal(null);
                            }}
                            className="py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-500 font-black text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all active:scale-95">
                            <Trash2 className="w-4 h-4" /> 삭제
                        </button>
                        <button
                            onClick={async () => {
                                setEditingId(harvestEditModal.id);
                                setEditHouse(editHouse || harvestEditModal.house_number);
                                setEditGrade(editGrade || harvestEditModal.grade);
                                setEditQuantity(editQuantity || harvestEditModal.quantity);
                                setEditDate(editDate || harvestEditModal.recorded_at.split('T')[0]);
                                await handleUpdate();
                                setHarvestEditModal(null);
                            }}
                            className="py-4 rounded-2xl bg-green-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-200 hover:bg-green-700 transition-all active:scale-95">
                            <Save className="w-4 h-4" /> 수정 저장
                        </button>
                    </div>
                </div>
            </div>
        
        )}
    </div>
    );
}
