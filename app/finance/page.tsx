"use client";

import { useState, useEffect } from "react";
import {
    Calculator,
    TrendingUp,
    ArrowDownCircle,
    ArrowUpCircle,
    Calendar,
    Users,
    ShoppingCart,
    Truck,
    CreditCard,
    ChevronRight,
    TrendingDown,
    Building2,
    Package,
    ArrowRightLeft,
    Download,
    BarChart3,
    AlertTriangle,
    RefreshCcw,
    X,
    Utensils,
    Calendar as CalendarIcon
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { settlementService } from "@/lib/settlementService";
import CalendarUI from "@/components/Calendar";

export default function FinancePage() {
    const { farm, initialized } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Summary Stats
    const [revenue, setRevenue] = useState(0);        // 총 매출
    const [laborCost, setLaborCost] = useState(0);    // 총 인건비
    const [mealCost, setMealCost] = useState(0);      // 식대 및 새참비
    const [expense, setExpense] = useState(0);        // 일반 지출
    const [shippingCost, setShippingCost] = useState(0); // 택배비(자재비 포함)
    const [unsettledB2B, setUnsettledB2B] = useState(0); // 미결산 B2B
    const [unsettledRecords, setUnsettledRecords] = useState<any[]>([]); // 미결산 상세 내역
    const [dbError, setDbError] = useState<string | null>(null); // DB 스키마 오류 상태

    // Detailed Stats
    const [b2bRevenue, setB2bRevenue] = useState(0);
    const [b2cRevenue, setB2cRevenue] = useState(0);
    const [settledB2bCount, setSettledB2bCount] = useState(0);
    const [unsettledB2bCount, setUnsettledB2bCount] = useState(0);
    const [unsettledB2cRecords, setUnsettledB2cRecords] = useState<any[]>([]); // 미결산 택배 내역
    const [financeTab, setFinanceTab] = useState<'b2b' | 'b2c'>('b2b');

    // [bkit 정밀 정산 모달용 상태]
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<{
        partnerId: string;
        companyName: string;
        date: string;
        records: any[];
    } | null>(null);
    const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
    const [actualSettleAmount, setActualSettleAmount] = useState<string>("");
    const [expandedPartners, setExpandedPartners] = useState<string[]>([]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (initialized && farm?.id) {
            fetchFinanceData();
        }
    }, [farm, initialized, selectedMonth]);

    // [bkit] 실시간 결산 엔진 (사장님의 "실시간 반영" 요구사항 반영)
    useEffect(() => {
        const channel = supabase
            .channel('finance_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_records' }, () => {
                fetchFinanceData(); // 판매 기록 변경 시 즉시 결산 재계산
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenditures' }, () => {
                fetchFinanceData(); // 지출 변경 시 즉시 반영
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [farm?.id, selectedMonth]);

    const fetchFinanceData = async () => {
        if (!farm?.id) return;
        setLoading(true);

        const startDate = `${selectedMonth}-01T00:00:00`;
        const lastDay = new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).getDate();
        const endDate = `${selectedMonth}-${lastDay}T23:59:59`;

        setUnsettledB2cRecords([]); // 초기화

        try {
            // [bkit 날짜 정밀 계산] 2월 31일 같은 잘못된 날짜 방지
            const year = parseInt(selectedMonth.split('-')[0]);
            const month = parseInt(selectedMonth.split('-')[1]);
            const lastDay = new Date(year, month, 0).getDate();
            const startStr = `${selectedMonth}-01T00:00:00`;
            const endStr = `${selectedMonth}-${lastDay}T23:59:59`;

            // [bkit 전역 결산 엔진] 
            // 1. 월별 통계용 데이터 (지출 등)는 해당 월로 한정
            // 2. 미정산 내역은 날짜 상관없이 전체 조회 (사장님 지시사항)
            const { data: salesData, error: salesError } = await supabase
                .from('sales_records')
                .select('*, partner:partners(company_name), customer:customers(name)')
                .eq('farm_id', farm.id)
                .or(`and(recorded_at.gte.${startStr},recorded_at.lte.${endStr}),is_settled.eq.false`)
                .order('recorded_at', { ascending: false });

            if (salesError) throw salesError;

            // 2. 지출 데이터 (Expenditures) - 카테고리 포함 조회
            const { data: expensesData } = await supabase
                .from('expenditures')
                .select('amount, category, main_category')
                .eq('farm_id', farm.id)
                .gte('expense_date', startStr.split('T')[0])
                .lte('expense_date', endStr.split('T')[0]);

            // 3. 인건비 데이터 (Attendance)
            const { data: attendanceData } = await supabase
                .from('attendance_records')
                .select('daily_wage, headcount')
                .eq('farm_id', farm.id)
                .eq('is_present', true)
                .gte('work_date', startStr.split('T')[0])
                .lte('work_date', endStr.split('T')[0]);

            let totalRev = 0;
            let b2bRev = 0;
            let b2cRev = 0;
            let totalShipping = 0;
            let unsettledAmt = 0;
            let unsettledCount = 0;
            let settledCount = 0;
            const uRecords: any[] = [];
            const newUnsettledB2c: any[] = []; // [수정] 배열에 수집 후 한 번에 업데이트

            salesData?.forEach((rec: any) => {
                const recDate = rec.recorded_at.split('T')[0];
                const isInSelectedMonth = recDate.startsWith(selectedMonth);

                const price = settlementService.calculateRecordTotal(rec);

                // 1. 미정산 내역은 날짜 상관없이 무조건 추출 (중요!)
                if (settlementService.isB2B(rec) && !rec.is_settled) {
                    unsettledAmt += price;
                    unsettledCount++;
                    uRecords.push(rec);
                } else if (settlementService.isB2C(rec) && !rec.is_settled) {
                    newUnsettledB2c.push(rec); // [수정] 로컬 배열에 푸시
                }

                // 2. 상단 대시보드 통계는 '선택된 월'의 데이터만 합산
                if (isInSelectedMonth) {
                    totalRev += price;
                    if (settlementService.isB2B(rec)) {
                        b2bRev += price;
                        if (rec.is_settled) settledCount++;
                    } else {
                        b2cRev += price;
                        if (settlementService.isB2C(rec)) {
                            totalShipping += (rec.shipping_cost || 0) + (rec.packaging_cost || 0);
                        }
                    }
                }
            });

            // [bkit 데이터 출처 정밀화] 
            // 1. 인건비 및 식대 분리 집계
            const WAGE_CATS = ["기본급/월급", "아르바이트(일당)", "명절떡값/선물", "성과급/보너스", "퇴직금/보험", "기타 인건비"];

            // 순수 인건비 (식대 제외)
            const wagesExpenses = expensesData?.filter((e: any) => {
                const isWageSub = WAGE_CATS.includes(e.category || "");
                const isWageMain = e.main_category === '인건비' && !e.category?.includes('식대');
                const hasWageKeyword = (e.category?.includes('인건비') || e.category?.includes('일당')) && !e.category?.includes('식대');
                return (isWageSub || isWageMain || hasWageKeyword) && !e.category?.includes('식대');
            }) || [];

            // 식대 (식대/새참비 등)
            const mealsExpenses = expensesData?.filter((e: any) => {
                return (e.category?.includes('식대') || e.category?.includes('새참')) || (e.main_category === '인건비' && e.category?.includes('식대'));
            }) || [];

            const totalWagesFromExpenses = wagesExpenses.reduce((acc: any, curr: any) => acc + (curr.amount || 0), 0);
            const totalMealsFromExpenses = mealsExpenses.reduce((acc: any, curr: any) => acc + (curr.amount || 0), 0);

            // 출근부 기반 자동 계산 (출근부는 보통 인건비(일당)에 포함)
            const attendanceWages = attendanceData?.reduce((acc: any, curr: any) => {
                return acc + ((curr.daily_wage || 0) * (curr.headcount || 1));
            }, 0) || 0;

            const finalWages = totalWagesFromExpenses + (attendanceWages > 0 ? attendanceWages : 0);
            const finalMeals = totalMealsFromExpenses;

            // 2. 일반 지출 합계 (인건비, 식대를 제외한 나머지)
            const normalExpenses = expensesData?.filter((e: any) =>
                !wagesExpenses.includes(e) && !mealsExpenses.includes(e)
            ) || [];
            const totalExp = normalExpenses.reduce((acc: any, curr: any) => acc + (curr.amount || 0), 0) || 0;

            setRevenue(totalRev);
            setB2bRevenue(b2bRev);
            setB2cRevenue(b2cRev);
            setShippingCost(totalShipping);
            setLaborCost(finalWages);
            setMealCost(finalMeals);
            setExpense(totalExp);
            setUnsettledB2B(unsettledAmt);
            setUnsettledB2bCount(unsettledCount);
            setSettledB2bCount(settledCount);
            setUnsettledB2cRecords(newUnsettledB2c); // [수정] 한 번에 업데이트 적용

            // [bkit 정밀 2단계 그룹화] 거래처(Partner) -> 날짜(Date)
            const partnerMap = new Map();

            uRecords.forEach(rec => {
                const displayName = rec.partner?.company_name || rec.customer?.name || rec.customer_name || "미지정";
                const pKey = rec.partner_id || `no-id-${displayName}`;
                const date = rec.recorded_at.split('T')[0];
                const price = settlementService.calculateRecordTotal(rec);

                if (!partnerMap.has(pKey)) {
                    partnerMap.set(pKey, {
                        partnerId: rec.partner_id,
                        companyName: displayName,
                        totalAmount: 0,
                        qtyByUnit: {},
                        dailyGroups: new Map()
                    });
                }
                const pGroup = partnerMap.get(pKey);
                pGroup.totalAmount += price;
                const recUnit = rec.sale_unit || '박스';
                pGroup.qtyByUnit[recUnit] = (pGroup.qtyByUnit[recUnit] || 0) + (rec.quantity || 0);

                if (!pGroup.dailyGroups.has(date)) {
                    pGroup.dailyGroups.set(date, {
                        partnerId: rec.partner_id,
                        companyName: displayName,
                        date: date,
                        records: [],
                        amount: 0
                    });
                }
                const dGroup = pGroup.dailyGroups.get(date);
                dGroup.records.push(rec);
                dGroup.amount += price;
            });

            // Map을 Array로 변환하여 저장
            const finalGrouped = Array.from(partnerMap.values()).map(p => ({
                ...p,
                dailyGroups: Array.from(p.dailyGroups.values()).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            })).sort((a, b) => b.totalAmount - a.totalAmount); // 금액 큰 순서대로

            setUnsettledRecords(finalGrouped);
            setLaborCost(finalWages);
            setMealCost(finalMeals);
            setExpense(totalExp);
            setDbError(null);

        } catch (error: any) {
            console.error("Finance data fetch error:", error);
            if (error.message?.includes('is_settled')) {
                setDbError("정산용 데이터베이스 필드(is_settled)가 아직 준비되지 않았습니다.\n[자동 복구] 버튼을 눌러주세요. 사장님은 신경 쓰지 마세요!");
            } else {
                setDbError("데이터를 불러오는 중 오류가 발생했습니다: " + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAutoFix = async () => {
        if (!confirm("데이터베이스 구조를 자동으로 정례화하시겠습니까?\n(정산 기능에 필요한 필드가 즉시 생성됩니다.)")) return;

        setLoading(true);
        const sql = `ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;`;

        // exec_sql RPC가 있는지 먼저 확인하고 시도
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            alert("자동 복구 도중 오류가 발생했습니다.\n사장님, 죄송하지만 'SQL Editor'에 제가 드린 코드를 한 번만 붙여넣어 주세요.\n(RPC 권한 부족 등의 이유일 수 있습니다.)");
        } else {
            alert("DB 구조가 성공적으로 복구되었습니다! 이제 시원하게 정산하실 수 있습니다. 🍓");
            fetchFinanceData();
        }
        setLoading(false);
    };

    const handleGradeSettle = async () => {
        if (!selectedGroup || !farm?.id) return;
        if (!confirm("입력하신 정보로 정산을 확정하시겠습니까?")) return;

        setLoading(true);
        const actualAmt = parseInt(actualSettleAmount.replace(/[^0-9]/g, "")) || 0;

        try {
            const promises: Promise<any>[] = [];

            // 각 record(품목)별로 처리
            selectedGroup.records.forEach((record: any, recIdx: number) => {
                let gradeEntries: { grade: string; qty: number }[] = [];
                if (record.grade && record.grade.includes(':')) {
                    gradeEntries = record.grade.split(',').map((g: string) => {
                        const [label, qty] = g.split(':');
                        return { grade: label, qty: Number(qty) || 0 };
                    });
                } else {
                    gradeEntries = [{ grade: record.grade || '특/상', qty: record.quantity || 0 }];
                }

                let totalPrice = 0;
                let totalQty = 0;
                const updatedGrades: string[] = [];

                gradeEntries.forEach(entry => {
                    const qtyEl = document.getElementById(`modal-qty-${recIdx}-${entry.grade}`) as HTMLInputElement;
                    const priceEl = document.getElementById(`modal-price-${recIdx}-${entry.grade}`) as HTMLInputElement;

                    // 수량은 모달 입력값 우선, 없으면 기존값
                    const q = qtyEl ? (parseInt(qtyEl.value) || 0) : entry.qty;
                    // 단가는 모달 입력값 우선, 없으면 0
                    const p = priceEl ? (parseInt(priceEl.value.replace(/[^0-9]/g, "")) || 0) : 0;

                    totalQty += q;
                    totalPrice += (q * p);
                    updatedGrades.push(`${entry.grade}:${q}`);
                });

                // 실제 입금액이 있는 경우: 첫 번째 레코드에 전체 금액 할당, 나머지는 0
                // 실제 입금액이 없는 경우: 계산된 totalPrice 사용
                let finalSettledAmt = 0;
                if (actualAmt > 0) {
                    finalSettledAmt = (recIdx === 0) ? actualAmt : 0;
                } else {
                    finalSettledAmt = totalPrice;
                }

                const updateData: any = {
                    quantity: totalQty,
                    grade: updatedGrades.join(','),
                    price: totalPrice || null, // 참고용 계산가
                    is_settled: true,
                    settled_amount: finalSettledAmt,
                    settled_at: settleDate,
                };

                promises.push(
                    supabase.from('sales_records').update(updateData).eq('id', record.id) as any
                );
            });

            const results = await Promise.all(promises);
            const errorResults = results.filter(r => r.error);

            if (errorResults.length > 0) {
                const messages = errorResults.map(r => r.error?.message).join("\n");
                throw new Error(`DB 저장 오류: ${messages}`);
            }

            alert("정산이 성공적으로 완료되었습니다! 🍓");
            setIsSettleModalOpen(false);
            fetchFinanceData();
        } catch (error: any) {
            console.error("Settlement Error:", error);
            alert("정산 처리 중 오류가 발생했습니다: " + (error.message || "알 수 없는 오류"));
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSettle = async (id: string, finalPrice: number) => {
        // ... (Legacy or fallback)
    };

    const netProfit = revenue - laborCost - expense - shippingCost;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
            <div className="max-w-2xl mx-auto p-4 space-y-3 animate-in fade-in duration-500">

                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-3 bg-gray-900 rounded-2xl shadow-xl shadow-gray-200 shrink-0">
                            <Calculator className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-black text-gray-900 tracking-tight whitespace-nowrap">통합 결산</h1>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">재무 대시보드</p>
                        </div>
                    </div>

                    <div className="relative shrink-0">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-white border-2 border-gray-100 rounded-xl px-3 py-2 text-sm font-black text-gray-700 outline-none focus:border-gray-900 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* DB 오류 알림 및 복구 버튼 (Zero-Touch) */}
                {dbError && (
                    <div className="bg-amber-50 border-2 border-amber-200 p-3 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-amber-100 rounded-2xl text-amber-600"><AlertTriangle className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-black text-amber-900">데이터베이스 동기화가 필요합니다 🍓</h3>
                                <p className="text-xs font-bold text-amber-700 leading-relaxed mt-1 break-keep whitespace-pre-line">{dbError}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleAutoFix}
                            className="w-full bg-amber-600 text-white py-4 rounded-2xl text-sm font-black shadow-lg shadow-amber-100 hover:bg-amber-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCcw className="w-4 h-4" /> 1초 만에 자동 복구하기 (Zero-Touch)
                        </button>
                    </div>
                )}

                {/* 메인 수익성 카드 */}
                <div className="bg-gray-900 rounded-[2.5rem] p-4 text-white shadow-2xl shadow-gray-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>

                    <div className="relative z-10 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">이번 달 예상 순이익</p>
                                <h2 className="text-2xl font-black tracking-tighter text-white break-all">
                                    {formatCurrency(netProfit)}
                                </h2>
                            </div>
                            <div className={`px-3 py-1.5 rounded-2xl font-bold text-xs flex items-center gap-1 shadow-lg shrink-0
                                ${netProfit >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {netProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                {profitMargin.toFixed(1)}%
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                            <div className="min-w-0">
                                <p className="text-gray-500 text-[9px] font-bold uppercase mb-1">총 매출액</p>
                                <p className="text-sm font-black text-white break-all">{formatCurrency(revenue)}</p>
                            </div>
                            <div className="text-right min-w-0">
                                <p className="text-gray-500 text-[9px] font-bold uppercase mb-1">총 지출액</p>
                                <p className="text-sm font-black text-gray-300 break-all">{formatCurrency(laborCost + mealCost + expense + shippingCost)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 인건비 섹션 */}
                    <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-1.5 relative overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-blue-50 rounded-lg shrink-0"><Users className="w-3.5 h-3.5 text-blue-600" /></div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wide truncate">순수 인건비</span>
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(laborCost)}</p>
                        <p className="text-[9px] text-gray-400 font-bold">일당/월급 등</p>
                    </div>

                    {/* 식대 섹션 */}
                    <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-1.5 relative overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-amber-50 rounded-lg shrink-0"><Utensils className="w-3.5 h-3.5 text-amber-600" /></div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wide truncate">식대/새참비</span>
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(mealCost)}</p>
                        <p className="text-[9px] text-gray-400 font-bold">식당/새참 비용</p>
                    </div>

                    <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-1.5 relative overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-pink-50 rounded-lg shrink-0"><Truck className="w-3.5 h-3.5 text-pink-600" /></div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wide truncate">택배/자재비</span>
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(shippingCost)}</p>
                        <p className="text-[9px] text-gray-400 font-bold">택배/자재비</p>
                    </div>

                    <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-1.5 relative overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-indigo-50 rounded-lg shrink-0"><Download className="w-3.5 h-3.5 text-indigo-600" /></div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wide truncate">기타 영농지출</span>
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(expense)}</p>
                        <p className="text-[9px] text-gray-400 font-bold">공과금/유류비</p>
                    </div>
                </div>

                {/* [bkit 판매 달력 토글] */}
                <div className="bg-white rounded-[2rem] border-2 border-green-100 p-3 flex flex-col gap-4 shadow-sm mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-xl">
                                <CalendarIcon className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-gray-900">판매 출하 달력</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">일자별 미결산 건 현황</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${showCalendar ? 'bg-gray-100 text-gray-500' : 'bg-green-600 text-white shadow-lg shadow-green-100'}`}
                        >
                            {showCalendar ? '달력 숨기기' : '달력 보기'}
                        </button>
                    </div>

                    {showCalendar && (
                        <div className="pt-4 border-t border-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">
                            <CalendarUI
                                selectedDate={selectedDate}
                                onChange={setSelectedDate}
                                harvestedDates={(() => {
                                    const dates: Record<string, number[]> = {};
                                    unsettledRecords.forEach((p: any) => {
                                        p.dailyGroups.forEach((d: any) => {
                                            const dt = d.date;
                                            if (!dates[dt]) dates[dt] = [];
                                            if (!dates[dt].includes(2)) dates[dt].push(2);
                                        });
                                    });
                                    return dates;
                                })()}
                                mode="expenditure"
                                legend={{
                                    label: '판매 현황',
                                    items: [
                                        { value: 2, label: '🚚 미결산 건 있음', color: 'bg-amber-400' }
                                    ]
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* B2B 미결산 관리 섹션 */}
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-6">
                    <div className="p-3 bg-amber-50/50 border-b border-gray-50 flex items-center justify-between">
                        <h3 className="text-sm font-black text-amber-900 flex items-center gap-2">
                            <Building2 className="w-4 h-4" /> 거래처 미결재 리포트
                        </h3>
                        <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">{unsettledRecords.reduce((acc: number, p: any) => acc + p.dailyGroups.length, 0)}건 대기</span>
                    </div>
                    <div className="p-5 space-y-5">
                        <div className="flex items-end justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-400 mb-1">입금 대기 중인 금액</p>
                                <h4 className="text-xl font-black text-gray-900 break-all">{formatCurrency(unsettledB2B)}</h4>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs font-bold text-green-600 mb-1">확정/입금된 금액</p>
                                <p className="text-base font-black text-gray-400">{formatCurrency(b2bRevenue - unsettledB2B)}</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm"><ArrowRightLeft className="w-4 h-4 text-gray-400" /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-700">전체 B2B 납품</p>
                                    <p className="text-[10px] text-gray-400 font-medium">총 {settledB2bCount + unsettledB2bCount}건의 거래 발생</p>
                                </div>
                            </div>
                            <div className="flex -space-x-2">
                                <div className="w-8 h-2 bg-green-500 rounded-l-full" style={{ width: `${(settledB2bCount / (settledB2bCount + unsettledB2bCount || 1)) * 100}%` }}></div>
                                <div className="w-8 h-2 bg-amber-400 rounded-r-full" style={{ width: `${(unsettledB2bCount / (settledB2bCount + unsettledB2bCount || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="flex gap-4 p-1 bg-gray-100 rounded-2xl mb-6">
                    <button
                        onClick={() => setFinanceTab('b2b')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${financeTab === 'b2b' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                    >
                        거래처 미결재 ({unsettledRecords.reduce((acc: number, p: any) => acc + p.dailyGroups.length, 0)})
                    </button>
                    <button
                        onClick={() => setFinanceTab('b2c')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${financeTab === 'b2c' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                    >
                        택배거래 미결재 ({unsettledB2cRecords.length})
                    </button>
                </div>

                {/* 미결산 리스트 섹션 */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                            <ArrowRightLeft className="w-4 h-4 text-amber-500" />
                            {financeTab === 'b2b' ? '거래처 미결재 상세' : '택배거래 미결재 내역'}
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400">날짜순 정렬</span>
                    </div>

                    <div className="space-y-4">
                        {financeTab === 'b2b' ? (
                            unsettledRecords.length === 0 ? (
                                <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 py-10 text-center">
                                    <p className="text-xs font-bold text-gray-400">모든 B2B 정산이 완료되었습니다! 🍓</p>
                                </div>
                            ) : (
                                unsettledRecords.map((partnerGroup: any, pIdx: number) => {
                                    const pKey = partnerGroup.partnerId || `no-id-${partnerGroup.companyName}`;
                                    const isExpanded = expandedPartners.includes(pKey);

                                    return (
                                        <div key={pKey} className="space-y-4">
                                            {/* [bkit 거래처 요약 카드] */}
                                            <button
                                                onClick={() => {
                                                    setExpandedPartners(prev =>
                                                        isExpanded ? prev.filter(k => k !== pKey) : [...prev, pKey]
                                                    );
                                                }}
                                                className={`w-full text-left bg-white rounded-3xl border-2 p-5 shadow-sm flex items-center justify-between transition-all active:scale-95 ${isExpanded ? 'border-green-400 bg-green-50/30' : 'border-gray-100'}`}
                                            >
                                                <div className="flex-1 min-w-0 space-y-1.5 pr-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-lg font-black text-gray-900 leading-tight truncate">{partnerGroup.companyName}</h4>
                                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${isExpanded ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {partnerGroup.dailyGroups.length}건
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-400 font-black truncate">
                                                        미정산 · 총 {Object.entries(partnerGroup.qtyByUnit || {}).map(([u, q]) => `${(q as number).toLocaleString()}${u}`).join(', ')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <p className={`text-[10px] font-black uppercase tracking-wide mb-0.5 ${isExpanded ? 'text-green-600' : 'text-amber-600'}`}>미결산</p>
                                                        <p className="text-xl font-black text-gray-900 whitespace-nowrap">{formatCurrency(partnerGroup.totalAmount)}</p>
                                                    </div>
                                                    <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-green-100 text-green-600' : 'bg-gray-50 text-gray-300'}`}>
                                                        <ChevronRight className={`w-5 h-5 ${isExpanded ? 'rotate-90' : ''}`} />
                                                    </div>
                                                </div>
                                            </button>

                                            {/* [bkit 상세 내역 아코디언] */}
                                            {isExpanded && (
                                                <div className="pl-6 border-l-4 border-green-200 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                    {partnerGroup.dailyGroups.map((dateGroup: any, dIdx: number) => (
                                                        <button
                                                            key={`${pKey}-${dateGroup.date}`}
                                                            onClick={() => {
                                                                setSelectedGroup(dateGroup);
                                                                setActualSettleAmount("");
                                                                setIsSettleModalOpen(true);
                                                            }}
                                                            className="w-full text-left bg-white rounded-[2rem] border-2 border-gray-50 p-3 shadow-sm flex items-center justify-between hover:border-green-300 transition-all active:scale-[0.98]"
                                                        >
                                                            <div className="flex gap-6 items-center">
                                                                <div className="w-16 h-16 bg-white rounded-2xl flex flex-col items-center justify-center border-2 border-green-100 shadow-sm">
                                                                    <span className="text-[10px] font-black text-green-400 uppercase">{dateGroup.date.split('-')[1]}월</span>
                                                                    <span className="text-xl font-black text-green-600">{dateGroup.date.split('-')[2]}</span>
                                                                </div>
                                                                <div>
                                                                    <p className="text-lg font-black text-gray-900">
                                                                        {dateGroup.records.length}개 품목 • {
                                                                            Object.entries(dateGroup.records.reduce((acc: any, r: any) => {
                                                                                const u = r.sale_unit || '박스';
                                                                                acc[u] = (acc[u] || 0) + (r.quantity || 0);
                                                                                return acc;
                                                                            }, {})).map(([u, q]) => `${(q as number).toLocaleString()}${u}`).join(', ')
                                                                        }
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                                        {dateGroup.records.slice(0, 3).map((r: any, rIdx: number) => {
                                                                            const cropIcon = r.crop_name === '딸기' ? '🍓' : r.crop_name === '고구마' ? '🍠' : r.crop_name === '감자' ? '🥔' : '📦';
                                                                            return <span key={r.id} className="text-xs font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{cropIcon} {r.crop_name}</span>;
                                                                        })}
                                                                        {dateGroup.records.length > 3 && <span className="text-xs font-black text-gray-400">외 {dateGroup.records.length - 3}</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="mb-2">
                                                                    {dateGroup.amount > 0 ? (
                                                                        <p className="text-xl font-black text-gray-900">{formatCurrency(dateGroup.amount)}</p>
                                                                    ) : (
                                                                        <span className="text-red-500 bg-red-50 px-3 py-1.5 rounded-xl text-xs font-black animate-pulse border border-red-100">단가 미입력</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs font-black text-green-600 uppercase flex items-center justify-end gap-1">
                                                                    정산하기 <ChevronRight className="w-3 h-3" />
                                                                </p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )
                        ) : (
                            unsettledB2cRecords.length === 0 ? (
                                <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 py-10 text-center">
                                    <p className="text-xs font-bold text-gray-400">모든 택배 입금이 확인되었습니다! 🍓</p>
                                </div>
                            ) : (
                                unsettledB2cRecords.map((rec, idx) => (
                                    <div key={`${rec.id}-${idx}`} className="bg-white rounded-3xl border border-pink-100 p-5 shadow-sm space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black bg-pink-100 text-pink-700 px-2 py-0.5 rounded">택배 입금전</span>
                                                    <span className="text-[10px] font-bold text-gray-400">{rec.recorded_at.split('T')[0]}</span>
                                                </div>
                                                <h4 className="font-black text-gray-900 flex items-center gap-2">
                                                    {rec.customer?.name || rec.customer_name}
                                                    <span className="text-[10px] font-bold text-pink-400 bg-pink-50 px-1.5 py-0.5 rounded ml-auto">진짜 데이터 🍓</span>
                                                </h4>
                                                <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 bg-gray-50 p-2 rounded-lg">🏠 {rec.address || rec.customer?.address || "주소 미상"}</p>
                                                <div className="mt-3 space-y-1 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                                    <div className="flex justify-between items-center text-[11px]">
                                                        <span className="text-slate-400 font-bold">상품 ({rec.quantity || 1}{rec.sale_unit || '박스'})</span>
                                                        <span className="text-slate-600 font-black">{formatCurrency(rec.price || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[11px]">
                                                        <span className="text-slate-400 font-bold">택배비 ({rec.shipping_fee_type || '선불'})</span>
                                                        <span className="text-slate-600 font-black">{formatCurrency(rec.shipping_cost || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[11px]">
                                                        <span className="text-slate-400 font-bold">결제 수단</span>
                                                        <span className="text-slate-600 font-black">{rec.payment_method || '미지정'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 mt-1">
                                                        <span className="text-pink-500 font-black text-xs">총 입금액(상품가)</span>
                                                        <span className="text-pink-600 font-black text-lg">{formatCurrency(rec.price || 0)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm("입금 확인 처리를 하시겠습니까?")) return;
                                                    const { error } = await supabase.from('sales_records').update({ is_settled: true, payment_status: 'completed' }).eq('id', rec.id);
                                                    if (!error) fetchFinanceData();
                                                }}
                                                className="bg-pink-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg shadow-pink-100 active:scale-95 transition-all"
                                            >
                                                입금 확인
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </section>

                {/* 판매 채널별 매출 비중 */}
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-3 space-y-3">
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-gray-400" /> 판매 채널별 매출
                    </h3>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black text-gray-700">B2B 대량 납품</span>
                                <span className="text-sm font-black text-gray-900">{formatCurrency(b2bRevenue)}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${(b2bRevenue / (revenue || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black text-gray-700">B2C 개별 택배</span>
                                <span className="text-sm font-black text-gray-900">{formatCurrency(b2cRevenue)}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-pink-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${(b2cRevenue / (revenue || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 기타 지출 상세 */}
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-3 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                            <ArrowDownCircle className="w-4 h-4 text-red-400" /> 일반 기타 지출
                        </h3>
                        <p className="text-lg font-black text-gray-900">{formatCurrency(expense)}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">자재비, 비료, 공과금, 유류비 등 영농 부대 비용</p>
                </section>

                {/* 하단 버튼 */}
                <div className="flex gap-3">
                    <button className="flex-1 bg-white border-2 border-gray-100 py-4 rounded-2xl text-sm font-black text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all">
                        <Download className="w-4 h-4" /> 엑셀 다운로드
                    </button>
                    <button className="flex-1 bg-indigo-600 py-4 rounded-2xl text-sm font-black text-white shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all">
                        결산 리포트 공유
                    </button>
                </div>

                {/* [bkit 정밀 정산 모달 UI] */}
                {isSettleModalOpen && selectedGroup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-4 bg-orange-500 text-white flex justify-between items-center shadow-lg">
                                <div>
                                    <h3 className="text-xl font-black tracking-tighter truncate">{selectedGroup.companyName} 정산</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="bg-white/20 px-2 py-1 rounded text-[11px] font-black uppercase tracking-wider text-orange-50 border border-white/20">납품일자</span>
                                        <p className="text-lg text-white font-black tracking-tight">{selectedGroup.date}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsSettleModalOpen(false)} className="p-3 hover:bg-black/10 rounded-full transition-colors">
                                    <X className="w-8 h-8 text-white" />
                                </button>
                            </div>

                            <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">
                                {/* 1. 품목별 등급 물량 및 가격 */}
                                <section className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b-2 border-blue-100">
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <Package className="w-4 h-4" />
                                            <span className="text-xs font-black uppercase tracking-widest">품목별 물량 &amp; 단가</span>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-1 rounded">{selectedGroup.records.length}품목</span>
                                    </div>

                                    {selectedGroup.records.map((record: any, recIdx: number) => {
                                        const cropIcon = record.crop_name === '딸기' ? '🍓' : record.crop_name === '고구마' ? '🍠' : record.crop_name === '감자' ? '🥔' : record.crop_name === '샤인머스켓' ? '🍇' : '📦';
                                        const unit = record.sale_unit || '박스';
                                        let gradeEntries: { grade: string; qty: number }[] = [];
                                        if (record.grade && record.grade.includes(':')) {
                                            gradeEntries = record.grade.split(',').map((g: string) => {
                                                const [label, qty] = g.split(':');
                                                return { grade: label, qty: Number(qty) || 0 };
                                            });
                                        } else {
                                            gradeEntries = [{ grade: record.grade || '특/상', qty: record.quantity || 0 }];
                                        }

                                        return (
                                            <div key={record.id || recIdx} className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-black text-gray-800 flex items-center gap-2">
                                                        <span className="text-lg">{cropIcon}</span> {record.crop_name || '딸기'}
                                                    </span>
                                                    <span className="text-xs font-black text-gray-500 bg-white px-2 py-1 rounded-lg border">
                                                        총 {record.quantity?.toLocaleString()}{unit}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {gradeEntries.map((entry, gIdx) => (
                                                        <div key={gIdx} className="bg-white rounded-xl p-3 border border-blue-100 flex items-center gap-2">
                                                            {/* 등급 라벨 */}
                                                            <div className="shrink-0">
                                                                <span className="w-12 text-xs font-black text-blue-700 bg-blue-50 px-2 py-2 rounded-lg text-center border border-blue-100 block shrink-0">{entry.grade}</span>
                                                            </div>

                                                            {/* 입력 필드 (3:7 비율) */}
                                                            <div className="flex-1 flex items-center gap-2">
                                                                {/* 수량 (3) */}
                                                                <div className="flex-[3] relative flex items-center">
                                                                    <input type="number" id={`modal-qty-${recIdx}-${entry.grade}`} defaultValue={entry.qty} placeholder="0"
                                                                        className="w-full bg-gray-50 border-2 border-blue-400 rounded-xl py-3 px-2 text-center text-base font-black text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none" />
                                                                    <span className="absolute right-2 text-[10px] font-bold text-gray-400 pointer-events-none">{unit}</span>
                                                                </div>

                                                                {/* 단가 (7) */}
                                                                <div className="flex-[7] relative flex items-center">
                                                                    <input type="text" id={`modal-price-${recIdx}-${entry.grade}`} placeholder="단가 입력"
                                                                        className="w-full bg-gray-50 border-2 border-blue-400 rounded-xl py-3 px-3 text-right text-base font-black text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none"
                                                                        onChange={(e) => {
                                                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                                                            e.target.value = val ? formatCurrency(val) : '';
                                                                            const totalEl = document.getElementById('modal-total-display');
                                                                            if (totalEl) {
                                                                                let total = 0;
                                                                                selectedGroup.records.forEach((r: any, rIdx: number) => {
                                                                                    let cEs: { grade: string; qty: number }[] = [];
                                                                                    if (r.grade && r.grade.includes(':')) {
                                                                                        cEs = r.grade.split(',').map((gg: string) => {
                                                                                            const [ll, qq] = gg.split(':');
                                                                                            return { grade: ll, qty: Number(qq) || 0 };
                                                                                        });
                                                                                    } else {
                                                                                        cEs = [{ grade: r.grade || '특/상', qty: r.quantity || 0 }];
                                                                                    }
                                                                                    cEs.forEach(en => {
                                                                                        const qq = parseInt((document.getElementById(`modal-qty-${rIdx}-${en.grade}`) as HTMLInputElement)?.value) || 0;
                                                                                        const pp = parseInt((document.getElementById(`modal-price-${rIdx}-${en.grade}`) as HTMLInputElement)?.value.replace(/[^0-9]/g, "")) || 0;
                                                                                        total += (qq * pp);
                                                                                    });
                                                                                });
                                                                                totalEl.innerText = formatCurrency(total);
                                                                            }
                                                                        }} />
                                                                    <span className="absolute right-3 text-[10px] font-bold text-gray-400 pointer-events-none">원</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* 총합 표시 */}
                                    <div className="pt-3 mt-1 border-t-2 border-dashed border-blue-100 flex justify-between items-center px-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-blue-400 uppercase italic">예상 정산 합계</span>
                                            <span className="text-[8px] text-gray-400 font-bold">* 단가 입력 시 자동 계산 (참고용)</span>
                                        </div>
                                        <span id="modal-total-display" className="text-xl font-black text-blue-600">0원</span>
                                    </div>
                                </section>

                                {/* 2. 입금 설정 */}
                                <section className="space-y-4 pt-4 border-t-2 border-gray-100">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-blue-500 uppercase ml-1">입금 날짜</label>
                                            <input
                                                type="date"
                                                value={settleDate}
                                                onChange={(e) => setSettleDate(e.target.value)}
                                                className="w-full bg-white border-2 border-blue-500 rounded-2xl p-3.5 text-xs font-black text-gray-900 outline-none focus:ring-4 focus:ring-blue-100 shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-blue-500 uppercase ml-1">실제 입금액</label>
                                            <input
                                                type="text"
                                                value={actualSettleAmount}
                                                placeholder="입금 확인액"
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9]/g, "");
                                                    setActualSettleAmount(val ? formatCurrency(val) : "");
                                                }}
                                                className="w-full bg-white border-2 border-blue-500 rounded-2xl p-3.5 text-right text-sm font-black text-gray-900 outline-none focus:ring-4 focus:ring-blue-100 shadow-sm placeholder:text-gray-300"
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                                        <p className="text-[10px] text-blue-600 font-bold leading-relaxed break-keep">
                                            단가를 모르신다면 <strong>입금 날짜</strong>와 <strong>실제 입금액</strong>만 적고 [정산 확정]을 하셔도 매출에 정상 반영됩니다.
                                        </p>
                                    </div>
                                </section>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setIsSettleModalOpen(false)}
                                        className="flex-1 py-4 text-sm font-black text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleGradeSettle}
                                        disabled={loading}
                                        className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl text-sm font-black shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {loading ? "처리중..." : "정산 확정하기"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
