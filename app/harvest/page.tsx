"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Minus, Trash2, Sprout, Clock, History, Edit2, X, Check, BarChart3, CalendarDays, RefreshCcw } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, FarmHouse, HarvestRecord } from "@/lib/supabase";

export default function HarvestPage() {
    const { farm } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'record' | 'analysis'>('record');

    // Data State
    const [houses, setHouses] = useState<FarmHouse[]>([]);
    const [history, setHistory] = useState<HarvestRecord[]>([]);

    // Record State
    const [selectedHouse, setSelectedHouse] = useState<number | null>(null);
    const [selectedGrade, setSelectedGrade] = useState<'sang' | 'jung' | 'ha'>('sang');
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editHouse, setEditHouse] = useState<number>(0);
    const [editGrade, setEditGrade] = useState<'sang' | 'jung' | 'ha'>('sang');
    const [editQuantity, setEditQuantity] = useState<number>(0);

    // Analysis State
    const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month'>('today');
    const [houseStats, setHouseStats] = useState<Record<number, number>>({});
    const [dateStats, setDateStats] = useState<Record<string, number>>({});
    const [totalHarvest, setTotalHarvest] = useState(0);

    useEffect(() => {
        if (farm?.id) {
            fetchHouses();
            fetchHistory();
            if (activeTab === 'analysis') fetchStats();
        }
    }, [farm, activeTab, statsPeriod]);

    const fetchHouses = async () => {
        const { data } = await supabase
            .from('farm_houses')
            .select('*')
            .eq('farm_id', farm!.id)
            .eq('is_active', true)
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

    const fetchStats = async () => {
        if (!farm?.id) return;

        let query = supabase.from('harvest_records').select('*').eq('farm_id', farm.id);

        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const today = new Date(now.getTime() + kstOffset).toISOString().split('T')[0];

        if (statsPeriod === 'today') {
            query = query.gte('recorded_at', `${today}T00:00:00`);
        } else if (statsPeriod === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            query = query.gte('recorded_at', weekAgo);
        } else {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            query = query.gte('recorded_at', monthAgo);
        }

        const { data } = await query;
        if (!data) return;

        // Aggregate House Stats
        const hStats: Record<number, number> = {};
        const dStats: Record<string, number> = {};
        let total = 0;

        data.forEach(item => {
            hStats[item.house_number] = (hStats[item.house_number] || 0) + item.quantity;

            const date = new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
            dStats[date] = (dStats[date] || 0) + item.quantity;

            total += item.quantity;
        });

        setHouseStats(hStats);
        setDateStats(dStats);
        setTotalHarvest(total);
    };

    const handleSave = async () => {
        if (!selectedHouse || !farm?.id) {
            alert("하우스 동을 선택해주세요!");
            return;
        }
        setSaving(true);
        const { error } = await supabase.from('harvest_records').insert({
            farm_id: farm.id,
            house_number: selectedHouse,
            grade: selectedGrade,
            quantity,
        });
        if (error) {
            alert(`저장 실패: ${error.message}`);
        } else {
            alert(`✅ 저장 완료!\n${selectedHouse}동 / ${gradeLabel(selectedGrade)} / ${quantity}박스`);
            setQuantity(1);
            fetchHistory();
        }
        setSaving(false);
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        setSaving(true);
        const { error } = await supabase.from('harvest_records').update({
            house_number: editHouse,
            grade: editGrade,
            quantity: editQuantity
        }).eq('id', editingId);

        if (error) alert("수정 실패");
        else {
            setEditingId(null);
            fetchHistory();
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("이 기록을 삭제하시겠습니까?")) return;
        const { error } = await supabase.from('harvest_records').delete().eq('id', id);
        if (error) alert("삭제 실패");
        else fetchHistory();
    };

    const startEdit = (item: HarvestRecord) => {
        setEditingId(item.id);
        setEditHouse(item.house_number);
        setEditGrade(item.grade);
        setEditQuantity(item.quantity);
    };

    const gradeLabel = (g: string) => ({ sang: '특/상', jung: '중/보통', ha: '하/주스' }[g] ?? g);
    const gradeColor = (g: string) => ({ sang: 'text-red-600 bg-red-50', jung: 'text-orange-600 bg-orange-50', ha: 'text-yellow-600 bg-yellow-50' }[g] ?? 'text-gray-600 bg-gray-50');

    return (
        <div className="p-4 md:p-6 pb-24 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-xl shadow-lg shadow-red-100">
                        <Sprout className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">수확 관리</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Harvest Tracking</p>
                    </div>
                </div>

                {/* 탭 전환 버튼 */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('record')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'record' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                        기록하기
                    </button>
                    <button onClick={() => setActiveTab('analysis')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'analysis' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                        통계보기
                    </button>
                </div>
            </div>

            {activeTab === 'record' ? (
                /* === 기록 뷰 === */
                <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    {/* 1. 하우스 선택 */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <h2 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2 uppercase">
                            <span className="w-1 h-3 bg-red-500 rounded-full"></span> 1. 하우스 동
                        </h2>
                        {houses.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">하우스 정보가 없습니다.</p>
                        ) : (
                            <div className="grid grid-cols-5 gap-2">
                                {houses.map((h) => (
                                    <button key={h.id} onClick={() => setSelectedHouse(h.house_number)}
                                        className={`h-11 rounded-xl font-bold text-sm border transition-all
                                            ${selectedHouse === h.house_number
                                                ? 'bg-red-600 text-white border-red-700 shadow-md transform scale-105'
                                                : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}>
                                        {h.house_number}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    <div className="grid grid-cols-2 gap-4">
                        {/* 2. 등급 선택 */}
                        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2 uppercase">
                                <span className="w-1 h-3 bg-orange-500 rounded-full"></span> 2. 등급
                            </h2>
                            <div className="flex flex-col gap-2">
                                {[{ id: 'sang', label: '특/상' }, { id: 'jung', label: '중/보통' }, { id: 'ha', label: '하/주스' }].map((g) => (
                                    <button key={g.id} onClick={() => setSelectedGrade(g.id as any)}
                                        className={`py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center justify-between px-3
                                            ${selectedGrade === g.id
                                                ? 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-200'
                                                : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}>
                                        <span>{g.label}</span>
                                        {selectedGrade === g.id && <Check className="w-3 h-3" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* 3. 수량 선택 */}
                        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center">
                            <h2 className="text-xs font-bold text-gray-400 mb-4 flex self-start items-center gap-2 uppercase">
                                <span className="w-1 h-3 bg-green-500 rounded-full"></span> 3. 수량
                            </h2>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all border border-gray-100">
                                    <Minus className="w-4 h-4 text-gray-400" />
                                </button>
                                <span className="text-4xl font-black text-gray-900 tracking-tighter w-14 text-center">{quantity}</span>
                                <button onClick={() => setQuantity(quantity + 1)}
                                    className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all border border-red-100">
                                    <Plus className="w-4 h-4 text-red-600" />
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold mt-2">BOX</p>
                        </section>
                    </div>

                    <button onClick={handleSave} disabled={saving}
                        className="w-full bg-red-600 text-white h-16 rounded-2xl text-lg font-bold shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        <Save className="w-5 h-5" />
                        {saving ? '저장 중...' : '기록 저장'}
                    </button>

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
                                            <div key={item.id} className="bg-white rounded-2xl border-2 border-red-200 p-4 shadow-lg space-y-3 animate-in fade-in">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <select value={editHouse} onChange={(e) => setEditHouse(Number(e.target.value))} className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold outline-none">{houses.map(h => <option key={h.id} value={h.house_number}>{h.house_number}동</option>)}</select>
                                                        <select value={editGrade} onChange={(e) => setEditGrade(e.target.value as any)} className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold outline-none"><option value="sang">특/상</option><option value="jung">중/보통</option><option value="ha">하/주스</option></select>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setEditQuantity(Math.max(1, editQuantity - 1))} className="p-1 bg-gray-100 rounded-lg"><Minus className="w-3 h-3" /></button>
                                                        <span className="text-sm font-black w-6 text-center">{editQuantity}</span>
                                                        <button onClick={() => setEditQuantity(editQuantity + 1)} className="p-1 bg-red-100 rounded-lg"><Plus className="w-3 h-3 text-red-600" /></button>
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
                                        <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center border border-gray-50">
                                                    <span className="text-[9px] font-bold text-gray-400 leading-none mb-0.5">DONG</span>
                                                    <span className="text-sm font-black text-gray-800 leading-none">{item.house_number}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${gradeColor(item.grade)}`}>{gradeLabel(item.grade)}</span>
                                                        <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.recorded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="text-sm font-black text-gray-900">{item.quantity} <span className="text-xs text-gray-400 font-medium">박스</span></div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEdit(item)} className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </div>
            ) : (
                /* === 통계 뷰 === */
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-xl">
                        {(['today', 'week', 'month'] as const).map((p) => (
                            <button key={p} onClick={() => setStatsPeriod(p)}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${statsPeriod === p ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}>
                                {p === 'today' ? '오늘' : p === 'week' ? '이번 주' : '이번 달'}
                            </button>
                        ))}
                    </div>

                    <div className="bg-red-600 rounded-3xl p-6 text-white shadow-xl shadow-red-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <p className="text-red-100 text-xs font-bold uppercase tracking-widest mb-1">Total Harvest</p>
                        <h2 className="text-4xl font-black tracking-tighter">{totalHarvest.toLocaleString()} <span className="text-lg font-medium opacity-70">Box</span></h2>
                    </div>

                    {/* 동별 통계 */}
                    <section className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-gray-400" /> 동별 수확량
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            {houses.map(h => {
                                const count = houseStats[h.house_number] || 0;
                                return (
                                    <div key={h.id} className={`p-4 rounded-2xl border ${count > 0 ? 'bg-white border-red-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                                        <div className="text-xs font-bold text-gray-400 mb-1">{h.house_number}동</div>
                                        <div className={`text-xl font-black ${count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{count}</div>
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
                                    Object.entries(dateStats).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, count]) => (
                                        <div key={date} className="flex items-center justify-between p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors rounded-lg">
                                            <span className="text-xs font-bold text-gray-500">{date}</span>
                                            <span className="text-sm font-black text-gray-900">{count} <span className="text-[10px] text-gray-400 font-normal">Box</span></span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
