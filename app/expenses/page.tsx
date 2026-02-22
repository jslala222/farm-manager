"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Receipt, Calendar as CalendarIcon, CreditCard, Tag, ChevronDown, Filter, X, Search, RefreshCcw, Check, Users, Heart } from "lucide-react";
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
    const [expenses, setExpenses] = useState<Expenditure[]>([]);
    const [loading, setLoading] = useState(true);
    const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [isAdding, setIsAdding] = useState(false);

    // Filter State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [mainFilter, setMainFilter] = useState<string | null>(null);
    const [showCalendar, setShowCalendar] = useState(true);

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

    useEffect(() => {
        if (initialized && farm?.id) {
            fetchExpenses();
        }
    }, [farm, initialized]);

    const fetchExpenses = async () => {
        if (!farm?.id) return;
        setLoading(true);
        setDbStatus('connecting');

        const { data, error } = await supabase.from('expenditures').select('*')
            .eq('farm_id', farm.id).order('expense_date', { ascending: false });

        if (error) {
            console.error("지출 내역 로드 실패:", error);
            setDbStatus('error');
        } else {
            setExpenses(data ?? []);
            setDbStatus('connected');
        }
        setLoading(false);
    };

    const handleAddExpense = async () => {
        if (!amount || !farm?.id) return;
        setLoading(true);
        const { error } = await supabase.from('expenditures').insert({
            farm_id: farm.id,
            main_category: mainCategory,
            sub_category: subCategory,
            category: subCategory, // Legacy 하위 호환
            amount: parseInt(stripNonDigits(amount)),
            payment_method: paymentMethod, // [bkit] 결제 수단 추가
            notes,
            expense_date: expenseDate
        });

        if (error) {
            alert(`저장 실패: ${error.message}`);
            setLoading(false);
        } else {
            setAmount("");
            setNotes("");
            setIsAdding(false);
            fetchExpenses();
        }
    };

    const deleteExpense = async (id: string) => {
        if (!confirm("이 지출 기록을 삭제하시겠습니까?")) return;
        const { error } = await supabase.from('expenditures').delete().eq('id', id);
        if (error) alert("삭제 실패");
        else fetchExpenses();
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

    return (
        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-2xl mx-auto space-y-6">
            {/* 헤더 서비스 상태 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        지출 관리
                        <Receipt className="w-5 h-5 text-red-500" />
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${dbStatus === 'connected' ? 'bg-green-50 text-green-600' :
                            dbStatus === 'error' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-green-500' :
                                dbStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
                                }`}></span>
                            {dbStatus === 'connected' ? 'DB 연결 성공' : dbStatus === 'error' ? 'DB 연결 끊김' : 'DB 연결 중...'}
                        </div>
                        {dbStatus === 'error' && (
                            <button onClick={fetchExpenses} className="text-[9px] font-black text-blue-600 underline cursor-pointer">재연결</button>
                        )}
                    </div>
                </div>

                <button onClick={() => setIsAdding(!isAdding)}
                    className={`px-5 py-2.5 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg active:scale-95 ${isAdding ? 'bg-gray-100 text-gray-500' : 'bg-red-600 text-white shadow-red-200'
                        }`}>
                    {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isAdding ? '취소' : '지출 기록'}
                </button>
            </div>

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
                <div className="bg-white rounded-[2.5rem] border border-red-100 shadow-2xl shadow-red-100/50 p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
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
                    <div className="bg-white border-4 border-red-500 rounded-[2.5rem] p-6 space-y-5 shadow-2xl shadow-red-100/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 opacity-50"></div>

                        <div className="flex items-center justify-between border-b border-red-100 pb-4 relative z-10">
                            <p className="text-[12px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                                {monthlySummary.month}월 지출 실시간 리포트
                            </p>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{monthlySummary.count}건</span>
                                <span className="text-xl font-black text-red-600">{formatCurrency(monthlySummary.total)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 relative z-10">
                            <div className="bg-red-50/80 p-3 rounded-2xl border border-red-100 transition-transform hover:scale-[1.02]">
                                <p className="text-[10px] font-black text-red-400 mb-1 flex items-center gap-1">🚜 농작</p>
                                <p className="text-sm font-black text-gray-900 tracking-tighter">{formatCurrency(monthlySummary.stats['농작관리'])}</p>
                            </div>
                            <div className="bg-orange-50/80 p-3 rounded-2xl border border-orange-100 transition-transform hover:scale-[1.02]">
                                <p className="text-[10px] font-black text-orange-400 mb-1 flex items-center gap-1">💰 인건</p>
                                <p className="text-sm font-black text-gray-900 tracking-tighter">{formatCurrency(monthlySummary.stats['인건비'])}</p>
                            </div>
                            <div className="bg-sky-50/80 p-3 rounded-2xl border border-sky-100 transition-transform hover:scale-[1.02]">
                                <p className="text-[10px] font-black text-sky-400 mb-1 flex items-center gap-1">🏠 가계</p>
                                <p className="text-sm font-black text-gray-900 tracking-tighter">{formatCurrency(monthlySummary.stats['가계생활'])}</p>
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
                        filteredExpenses.map(exp => (
                            <div key={exp.id} className="group bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-colors ${exp.main_category === '농작관리' ? 'bg-red-50 text-red-500' : exp.main_category === '인건비' ? 'bg-orange-50 text-orange-500' : 'bg-sky-50 text-sky-500'
                                        }`}>
                                        {exp.main_category === '농작관리' ? <Tag size={24} /> : exp.main_category === '인건비' ? <Users size={24} /> : <Heart size={24} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-xl font-black text-gray-900 tracking-tight">{formatCurrency(exp.amount)}</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black ${exp.main_category === '농작관리' ? 'bg-red-50 text-red-600' : exp.main_category === '인건비' ? 'bg-orange-50 text-orange-600' : 'bg-sky-50 text-sky-600'
                                                }`}>
                                                {exp.sub_category || exp.category}
                                            </span>
                                            <span className="text-[10px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-100 font-bold">
                                                {exp.payment_method || '카드'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <p className="font-bold">{exp.notes || '메모 없음'}</p>
                                            <span className="text-gray-200">|</span>
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                                <CalendarIcon size={10} />
                                                {exp.expense_date}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => deleteExpense(exp.id)}
                                    className="p-3 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
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
        </div>
    );
}

