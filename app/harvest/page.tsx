"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Minus, Trash2, Sprout, Clock, History, Edit2, X, Check } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, FarmHouse, HarvestRecord } from "@/lib/supabase";

export default function HarvestPage() {
    const { farm } = useAuthStore();
    const [houses, setHouses] = useState<FarmHouse[]>([]);
    const [history, setHistory] = useState<HarvestRecord[]>([]);
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

    useEffect(() => {
        if (farm?.id) {
            fetchHouses();
            fetchHistory();
        }
    }, [farm]);

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
            setSelectedHouse(null);
            fetchHistory(); // 목록 갱신
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

        if (error) {
            alert("수정 실패");
        } else {
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
        <div className="p-4 md:p-6 pb-32 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-2xl">
                    <Sprout className="w-6 h-6 text-red-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">수확 기록</h1>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Harvest Tracking</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* 하우스 선택 */}
                <section className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-50 p-6">
                    <h2 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-red-400 rounded-full"></span> 1. 하우스 선택
                    </h2>
                    {houses.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                            설정에서 하우스 동을 먼저 추가해주세요.
                        </p>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {houses.map((h) => (
                                <button key={h.id} onClick={() => setSelectedHouse(h.house_number)}
                                    className={`h-14 rounded-2xl font-black text-lg border transition-all
                                        ${selectedHouse === h.house_number
                                            ? 'bg-red-600 text-white border-red-700 shadow-lg shadow-red-200 scale-105'
                                            : 'bg-white text-gray-600 border-gray-100 hover:border-red-200'}`}>
                                    {h.house_number}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 등급 선택 */}
                    <section className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-50 p-6">
                        <h2 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 bg-red-400 rounded-full"></span> 2. 등급 선택
                        </h2>
                        <div className="flex flex-col gap-2">
                            {[{ id: 'sang', label: '특/상' }, { id: 'jung', label: '중/보통' }, { id: 'ha', label: '하/주스' }].map((g) => (
                                <button key={g.id} onClick={() => setSelectedGrade(g.id as any)}
                                    className={`py-4 rounded-2xl font-bold text-base border transition-all flex items-center justify-between px-6
                                        ${selectedGrade === g.id
                                            ? 'bg-red-50 text-red-700 border-red-200 ring-2 ring-red-500/20'
                                            : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}>
                                    <span>{g.label}</span>
                                    {selectedGrade === g.id && <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* 수량 */}
                    <section className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-50 p-6 flex flex-col items-center justify-center">
                        <h2 className="text-sm font-bold text-gray-400 mb-6 flex self-start items-center gap-2">
                            <span className="w-1 h-4 bg-red-400 rounded-full"></span> 3. 수량 (박스)
                        </h2>
                        <div className="flex items-center gap-8">
                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-all border border-gray-100">
                                <Minus className="w-6 h-6 text-gray-400" />
                            </button>
                            <span className="text-5xl font-black text-gray-900 tracking-tighter">{quantity}</span>
                            <button onClick={() => setQuantity(quantity + 1)}
                                className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all border border-red-100">
                                <Plus className="w-6 h-6 text-red-600" />
                            </button>
                        </div>
                    </section>
                </div>

                <button onClick={handleSave} disabled={saving}
                    className="w-full bg-red-600 text-white h-20 rounded-[2rem] text-xl font-black shadow-2xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    <Save className="w-6 h-6" />
                    {saving ? '기록 처리 중...' : '기록 저장하기'}
                </button>

                {/* 최근 내역 섹션 */}
                <section className="pt-8">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <History className="w-5 h-5 text-gray-400" />
                            최근 수확 내역
                        </h2>
                        <span className="text-xs text-gray-400 font-medium">최신 10건</span>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-10 text-gray-300 animate-pulse">데이터 로딩 중...</div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 text-gray-300 text-sm">
                                아직 등록된 수확 기록이 없습니다.
                            </div>
                        ) : (
                            history.map((item) => {
                                const isEditing = editingId === item.id;
                                if (isEditing) {
                                    return (
                                        <div key={item.id} className="bg-white rounded-[1.5rem] border-2 border-red-200 p-4 shadow-lg animate-in zoom-in-95 duration-200 space-y-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <select value={editHouse} onChange={(e) => setEditHouse(Number(e.target.value))}
                                                        className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold outline-none">
                                                        {houses.map(h => <option key={h.id} value={h.house_number}>{h.house_number}동</option>)}
                                                    </select>
                                                    <select value={editGrade} onChange={(e) => setEditGrade(e.target.value as any)}
                                                        className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold outline-none">
                                                        <option value="sang">특/상</option>
                                                        <option value="jung">중/보통</option>
                                                        <option value="ha">하/주스</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setEditQuantity(Math.max(1, editQuantity - 1))} className="p-1 bg-gray-100 rounded-lg"><Minus className="w-4 h-4" /></button>
                                                    <span className="text-xl font-black min-w-[30px] text-center">{editQuantity}</span>
                                                    <button onClick={() => setEditQuantity(editQuantity + 1)} className="p-1 bg-red-100 rounded-lg"><Plus className="w-4 h-4 text-red-600" /></button>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={handleUpdate} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                                                    <Check className="w-4 h-4" /> 수정 완료
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                                                    <X className="w-4 h-4" /> 취소
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.id} className="bg-white rounded-[1.5rem] border border-gray-100 p-4 shadow-sm flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex flex-col items-center justify-center border border-gray-50">
                                                <span className="text-[10px] font-bold text-gray-400 leading-none">HOUSE</span>
                                                <span className="text-lg font-black text-gray-800 leading-none">{item.house_number}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${gradeColor(item.grade)}`}>
                                                        {gradeLabel(item.grade)}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(item.recorded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <div className="text-xl font-black text-gray-900">
                                                    {item.quantity}<span className="text-sm font-bold text-gray-400 ml-0.5">박스</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEdit(item)} className="p-3 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-3 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
