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
    X
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { settlementService } from "@/lib/settlementService";

export default function FinancePage() {
    const { farm, initialized } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Summary Stats
    const [revenue, setRevenue] = useState(0);        // 총 매출
    const [laborCost, setLaborCost] = useState(0);    // 총 인건비
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
                .select('amount, category')
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

            salesData?.forEach(rec => {
                const recDate = rec.recorded_at.split('T')[0];
                const isInSelectedMonth = recDate.startsWith(selectedMonth);

                const price = settlementService.calculateRecordTotal(rec);

                // 1. 미정산 내역은 날짜 상관없이 무조건 추출 (중요!)
                if (settlementService.isB2B(rec) && !rec.is_settled) {
                    unsettledAmt += price;
                    unsettledCount++;
                    uRecords.push(rec);
                } else if (settlementService.isB2C(rec) && !rec.is_settled) {
                    setUnsettledB2cRecords(prev => [...prev, rec]);
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

            // [bkit 데이터 출처 검증] 
            // 1. 일반 지출 합계 (식대 제외)
            const normalExpenses = expensesData?.filter(e => !e.category?.includes('식대')) || [];
            const totalExp = normalExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

            // 2. 인건비 합계 (일당 * 인원수 + 식대 지출)
            const mealExpenses = expensesData?.filter(e => e.category?.includes('식대')) || [];
            const totalMealCost = mealExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

            const totalLabor = (attendanceData?.reduce((acc, curr) => {
                return acc + ((curr.daily_wage || 0) * (curr.headcount || 1));
            }, 0) || 0) + totalMealCost;

            setRevenue(totalRev);
            setB2bRevenue(b2bRev);
            setB2cRevenue(b2cRev);
            setShippingCost(totalShipping);
            setUnsettledB2B(unsettledAmt);
            setUnsettledB2bCount(unsettledCount);
            setSettledB2bCount(settledCount);
            // [bkit 그룹화 로직] 파트너 + 날짜별로 묶기
            const grouped: any[] = [];
            const tempMap = new Map();

            uRecords.forEach(rec => {
                const date = rec.recorded_at.split('T')[0];
                // [bkit 정교 이름 매핑] SalesPage와 동일한 우선순위 적용
                const displayName = rec.partner?.company_name || rec.customer?.name || rec.customer_name || "미지정";

                // [bkit 정밀 그룹화] partner_id가 없는 경우 표시 이름(displayName)을 키에 포함하여 데이터 섞임 방지
                const partnerKey = rec.partner_id || `no-id-${displayName}`;
                const key = `${partnerKey}-${date}`;

                if (!tempMap.has(key)) {
                    tempMap.set(key, {
                        partnerId: rec.partner_id,
                        companyName: displayName,
                        date: date,
                        records: []
                    });
                    grouped.push(tempMap.get(key));
                }
                tempMap.get(key).records.push(rec);
            });

            setUnsettledRecords(grouped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setExpense(totalExp);
            setLaborCost(totalLabor);
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
        if (!confirm("입력하신 등급별 수량과 단가로 정산을 확정하시겠습니까?")) return;

        setLoading(true);
        const GRADE_TYPES = ['특/상', '중', '하'];
        const actualAmt = parseInt(actualSettleAmount.replace(/[^0-9]/g, "")) || 0;

        try {
            // 1. 입력된 4개 등급의 데이터를 수집
            const newEntries = GRADE_TYPES.map(g => {
                const qtyInput = document.getElementById(`modal-qty-${g}`) as HTMLInputElement;
                const priceInput = document.getElementById(`modal-price-${g}`) as HTMLInputElement;
                return {
                    grade: g,
                    quantity: parseInt(qtyInput.value) || 0,
                    price: parseInt(priceInput.value.replace(/[^0-9]/g, "")) || 0
                };
            }).filter(e => e.quantity > 0);

            if (newEntries.length === 0) {
                alert("최소 한 개 이상의 등급 수량을 입력해주세요.");
                setLoading(false);
                return;
            }

            // 2. 기존 레코드를 기반으로 업데이트 및 신규 생성
            const existingIds = selectedGroup.records.map((r: any) => r.id);
            const totalQty = newEntries.reduce((acc, e) => acc + e.quantity, 0);

            const promises: Promise<any>[] = newEntries.map((entry, idx) => {
                // [bkit 데이터 결벽증] 사장님이 입력하신 단가와 수량을 '절대값'으로 보존
                const quotedTotalPrice = entry.quantity * entry.price;

                const recordData = {
                    grade: entry.grade,
                    quantity: entry.quantity,
                    price: quotedTotalPrice, // 입력하신 수량 * 단가 (장부 총액)
                    is_settled: true,
                    // 실제 입금액(actualAmt)은 중복 방지를 위해 첫 번째 레코드에만 대표로 기록
                    settled_amount: idx === 0 ? actualAmt : 0,
                    settled_at: settleDate,
                    farm_id: farm.id,
                    partner_id: selectedGroup.partnerId,
                    recorded_at: selectedGroup.records[0].recorded_at,
                    delivery_method: 'nonghyup',
                    sale_type: 'nonghyup'
                };

                if (idx < existingIds.length) {
                    return supabase.from('sales_records').update(recordData).eq('id', existingIds[idx]) as any;
                } else {
                    return supabase.from('sales_records').insert(recordData) as any;
                }
            });

            // 남는 기존 레코드는 삭제
            if (existingIds.length > newEntries.length) {
                const deleteIds = existingIds.slice(newEntries.length);
                promises.push(supabase.from('sales_records').delete().in('id', deleteIds) as any);
            }

            const results = await Promise.all(promises);
            const errorResults = results.filter(r => r.error);
            if (errorResults.length > 0) {
                const messages = errorResults.map(r => {
                    const err = r.error;
                    return `[${err.code}] ${err.message}${err.details ? ': ' + err.details : ''}`;
                }).join("\n");
                console.error("Supabase Save Error Details:", errorResults);
                throw new Error(`DB 저장 중 거부되었습니다:\n${messages}\n\n* 'scripts/final_fix_for_boss.sql'을 실행하셨는지 확인 부탁드립니다.`);
            }

            alert("정산이 성공적으로 완료되었습니다! 🍓");
            setIsSettleModalOpen(false);
            fetchFinanceData();
        } catch (error: any) {
            console.error("Settlement Error:", error);
            alert("정산 처리 실패: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const totalExpectedAmt = selectedGroup ? ['특/상', '중', '하'].reduce((acc, g) => {
        const qty = parseInt((document.getElementById(`modal-qty-${g}`) as HTMLInputElement)?.value) || 0;
        const price = parseInt((document.getElementById(`modal-price-${g}`) as HTMLInputElement)?.value.replace(/[^0-9]/g, "")) || 0;
        return acc + (qty * price);
    }, 0) : 0;

    const handleQuickSettle = async (id: string, finalPrice: number) => {
        // ... (Legacy or fallback)
    };

    const netProfit = revenue - laborCost - expense - shippingCost;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-12">
            <div className="max-w-2xl mx-auto p-4 space-y-6 animate-in fade-in duration-500">

                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gray-900 rounded-2xl shadow-xl shadow-gray-200">
                            <Calculator className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">통합 결산</h1>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Financial Trinity Dashboard</p>
                        </div>
                    </div>

                    <div className="relative">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-white border-2 border-gray-100 rounded-xl px-4 py-2 text-sm font-black text-gray-700 outline-none focus:border-gray-900 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* DB 오류 알림 및 복구 버튼 (Zero-Touch) */}
                {dbError && (
                    <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-500">
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
                <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-gray-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>

                    <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Estimated Net Profit</p>
                                <h2 className="text-5xl font-black tracking-tighter text-white">
                                    {formatCurrency(netProfit)}
                                </h2>
                            </div>
                            <div className={`px-4 py-2 rounded-2xl font-bold text-sm flex items-center gap-1.5 shadow-lg
                                ${netProfit >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                {profitMargin.toFixed(1)}%
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                            <div>
                                <p className="text-gray-500 text-[9px] font-bold uppercase mb-1">Total Revenue</p>
                                <p className="text-xl font-black text-white">{formatCurrency(revenue)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-500 text-[9px] font-bold uppercase mb-1">Total Costs</p>
                                <p className="text-xl font-black text-gray-300">{formatCurrency(laborCost + expense + shippingCost)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-2 relative group-hover:bg-blue-50/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-blue-50 rounded-lg"><Users className="w-4 h-4 text-blue-600" /></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Labor</span>
                        </div>
                        <p className="text-2xl font-black text-gray-900">{formatCurrency(laborCost)}</p>
                        <p className="text-[10px] text-gray-400 font-bold break-keep">출근부 + 식대 지출 합산</p>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <AlertTriangle className="w-3 h-3 text-blue-300" />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-2 relative">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-pink-50 rounded-lg"><Truck className="w-4 h-4 text-pink-600" /></div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Post & Pack</span>
                        </div>
                        <p className="text-2xl font-black text-gray-900">{formatCurrency(shippingCost)}</p>
                        <p className="text-[10px] text-gray-400 font-bold break-keep">판매장부의 택배/자재비</p>
                    </div>
                </div>

                {/* B2B 미결산 관리 섹션 */}
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 bg-amber-50/50 border-b border-gray-50 flex items-center justify-between">
                        <h3 className="text-sm font-black text-amber-900 flex items-center gap-2">
                            <Building2 className="w-4 h-4" /> B2B 미결산 리포트
                        </h3>
                        <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">{unsettledB2bCount}건 대기</span>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 mb-1">입금 대기 중인 금액</p>
                                <h4 className="text-3xl font-black text-gray-900">{formatCurrency(unsettledB2B)}</h4>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-green-600 mb-1">확정/입금된 금액</p>
                                <p className="text-lg font-black text-gray-400">{formatCurrency(b2bRevenue - unsettledB2B)}</p>
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

                {/* 정산 관리 탭 전환 */}
                <div className="flex p-1 bg-gray-100 rounded-2xl">
                    <button
                        onClick={() => setFinanceTab('b2b')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${financeTab === 'b2b' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                    >
                        B2B 납품 정산 ({unsettledB2bCount})
                    </button>
                    <button
                        onClick={() => setFinanceTab('b2c')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${financeTab === 'b2c' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                    >
                        택배 입금 관리 ({unsettledB2cRecords.length})
                    </button>
                </div>

                {/* 미결산 리스트 섹션 */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                            <ArrowRightLeft className="w-4 h-4 text-amber-500" />
                            {financeTab === 'b2b' ? 'B2B 정산 대기 상세' : '택배 입금 대기 내역'}
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400">날짜순 정렬</span>
                    </div>

                    <div className="space-y-3">
                        {financeTab === 'b2b' ? (
                            unsettledRecords.length === 0 ? (
                                <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 py-10 text-center">
                                    <p className="text-xs font-bold text-gray-400">모든 B2B 정산이 완료되었습니다! 🍓</p>
                                </div>
                            ) : (
                                unsettledRecords.map((group, groupIdx) => (
                                    <button
                                        key={`${group.partnerId}-${group.date}-${groupIdx}`}
                                        onClick={() => {
                                            setSelectedGroup(group);
                                            setActualSettleAmount("");
                                            setIsSettleModalOpen(true);
                                        }}
                                        className="w-full text-left bg-white rounded-3xl border border-amber-100 p-5 shadow-sm space-y-4 hover:border-amber-400 transition-all group scale-100 active:scale-[0.98]"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded">B2B 미정산 그룹</span>
                                                    <span className="text-[10px] font-bold text-gray-400">{group.date}</span>
                                                </div>
                                                <h4 className="font-black text-gray-900 group-hover:text-amber-600 transition-colors flex items-center justify-between">
                                                    <span>{group.companyName}</span>
                                                    <span className="text-xs font-black text-gray-600 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                                        총 {group.records.reduce((acc: number, r: any) => acc + (r.quantity || 0), 0)}박스
                                                    </span>
                                                </h4>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {group.records.map((r: any, rIdx: number) => (
                                                        <span key={`${r.id}-${rIdx}`} className="text-[10px] bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-100">
                                                            {r.grade || "특/상"} {r.quantity}박스
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-400 mb-1 flex items-center justify-end gap-1">
                                                    클릭하여 정산 확정 <ChevronRight className="w-3 h-3" />
                                                </p>
                                                <div className="text-lg font-black text-gray-900">
                                                    {group.records.reduce((acc: number, r: any) => acc + (r.price || 0), 0) > 0
                                                        ? formatCurrency(group.records.reduce((acc: number, r: any) => acc + (r.price || 0), 0))
                                                        : <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded-lg text-xs animate-pulse">단가 미정</span>
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))
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
                                                <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 bg-gray-50 p-2 rounded-lg">🏠 {rec.customer?.address || "주소 미상"}</p>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-[10px] font-black text-gray-400">{rec.quantity}박스</span>
                                                    <span className="text-sm font-black text-pink-600">{formatCurrency(rec.price || 0)}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm("입금 확인 처리를 하시겠습니까?")) return;
                                                    const { error } = await supabase.from('sales_records').update({ is_settled: true }).eq('id', rec.id);
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
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 space-y-6">
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
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 space-y-4">
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
                            <div className="p-8 bg-gray-900 text-white flex justify-between items-center share-container">
                                <div>
                                    <h3 className="text-xl font-black tracking-tight">{selectedGroup.companyName} 정산</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">B2B Settlement Detail ({selectedGroup.date})</p>
                                </div>
                                <button onClick={() => setIsSettleModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6 overflow-y-auto max-h-[85vh]">
                                {/* 1. 등급별 물량 및 가격 (초슬림 로우 디자인) */}
                                <section className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b-2 border-blue-100">
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <Package className="w-4 h-4" />
                                            <span className="text-xs font-black uppercase tracking-widest">등급별 물량 & 단가</span>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-1 rounded">총 {selectedGroup.records.reduce((acc: number, r: any) => acc + (r.quantity || 0), 0)}박스</span>
                                    </div>

                                    <div className="space-y-2">
                                        {['특/상', '중', '하'].map((gradeName) => {
                                            const existing = selectedGroup.records.find((r: any) => (r.grade || '특/상') === gradeName);
                                            // 등급 구분이 없는 경우 '특/상'으로 우선 배분
                                            const defaultQty = existing ? existing.quantity : (selectedGroup.records.length === 1 && gradeName === '특/상' ? selectedGroup.records[0].quantity : 0);
                                            const defaultPrice = existing ? existing.price : 0;

                                            return (
                                                <div key={gradeName} className="flex items-center gap-2 group/row">
                                                    {/* 등급 라벨 */}
                                                    <div className="w-16 shrink-0">
                                                        <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-2 rounded-xl block text-center border border-blue-100">{gradeName}</span>
                                                    </div>

                                                    {/* 박스 수량 */}
                                                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                                                        <input
                                                            type="number"
                                                            id={`modal-qty-${gradeName}`}
                                                            defaultValue={defaultQty}
                                                            placeholder="0"
                                                            className="w-full bg-white border-2 border-blue-500 rounded-xl py-2 px-2 text-center text-sm font-black text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                                            onChange={() => {
                                                                const totalEl = document.getElementById('modal-total-display');
                                                                if (totalEl) {
                                                                    const total = ['특/상', '중', '하'].reduce((acc, g) => {
                                                                        const q = parseInt((document.getElementById(`modal-qty-${g}`) as HTMLInputElement)?.value) || 0;
                                                                        const p = parseInt((document.getElementById(`modal-price-${g}`) as HTMLInputElement)?.value.replace(/[^0-9]/g, "")) || 0;
                                                                        return acc + (q * p);
                                                                    }, 0);
                                                                    totalEl.innerText = formatCurrency(total);
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-[10px] font-bold text-gray-400 shrink-0">박스</span>
                                                    </div>

                                                    {/* 단가 입력 */}
                                                    <div className="flex-[1.8] flex items-center gap-1.5 min-w-0">
                                                        <input
                                                            type="text"
                                                            id={`modal-price-${gradeName}`}
                                                            placeholder="단가(원)"
                                                            defaultValue={defaultPrice ? formatCurrency(defaultPrice) : ""}
                                                            className="w-full bg-white border-2 border-blue-500 rounded-xl py-2 px-3 text-right text-sm font-black text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9]/g, "");
                                                                const input = e.target as HTMLInputElement;
                                                                input.value = val ? formatCurrency(val) : "";

                                                                const totalEl = document.getElementById('modal-total-display');
                                                                if (totalEl) {
                                                                    const total = ['특/상', '중', '하'].reduce((acc, g) => {
                                                                        const q = parseInt((document.getElementById(`modal-qty-${g}`) as HTMLInputElement)?.value) || 0;
                                                                        const p = parseInt((document.getElementById(`modal-price-${g}`) as HTMLInputElement)?.value.replace(/[^0-9]/g, "")) || 0;
                                                                        return acc + (q * p);
                                                                    }, 0);
                                                                    totalEl.innerText = formatCurrency(total);
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-[10px] font-bold text-gray-400 shrink-0">원</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* 총합 표시 */}
                                    <div className="pt-3 mt-1 border-t-2 border-dashed border-blue-100 flex justify-between items-center px-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-blue-400 uppercase italic">EXPECTED TOTAL</span>
                                            <span className="text-[8px] text-gray-400 font-bold">* 수량 × 단가 합계 (참고용)</span>
                                        </div>
                                        <span id="modal-total-display" className="text-xl font-black text-blue-600">
                                            {formatCurrency(['특/상', '중', '하'].reduce((acc, g) => {
                                                const existing = selectedGroup.records.find((r: any) => (r.grade || '특/상') === g);
                                                const q = existing ? existing.quantity : (selectedGroup.records.length === 1 && g === '특/상' ? selectedGroup.records[0].quantity : 0);
                                                const p = existing ? existing.price : 0;
                                                return acc + (q * p);
                                            }, 0))}
                                        </span>
                                    </div>
                                </section>

                                {/* 2. 입금 설정 (파란색 강조 테두리) */}
                                <section className="space-y-4 pt-4 border-t-2 border-gray-100">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-blue-500 uppercase ml-1">입금 날짜</label>
                                            <input
                                                type="date"
                                                value={settleDate}
                                                onChange={(e) => setSettleDate(e.target.value)}
                                                className="w-full bg-white border-2 border-blue-500 rounded-2xl p-4 text-xs font-black text-gray-900 outline-none focus:ring-4 focus:ring-blue-100 shadow-sm"
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
                                                className="w-full bg-white border-2 border-blue-500 rounded-2xl p-4 text-right text-sm font-black text-gray-900 outline-none focus:ring-4 focus:ring-blue-100 shadow-sm placeholder:text-gray-300"
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-blue-50/50 p-4 rounded-3xl border border-blue-100">
                                        <p className="text-[10px] text-blue-600 font-bold leading-relaxed break-keep">
                                            💡 단가를 모르신다면 **입금 날짜**와 **실제 입금액**만 정확히 적고 [정산 확정]을 하셔도 매출에 정상 반영됩니다.
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
