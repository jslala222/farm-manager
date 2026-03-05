"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Wallet,
    Plus,
    Trash2,
    X,
    Calendar,
    TrendingUp,
    FileText,
    ChevronDown,
    ChevronUp,
    Edit3,
    Save,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, OtherIncome } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

// 기타수입 카테고리 목록
const INCOME_TYPES = [
    { value: '영농지원금', label: '영농지원금', icon: '🌾', desc: '정부/지자체 영농 보조금' },
    { value: '농지임대수익', label: '농지임대수익', icon: '🏠', desc: '농지/시설 임대 소득' },
    { value: '재난지원금', label: '재난지원금', icon: '🆘', desc: '자연재해/재난 보상금' },
    { value: '보험환급', label: '보험환급', icon: '🛡️', desc: '농작물/시설 보험 환급' },
    { value: '교육/체험수입', label: '교육/체험수입', icon: '🎓', desc: '농촌체험/교육 프로그램' },
    { value: '로컬푸드마켓', label: '로컬푸드마켓', icon: '🏪', desc: '직거래/로컬마켓 판매' },
    { value: '기타', label: '기타', icon: '💰', desc: '그 외 모든 수입' },
];

export default function OtherIncomePage() {
    const { farm, initialized } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [incomes, setIncomes] = useState<OtherIncome[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // 입력 폼 상태
    const [showAddForm, setShowAddForm] = useState(false);
    const [formAmount, setFormAmount] = useState('');
    const [formType, setFormType] = useState('영농지원금');
    const [formDesc, setFormDesc] = useState('');
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);

    // 수정 모드
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedMonth, setExpandedMonth] = useState(true);

    const fetchIncomes = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);

        const year = parseInt(selectedMonth.split('-')[0]);
        const month = parseInt(selectedMonth.split('-')[1]);
        const lastDay = new Date(year, month, 0).getDate();

        const { data, error } = await supabase
            .from('other_incomes')
            .select('*')
            .eq('farm_id', farm.id)
            .gte('income_date', `${selectedMonth}-01`)
            .lte('income_date', `${selectedMonth}-${lastDay}`)
            .order('income_date', { ascending: false });

        if (error) {
            console.error('기타수입 로딩 실패:', error);
        }
        setIncomes(data ?? []);
        setLoading(false);
    }, [farm?.id, selectedMonth]);

    useEffect(() => {
        if (initialized && farm?.id) {
            fetchIncomes();
        }
    }, [initialized, farm?.id, fetchIncomes]);

    const handleAdd = async () => {
        if (!farm?.id) return;
        const amount = parseInt(formAmount.replace(/[^0-9]/g, ''));
        if (!amount || amount <= 0) {
            toast.error('금액을 입력해주세요.');
            return;
        }

        setSaving(true);

        if (editingId) {
            // 수정 모드
            const { error } = await supabase
                .from('other_incomes')
                .update({
                    amount,
                    income_type: formType,
                    description: formDesc || null,
                    income_date: formDate,
                })
                .eq('id', editingId);

            if (error) {
                toast.error('수정 실패: ' + error.message);
            } else {
                setEditingId(null);
                setShowAddForm(false);
                resetForm();
                fetchIncomes();
            }
        } else {
            // 신규 추가
            const { error } = await supabase
                .from('other_incomes')
                .insert({
                    farm_id: farm.id,
                    amount,
                    income_type: formType,
                    description: formDesc || null,
                    income_date: formDate,
                });

            if (error) {
                toast.error('추가 실패: ' + error.message);
            } else {
                setShowAddForm(false);
                resetForm();
                fetchIncomes();
            }
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 기타수입 내역을 삭제하시겠습니까?')) return;
        const { error } = await supabase.from('other_incomes').delete().eq('id', id);
        if (error) {
            toast.error('삭제 실패: ' + error.message);
        } else {
            fetchIncomes();
        }
    };

    const handleEdit = (income: OtherIncome) => {
        setEditingId(income.id);
        setFormAmount(formatCurrency(income.amount));
        setFormType(income.income_type);
        setFormDesc(income.description || '');
        setFormDate(income.income_date);
        setShowAddForm(true);
    };

    const resetForm = () => {
        setFormAmount('');
        setFormType('영농지원금');
        setFormDesc('');
        setFormDate(new Date().toISOString().split('T')[0]);
        setEditingId(null);
    };

    // 월 합계
    const monthTotal = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);

    // 카테고리별 합계
    const categoryTotals = incomes.reduce((acc, i) => {
        acc[i.income_type] = (acc[i.income_type] || 0) + (i.amount || 0);
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
            <div className="max-w-2xl mx-auto p-4 space-y-4 animate-in fade-in duration-500">

                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl shadow-emerald-200 shrink-0">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-black text-gray-900 tracking-tight whitespace-nowrap">기타수입</h1>
                            <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">보조금 · 지원금 · 임대 등</p>
                        </div>
                    </div>

                    <div className="relative shrink-0">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-white border-2 border-gray-100 rounded-xl px-3 py-2 text-sm font-black text-gray-700 outline-none focus:border-emerald-500 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* 월 합계 카드 */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2.5rem] p-5 text-white shadow-2xl shadow-emerald-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <p className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                                    {selectedMonth.split('-')[0]}년 {parseInt(selectedMonth.split('-')[1])}월 기타수입
                                </p>
                                <h2 className="text-3xl font-black tracking-tighter">{formatCurrency(monthTotal)}</h2>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-2xl">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="text-xs font-black">{incomes.length}건</span>
                            </div>
                        </div>

                        {/* 카테고리별 요약 */}
                        {Object.keys(categoryTotals).length > 0 && (
                            <div className="mt-4 pt-3 border-t border-white/15 space-y-1.5">
                                {Object.entries(categoryTotals)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([type, total]) => {
                                        const info = INCOME_TYPES.find(t => t.value === type);
                                        return (
                                            <div key={type} className="flex justify-between items-center">
                                                <span className="text-xs text-emerald-100 font-bold flex items-center gap-1.5">
                                                    {info?.icon || '💰'} {type}
                                                </span>
                                                <span className="text-sm font-black text-white">{formatCurrency(total)}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>

                {/* 추가 버튼 */}
                <button
                    onClick={() => { resetForm(); setShowAddForm(!showAddForm); }}
                    className={`w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-[0.97]
                        ${showAddForm
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            : 'bg-emerald-600 text-white shadow-xl shadow-emerald-200 hover:bg-emerald-700'}`}
                >
                    {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAddForm ? '입력 취소' : '기타수입 추가'}
                </button>

                {/* 입력 폼 */}
                {showAddForm && (
                    <div className="bg-white rounded-[2rem] border-2 border-emerald-100 p-5 space-y-5 shadow-lg animate-in slide-in-from-top-2 duration-300">
                        <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            {editingId ? '기타수입 수정' : '기타수입 등록'}
                        </h3>

                        {/* 카테고리 선택 */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1">수입 유형</label>
                            <div className="grid grid-cols-2 gap-2">
                                {INCOME_TYPES.map((type) => (
                                    <button
                                        key={type.value}
                                        onClick={() => setFormType(type.value)}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${formType === type.value
                                                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{type.icon}</span>
                                            <div>
                                                <span className="text-xs font-black text-gray-900 block">{type.label}</span>
                                                <span className="text-[9px] text-gray-500 font-bold">{type.desc}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 금액 입력 */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1">금액</label>
                            <input
                                type="text"
                                value={formAmount}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setFormAmount(val ? formatCurrency(val) : '');
                                }}
                                placeholder="0원"
                                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-center text-xl font-black text-gray-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all"
                            />
                        </div>

                        {/* 날짜 선택 */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1">수입 날짜</label>
                            <input
                                type="date"
                                value={formDate}
                                onChange={(e) => setFormDate(e.target.value)}
                                className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-black text-gray-800 outline-none focus:border-emerald-500 transition-all"
                            />
                        </div>

                        {/* 메모 */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-700 ml-1">메모 (선택)</label>
                            <input
                                type="text"
                                value={formDesc}
                                onChange={(e) => setFormDesc(e.target.value)}
                                placeholder="간단한 설명 (예: 2026년 1분기 영농보조금)"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-emerald-500 transition-all"
                            />
                        </div>

                        {/* 저장 버튼 */}
                        <button
                            onClick={handleAdd}
                            disabled={saving}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? '처리중...' : editingId ? '수정 완료' : '등록하기'}
                        </button>
                    </div>
                )}

                {/* 수입 내역 리스트 */}
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <button
                        onClick={() => setExpandedMonth(!expandedMonth)}
                        className="w-full p-4 bg-emerald-50/50 border-b border-gray-50 flex items-center justify-between text-left"
                    >
                        <h3 className="text-sm font-black text-emerald-900 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {parseInt(selectedMonth.split('-')[1])}월 기타수입 내역
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                                {incomes.length}건
                            </span>
                            {expandedMonth ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                    </button>

                    {expandedMonth && (
                        <div className="p-4 space-y-3">
                            {loading ? (
                                <div className="py-12 text-center">
                                    <div className="w-8 h-8 border-3 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3"></div>
                                    <p className="text-xs text-gray-500 font-bold">불러오는 중...</p>
                                </div>
                            ) : incomes.length === 0 ? (
                                <div className="py-12 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                                    <Wallet className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-gray-400">이번 달 기타수입이 없습니다</p>
                                    <p className="text-[10px] text-gray-400 mt-1">위의 버튼으로 수입을 추가해보세요!</p>
                                </div>
                            ) : (
                                incomes.map((income) => {
                                    const typeInfo = INCOME_TYPES.find(t => t.value === income.income_type);
                                    return (
                                        <div key={income.id}
                                            className="group flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-lg shrink-0">
                                                    {typeInfo?.icon || '💰'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-gray-900 truncate">{income.income_type}</span>
                                                        <span className="text-[10px] font-bold text-gray-400">{income.income_date}</span>
                                                    </div>
                                                    {income.description && (
                                                        <p className="text-[10px] text-gray-500 font-bold truncate mt-0.5">{income.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-base font-black text-emerald-700">{formatCurrency(income.amount)}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(income)}
                                                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(income.id)}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </section>

                {/* 안내 문구 */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">기타수입 안내</p>
                    <p className="text-xs text-gray-600 font-medium leading-relaxed break-keep">
                        💡 기타수입은 <strong>매출과 별도로 관리</strong>됩니다. 영농지원금, 농지임대, 재난지원금 등 농산물 판매 이외의 수입을 기록하세요.<br />
                        통합결산 페이지에서 <strong>매출 + 기타수입</strong>이 합산된 전체 수입을 확인할 수 있습니다.
                    </p>
                </div>

            </div>
        </div>
    );
}
