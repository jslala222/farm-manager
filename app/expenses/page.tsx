"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Receipt, Calendar as CalendarIcon, CreditCard, Tag, ChevronDown, Filter, X, Search, RefreshCcw, Check, Users, Heart, AlertCircle, BarChart3, ChevronLeft, ChevronRight, CalendarDays, Edit2, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { supabase, Expenditure } from "@/lib/supabase";
import { formatCurrency, stripNonDigits } from "@/lib/utils";
import Calendar from "@/components/Calendar";

const CATEGORY_MAP: Record<string, string[]> = {
    '농작관리': ["비료/영양제", "농약/종자", "시설보수", "농기계유지/유류", "농기계구입/할부", "수도/전기/가스", "포장재/소모품", "기타 영농비"],
    '인건비': ["기본급/월급", "아르바이트(일당)", "명절떡값/선물", "성과급/보너스", "식대/새참비", "퇴직금/보험", "기타 인건비"],
    '가계생활': ["부모님용돈/효도", "병원/의료비", "식비/생필품", "교육/학원비", "주거/통신/세금", "취미/경조사", "주유", "기타 생활비"]
};

export default function ExpensesPage() {
    const { farm, initialized } = useAuthStore();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);

    const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');

    // Filter State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [mainFilter, setMainFilter] = useState<string | null>(null);
    const [showCalendar, setShowCalendar] = useState(false); // Default to false for cleaner look

    // Analysis State
    const getLocalISOString = (date: Date) => {
        const offset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(date.getTime() + offset);
        return kstDate.toISOString().split('T')[0];
    };
    const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [statsDate, setStatsDate] = useState(getLocalISOString(new Date()));
    const [statsWeekStart, setStatsWeekStart] = useState<string>("");
    const [statsMonth, setStatsMonth] = useState<{ year: number, month: number }>({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1
    });

    // New Expense State
    const [mainCategory, setMainCategory] = useState<string>("농작관리");
    const [subCategory, setSubCategory] = useState<string>(CATEGORY_MAP["농작관리"][0]);
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<"현금" | "카드">("카드");

    // [bkit] 사장님 요청: 상단 달력 날짜 선택 시 기록 날짜 동기화
    useEffect(() => {
        setExpenseDate(selectedDate);
    }, [selectedDate]);

    // [bkit 엔터프라이즈] React Query를 이용한 지출 내역 관리
    const {
        data: expenses = [],
        isLoading: loading,
        isError,
        error: queryError,
        refetch: fetchExpenses,
        isFetching
    } = useQuery({
        queryKey: ['expenses', farm?.id],
        queryFn: async () => {
            if (!farm?.id) return [];
            const { data, error } = await supabase.from('expenditures')
                .select('*')
                .eq('farm_id', farm.id)
                .order('expense_date', { ascending: false });
            if (error) throw error;
            return data as Expenditure[];
        },
        enabled: initialized && !!farm?.id,
    });

    // 지출 추가 Mutation
    const addMutation = useMutation({
        mutationFn: async (newExpense: any) => {
            const { error } = await supabase.from('expenditures').insert(newExpense);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', farm?.id] });
            setAmount("");
            setNotes("");
            setIsAdding(false);
        },
        onError: (error: any) => alert(`저장 실패: ${error.message}`)
    });

    // 지출 삭제 Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('expenditures').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', farm?.id] });
            setEditModal(null);
        },
        onError: () => alert("삭제 실패")
    });

    // 지출 수정 Mutation
    const updateMutation = useMutation({
        mutationFn: async (data: { id: string; payload: any }) => {
            const { error } = await supabase.from('expenditures').update(data.payload).eq('id', data.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', farm?.id] });
            setEditModal(null);
        },
        onError: (e: any) => alert(`수정 실패: ${e.message}`)
    });

    // 수정 모달 상태
    type EditModalState = {
        id: string;
        main_category: string;
        sub_category: string;
        amount: string;
        payment_method: string;
        notes: string;
        expense_date: string;
    };
    const [editModal, setEditModal] = useState<EditModalState | null>(null);

    const openEditModal = (exp: Expenditure) => {
        setEditModal({
            id: exp.id,
            main_category: exp.main_category,
            sub_category: exp.sub_category || exp.category,
            amount: exp.amount.toString(),
            payment_method: exp.payment_method || '카드',
            notes: exp.notes || '',
            expense_date: exp.expense_date,
        });
    };

    const handleSaveEdit = () => {
        if (!editModal) return;
        updateMutation.mutate({
            id: editModal.id,
            payload: {
                main_category: editModal.main_category,
                sub_category: editModal.sub_category,
                category: editModal.sub_category,
                amount: parseInt(stripNonDigits(editModal.amount)) || 0,
                payment_method: editModal.payment_method,
                notes: editModal.notes,
                expense_date: editModal.expense_date,
            }
        });
    };

    const handleDeleteFromModal = () => {
        if (!editModal) return;
        if (!confirm("이 지출 기록을 삭제하시겠습니까?")) return;
        deleteMutation.mutate(editModal.id);
    };

    // 로딩 단계 메시지 동적 생성
    const loadingStep = !initialized ? "인증 정보 확인 중..." : !farm?.id ? "농장 정보 대기 중..." : "지출 내역 동기화 중...";

    // [bkit] 긴급 캐시 초기화 (사장님 요청)
    const handleForceReset = () => {
        if (!confirm("모든 로컬 설정(로그인 캐시 포함)을 강제로 삭제하고 다시 시작하시겠습니까? (연결 문제 해결의 최후 수단)")) return;
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/login";
    };

    const handleAddExpense = async () => {
        if (!amount || !farm?.id) return;
        addMutation.mutate({
            farm_id: farm.id,
            main_category: mainCategory,
            sub_category: subCategory,
            category: subCategory,
            amount: parseInt(stripNonDigits(amount)),
            payment_method: paymentMethod,
            notes,
            expense_date: expenseDate
        });
    };

    const deleteExpense = async (id: string) => {
        if (!confirm("이 지출 기록을 삭제하시겠습니까?")) return;
        deleteMutation.mutate(id);
    };

    // 달력용 지출 발생일 데이터 가공
    const expenditureDates = useMemo(() => {
        const dates: Record<string, number[]> = {};
        expenses.forEach(exp => {
            const date = exp.expense_date;
            if (!dates[date]) dates[date] = [];
            // 분류별로 다른 색상(번호) 부여 (1: 농작, 6: 인건, 7: 가계)
            const typeValue = exp.main_category === '농작관리' ? 1 : exp.main_category === '인건비' ? 6 : 7;
            if (!dates[date].includes(typeValue)) dates[date].push(typeValue);
        });
        return dates;
    }, [expenses]);

    // 필터링된 지출 내역
    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const dateMatch = exp.expense_date === selectedDate;
            const categoryMatch = !mainFilter || exp.main_category === mainFilter;
            return dateMatch && categoryMatch;
        });
    }, [expenses, selectedDate, mainFilter]);

    // 오늘 하루 총 지출
    const todayTotal = useMemo(() => {
        return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    }, [filteredExpenses]);

    // 당월 총 지출 (사장님 요청)
    const monthlySummary = useMemo(() => {
        const now = new Date(selectedDate);
        const year = now.getFullYear();
        const month = now.getMonth();

        const monthly = expenses.filter(exp => {
            const d = new Date(exp.expense_date);
            return d.getFullYear() === year && d.getMonth() === month;
        });

        const stats = {
            '농작관리': 0,
            '인건비': 0,
            '가계생활': 0
        };

        monthly.forEach(exp => {
            if (stats[exp.main_category as keyof typeof stats] !== undefined) {
                stats[exp.main_category as keyof typeof stats] += exp.amount;
            }
        });

        return {
            count: monthly.length,
            total: monthly.reduce((sum, exp) => sum + exp.amount, 0),
            month: month + 1,
            stats
        };
    }, [expenses, selectedDate]);

    // [bkit] 선택된 날짜 한글 포맷팅
    const formattedSelectedDate = useMemo(() => {
        const [y, m, d] = selectedDate.split('-');
        return `${y}년 ${m}월 ${d}일`;
    }, [selectedDate]);

    // -------------- 통계 전용 데이터 --------------
    const analyzedExpenses = useMemo(() => {
        return expenses.filter(exp => {
            if (statsPeriod === 'today') {
                return exp.expense_date === getLocalISOString(new Date());
            } else if (statsPeriod === 'custom') {
                return exp.expense_date === statsDate;
            } else if (statsPeriod === 'week') {
                const expDate = new Date(exp.expense_date).getTime();
                const start = new Date(statsWeekStart).getTime();
                const end = start + 6 * 24 * 60 * 60 * 1000;
                return expDate >= start && expDate <= end;
            } else if (statsPeriod === 'month') {
                const d = new Date(exp.expense_date);
                return d.getFullYear() === statsMonth.year && d.getMonth() + 1 === statsMonth.month;
            }
            return false;
        });
    }, [expenses, statsPeriod, statsDate, statsWeekStart, statsMonth]);

    const statsAggregated = useMemo(() => {
        const s = {
            total: 0,
            byCategory: { '농작관리': 0, '인건비': 0, '가계생활': 0 },
            byDate: {} as Record<string, number>,
            bySubCat: {} as Record<string, number>
        };
        analyzedExpenses.forEach(exp => {
            s.total += exp.amount;
            if (s.byCategory[exp.main_category as keyof typeof s.byCategory] !== undefined) {
                s.byCategory[exp.main_category as keyof typeof s.byCategory] += exp.amount;
            }
            s.byDate[exp.expense_date] = (s.byDate[exp.expense_date] || 0) + exp.amount;
            const sub = exp.sub_category || exp.category || '기타';
            s.bySubCat[sub] = (s.bySubCat[sub] || 0) + exp.amount;
        });
        return s;
    }, [analyzedExpenses]);



    return (
        <div className="p-4 md:p-3 pb-20 md:pb-6 max-w-2xl mx-auto space-y-3">
            {/* 헤더 서비스 상태 */}
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2 whitespace-nowrap">
                        지출 관리
                        <Receipt className="w-4 h-4 text-red-500 shrink-0" />
                    </h1>
                    <div className="flex flex-col gap-1 mt-1">
                        {(loading || isFetching) && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-400">
                                <RefreshCcw className="w-2.5 h-2.5 animate-spin" />
                                {loadingStep}
                            </div>
                        )}
                        {isError && (
                            <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-100 rounded-xl animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                    <p className="text-[10px] font-bold text-red-600">데이터 동기화 실패 (네트워크 확인 필요)</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => fetchExpenses()} className="px-2 py-1 bg-white border border-red-200 text-[9px] font-black text-red-600 rounded-md shadow-sm">강제 재시도</button>
                                    <button onClick={handleForceReset} className="px-2 py-1 bg-red-600 text-white text-[9px] font-black rounded-md shadow-sm">전체 초기화</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
                    <button onClick={() => setActiveTab('list')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                        지출내역
                    </button>
                    <button onClick={() => setActiveTab('analysis')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'analysis' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                        지출통계
                    </button>
                </div>
            </div>

            {/* 입력 폼 토글 버튼 */}
            {activeTab === 'list' && (
                <div className="flex justify-end mb-2">
                    <button onClick={() => setIsAdding(!isAdding)}
                        className={`px-5 py-2.5 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg active:scale-95 shrink-0 ${isAdding ? 'bg-gray-100 text-gray-500' : 'bg-red-600 text-white shadow-red-200'
                            }`}>
                        {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {isAdding ? '취소' : '지출 기록'}
                    </button>
                </div>
            )}


            {activeTab === 'list' ? (
                <>
                    {/* 달력 섹션 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <button onClick={() => setShowCalendar(!showCalendar)} className="text-sm font-black text-gray-900 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-red-500" />
                                지출 달력 {showCalendar ? '숨기기' : '보기'}
                            </button>
                            {mainFilter && (
                                <button onClick={() => setMainFilter(null)} className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-100 flex items-center gap-1">
                                    <Tag className="w-3 h-3" /> {mainFilter} 필터 해제
                                </button>
                            )}
                        </div>

                        {showCalendar && (
                            <Calendar
                                selectedDate={selectedDate}
                                onChange={setSelectedDate}
                                harvestedDates={expenditureDates}
                                mode="expenditure"
                                legend={{
                                    label: '지출 분류',
                                    items: [
                                        { value: 1, label: '🚜 농작', color: 'bg-red-400' },
                                        { value: 6, label: '💰 인건', color: 'bg-orange-400' },
                                        { value: 7, label: '🏠 가계', color: 'bg-sky-400' }
                                    ]
                                }}
                            />
                        )}
                    </div>

                    {/* 입력 폼 */}
                    {isAdding && (
                        <div className="bg-white rounded-[2.5rem] border border-red-100 shadow-2xl shadow-red-100/50 p-3 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black text-gray-400 mb-2 ml-1 uppercase tracking-widest">지출 일자</label>
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-4 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                                        <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)}
                                            className="w-full p-3.5 pl-11 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-red-500 focus:bg-white outline-none font-bold transition-all text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-gray-400 mb-2 ml-1 uppercase tracking-widest">지출 금액</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-4 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                                        <input type="text" value={amount ? formatCurrency(amount) : ""}
                                            onChange={(e) => setAmount(stripNonDigits(e.target.value))}
                                            placeholder="0원"
                                            className="w-full p-3.5 pl-11 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-red-500 focus:bg-white outline-none font-bold transition-all text-sm" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black text-gray-400 mb-2 ml-1 uppercase tracking-widest">결제 수단</label>
                                    <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                        {(["카드", "현금"] as const).map(m => (
                                            <button key={m} onClick={() => setPaymentMethod(m)}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${paymentMethod === m ? 'bg-white shadow-sm text-red-600' : 'text-gray-400 hover:text-gray-600'}`}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col justify-end">
                                    {/* 대분류 선택 시 여백 맞춤용 공백 */}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-black text-gray-400 mb-2 ml-1 uppercase tracking-widest">대분류 선택</label>
                                    <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                        {Object.keys(CATEGORY_MAP).map(mCat => (
                                            <button key={mCat} onClick={() => {
                                                setMainCategory(mCat);
                                                // [bkit] 사장님 요청: 탭 전환 시 입력값(캐시) 초기화
                                                setSubCategory(CATEGORY_MAP[mCat][0]);
                                                setAmount("");
                                                setNotes("");
                                            }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${mainCategory === mCat ? 'bg-white shadow-sm text-red-600' : 'text-gray-400 hover:text-gray-600'
                                                    }`}>
                                                {mCat === '농작관리' ? '🚜 농작/운영' : mCat === '인건비' ? '💰 인건비' : '🏠 가계생활'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black text-gray-400 mb-2 ml-1 uppercase tracking-widest">상세 항목(소분류)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {CATEGORY_MAP[mainCategory].map(sCat => (
                                            <button key={sCat} onClick={() => setSubCategory(sCat)}
                                                className={`px-4 py-2.5 rounded-xl border-2 text-[11px] font-black transition-all
                                        ${subCategory === sCat ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                                                {sCat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-gray-400 mb-2 ml-1 uppercase tracking-widest">메모 (선택사항)</label>
                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                                    placeholder="상세 내용을 적어주세요..."
                                    className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-red-500 focus:bg-white outline-none h-24 resize-none transition-all text-sm" />
                            </div>

                            <button onClick={handleAddExpense}
                                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <Check className="w-5 h-5" />
                                기록 저장하기
                            </button>
                        </div>
                    )}

                    {/* 필터 및 목록 */}
                    <div className="space-y-4">
                        <div className="flex flex-col space-y-2 px-1">
                            <div className="flex items-end justify-between border-b border-gray-50 pb-3">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                        지출 내역
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{filteredExpenses.length}건</span>
                                    </h2>
                                    <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3" />
                                        {formattedSelectedDate}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-0.5">일일 합계</p>
                                    <p className="text-xl font-black text-gray-900">{formatCurrency(todayTotal)}</p>
                                </div>
                            </div>
                            {/* 당월 요약 (사장님 요청: 파란색) */}
                            <div className="bg-white border-4 border-red-500 rounded-[2.5rem] p-3 space-y-5 shadow-2xl shadow-red-100/50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 opacity-50"></div>

                                <div className="flex items-center justify-between border-b border-red-100 pb-3 relative z-10 gap-2">
                                    <p className="text-[11px] font-black text-red-600 uppercase tracking-wide flex items-center gap-1.5 min-w-0">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-ping shrink-0"></span>
                                        <span className="truncate">{monthlySummary.month}월 지출 리포트</span>
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-black text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{monthlySummary.count}건</span>
                                        <span className="text-lg font-black text-red-600 whitespace-nowrap">{formatCurrency(monthlySummary.total)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 relative z-10">
                                    <div className="bg-red-50/80 p-2.5 rounded-2xl border border-red-100 overflow-hidden">
                                        <p className="text-[10px] font-black text-red-400 mb-1">🚜 농작</p>
                                        <p className="text-xs font-black text-gray-900 tracking-tighter truncate">{formatCurrency(monthlySummary.stats['농작관리'])}</p>
                                    </div>
                                    <div className="bg-orange-50/80 p-2.5 rounded-2xl border border-orange-100 overflow-hidden">
                                        <p className="text-[10px] font-black text-orange-400 mb-1">💰 인건</p>
                                        <p className="text-xs font-black text-gray-900 tracking-tighter truncate">{formatCurrency(monthlySummary.stats['인건비'])}</p>
                                    </div>
                                    <div className="bg-sky-50/80 p-2.5 rounded-2xl border border-sky-100 overflow-hidden">
                                        <p className="text-[10px] font-black text-sky-400 mb-1">🏠 가계</p>
                                        <p className="text-xs font-black text-gray-900 tracking-tighter truncate">{formatCurrency(monthlySummary.stats['가계생활'])}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 대분류 필터 칩 */}
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                            <button onClick={() => setMainFilter(null)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border-2
                        ${!mainFilter ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-100 text-gray-400'}`}>
                                전체보기
                            </button>
                            {Object.keys(CATEGORY_MAP).map(mFilter => (
                                <button key={mFilter} onClick={() => setMainFilter(mFilter)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border-2
                            ${mainFilter === mFilter ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-100 text-gray-400'}`}>
                                    {mFilter}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <RefreshCcw className="w-10 h-10 text-gray-200 animate-spin" />
                                    <p className="text-sm font-bold text-gray-300">지출 데이터를 분석 중입니다...</p>
                                </div>
                            ) : filteredExpenses.length > 0 ? (
                                filteredExpenses.map((exp: Expenditure) => (
                                    <button key={exp.id}
                                        onClick={() => openEditModal(exp)}
                                        className="w-full text-left bg-white rounded-3xl border border-gray-100 p-4 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:border-red-100 transition-all flex items-center gap-3 active:scale-[0.98] animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors shrink-0 ${exp.main_category === '농작관리' ? 'bg-red-50 text-red-500' : exp.main_category === '인건비' ? 'bg-orange-50 text-orange-500' : 'bg-sky-50 text-sky-500'}`}>
                                            {exp.main_category === '농작관리' ? <Tag size={20} /> : exp.main_category === '인건비' ? <Users size={20} /> : <Heart size={20} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                                <p className="text-lg font-black text-gray-900 tracking-tight">{formatCurrency(exp.amount)}</p>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-black shrink-0 ${exp.main_category === '농작관리' ? 'bg-red-50 text-red-600' : exp.main_category === '인건비' ? 'bg-orange-50 text-orange-600' : 'bg-sky-50 text-sky-600'}`}>
                                                    {exp.sub_category || exp.category}
                                                </span>
                                                <span className="text-[10px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-100 font-bold shrink-0">
                                                    {exp.payment_method || '카드'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
                                                <p className="font-bold truncate">{exp.notes || '메모 없음'}</p>
                                                <span className="text-gray-200 shrink-0">|</span>
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 shrink-0">
                                                    <CalendarIcon size={10} />
                                                    {exp.expense_date}
                                                </div>
                                            </div>
                                        </div>
                                        <Edit2 className="w-4 h-4 text-gray-200 shrink-0" />
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100">
                                    <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
                                        <Search className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <p className="text-gray-400 font-bold">선택하신 조건에 해당하는<br />지출 내역이 없습니다.</p>
                                    {mainFilter && (
                                        <button onClick={() => setMainFilter(null)} className="mt-4 text-xs font-black text-red-500 underline underline-offset-4">
                                            전체 내역 보기
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                /* === 통계 뷰 === */
                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
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
                                className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-black transition-all whitespace-nowrap ${statsPeriod === p ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}>
                                {p === 'today' ? '오늘' : p === 'custom' ? '지정일' : p === 'week' ? '이번 주' : '이번 달'}
                            </button>
                        ))}
                    </div>

                    {statsPeriod === 'custom' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                            <Calendar
                                selectedDate={statsDate}
                                onChange={(date) => setStatsDate(date)}
                                harvestedDates={expenditureDates}
                                mode="expenditure"
                                legend={{
                                    label: '지출 분류',
                                    items: [
                                        { value: 1, label: '🚜 농작', color: 'bg-red-400' },
                                        { value: 6, label: '💰 인건', color: 'bg-orange-400' },
                                        { value: 7, label: '🏠 가계', color: 'bg-sky-400' }
                                    ]
                                }}
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
                                    const hasExp = (expenditureDates[dateStr] || []).length > 0;
                                    const expList = expenditureDates[dateStr] || [];
                                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                                    return (
                                        <div key={i} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 min-w-[56px] ${isToday ? 'border-red-400 bg-red-50/30' : 'border-gray-50 bg-white'}`}>
                                            <span className="text-[10px] font-black text-gray-300 uppercase">
                                                {['일', '월', '화', '수', '목', '금', '토'][i]}
                                            </span>
                                            <span className={`text-base font-black ${isToday ? 'text-red-600' : 'text-gray-900'}`}>
                                                {d.getDate()}
                                            </span>
                                            <div className="flex gap-0.5 mt-1 h-1.5 flex-wrap justify-center">
                                                {expList.slice(0, 3).map(typeVal => {
                                                    const hColors: Record<number, string> = {
                                                        1: "bg-red-400", 6: "bg-orange-400", 7: "bg-sky-400"
                                                    };
                                                    return <div key={typeVal} className={`w-1.5 h-1.5 rounded-full ${hColors[typeVal] || "bg-gray-400"} shadow-sm`} />;
                                                })}
                                                {expList.length === 0 && <div className="w-1.5 h-1.5 rounded-full bg-transparent" />}
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
                            <div className="grid grid-cols-4 gap-2">
                                {Array.from({ length: 12 }).map((_, i) => {
                                    const m = i + 1;
                                    const isSelected = statsMonth.month === m;
                                    const isCurrentMonth = new Date().getFullYear() === statsMonth.year && new Date().getMonth() + 1 === m;

                                    return (
                                        <button
                                            key={m}
                                            onClick={() => setStatsMonth({ ...statsMonth, month: m })}
                                            className={`py-3 rounded-2xl text-xs font-black transition-all border-2 ${isSelected
                                                ? 'bg-red-600 border-red-700 text-white shadow-lg'
                                                : isCurrentMonth
                                                    ? 'bg-white border-red-500 text-red-600'
                                                    : 'bg-white border-gray-50 text-gray-500 hover:border-red-100'
                                                }`}
                                        >
                                            {m}월
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-900 rounded-3xl p-5 text-white shadow-xl shadow-gray-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500 opacity-20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <div className="flex justify-between items-start mb-4 gap-2">
                            <div className="min-w-0">
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Expenses</p>
                                <h2 className="text-3xl font-black tracking-tighter truncate text-red-400">{formatCurrency(statsAggregated.total)}</h2>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Category</p>
                                <div className="space-y-0.5 mt-1">
                                    <p className="text-xs font-black text-gray-300">농작: <span className="text-white">{formatCurrency(statsAggregated.byCategory['농작관리'])}</span></p>
                                    <p className="text-xs font-black text-gray-300">인건: <span className="text-white">{formatCurrency(statsAggregated.byCategory['인건비'])}</span></p>
                                    <p className="text-xs font-black text-gray-300">가계: <span className="text-white">{formatCurrency(statsAggregated.byCategory['가계생활'])}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 대분류별 통계 */}
                    <section className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-gray-400" /> 분류별 지출
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { key: '농작관리', name: '농작', color: 'red', icon: <Tag className="w-4 h-4" /> },
                                { key: '인건비', name: '인건', color: 'orange', icon: <Users className="w-4 h-4" /> },
                                { key: '가계생활', name: '가계', color: 'sky', icon: <Heart className="w-4 h-4" /> }
                            ].map(cat => {
                                const amount = statsAggregated.byCategory[cat.key as keyof typeof statsAggregated.byCategory];
                                return (
                                    <div key={cat.key} className={`p-3 rounded-[24px] border transition-all ${amount > 0 ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                                        <div className={`flex justify-between items-start mb-2 text-${cat.color}-500`}>
                                            <div className="text-xs font-black uppercase tracking-tighter">{cat.name}</div>
                                            {cat.icon}
                                        </div>
                                        <div className={`text-sm font-black tracking-tighter truncate ${amount > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                            {amount > 0 ? (amount / 10000).toFixed(0) + '만' : '0'}
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
                                <CalendarDays className="w-4 h-4 text-gray-400" /> 세부 내역 추이
                            </h3>
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
                                {Object.keys(statsAggregated.bySubCat).length === 0 ? (
                                    <div className="text-center py-6 text-xs text-gray-400 font-bold">데이터가 없습니다.</div>
                                ) : (
                                    Object.entries(statsAggregated.bySubCat).sort((a, b) => b[1] - a[1]).map(([subCat, amount]) => (
                                        <div key={subCat} className="flex items-center justify-between p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors rounded-lg">
                                            <span className="text-sm font-bold text-gray-600">{subCat}</span>
                                            <span className="text-base font-black text-gray-900">{formatCurrency(amount)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* ===== 지출 수정/삭제 팝업 모달 ===== */}
            {editModal && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
                    {/* 배경 딤 */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditModal(null)} />

                    {/* 모달 카드 */}
                    <div className="relative bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl shadow-black/20 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
                        {/* 헤더 */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-red-500" />
                                지출 수정
                            </h2>
                            <button onClick={() => setEditModal(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 대분류 */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">대분류</label>
                            <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                {Object.keys(CATEGORY_MAP).map(mCat => (
                                    <button key={mCat}
                                        onClick={() => setEditModal(prev => prev ? { ...prev, main_category: mCat, sub_category: CATEGORY_MAP[mCat][0] } : null)}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${editModal.main_category === mCat ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}>
                                        {mCat === '농작관리' ? '🚜 농작' : mCat === '인건비' ? '💰 인건' : '🏠 가계'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 소분류 */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">소분류</label>
                            <div className="flex flex-wrap gap-1.5">
                                {CATEGORY_MAP[editModal.main_category].map(sCat => (
                                    <button key={sCat}
                                        onClick={() => setEditModal(prev => prev ? { ...prev, sub_category: sCat } : null)}
                                        className={`px-3 py-2 rounded-xl border-2 text-[11px] font-black transition-all ${editModal.sub_category === sCat ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-100 text-gray-400'}`}>
                                        {sCat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 금액 + 결제수단 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">금액</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-3.5 w-4 h-4 text-gray-300" />
                                    <input type="text"
                                        value={editModal.amount ? formatCurrency(editModal.amount) : ''}
                                        onChange={e => setEditModal(prev => prev ? { ...prev, amount: stripNonDigits(e.target.value) } : null)}
                                        className="w-full pl-9 pr-3 py-3 border-2 border-gray-100 bg-gray-50 rounded-2xl text-sm font-black focus:border-red-400 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">결제수단</label>
                                <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                    {['카드', '현금'].map(m => (
                                        <button key={m}
                                            onClick={() => setEditModal(prev => prev ? { ...prev, payment_method: m } : null)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${editModal.payment_method === m ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 날짜 */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">지출 날짜</label>
                            <input type="date"
                                value={editModal.expense_date}
                                onChange={e => setEditModal(prev => prev ? { ...prev, expense_date: e.target.value } : null)}
                                className="w-full p-3 border-2 border-gray-100 bg-gray-50 rounded-2xl text-sm font-black focus:border-red-400 outline-none" />
                        </div>

                        {/* 메모 */}
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">메모</label>
                            <input type="text"
                                value={editModal.notes}
                                onChange={e => setEditModal(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                placeholder="메모를 입력하세요..."
                                className="w-full p-3 border-2 border-gray-100 bg-gray-50 rounded-2xl text-sm font-bold focus:border-red-400 outline-none" />
                        </div>

                        {/* 버튼 */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <button
                                onClick={handleDeleteFromModal}
                                disabled={deleteMutation.isPending}
                                className="py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-500 font-black text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all active:scale-95">
                                <Trash2 className="w-4 h-4" />
                                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={updateMutation.isPending}
                                className="py-4 rounded-2xl bg-red-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-200 hover:bg-red-700 transition-all active:scale-95">
                                <Save className="w-4 h-4" />
                                {updateMutation.isPending ? '저장 중...' : '수정 저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
