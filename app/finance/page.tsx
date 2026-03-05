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
    Home,
    RefreshCcw,
    X,
    Utensils,
    Wallet,
    Factory,
    Calendar as CalendarIcon
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency, getCropIcon } from "@/lib/utils";
import { settlementService } from "@/lib/settlementService";
import CalendarUI from "@/components/Calendar";
import SettlementModal, { ModalCropEntry, SettlementSaveData } from "@/components/SettlementModal";

export default function FinancePage() {
    const { farm, initialized } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Summary Stats
    const [revenue, setRevenue] = useState(0);        // 총 매출
    const [laborCost, setLaborCost] = useState(0);    // 총 인건비
    const [mealCost, setMealCost] = useState(0);      // 식대 및 새참비
    const [expense, setExpense] = useState(0);        // 일반 지출 (영농)
    const [householdCost, setHouseholdCost] = useState(0); // 가계 지출 (생활비/병원비 등)
    const [shippingCost, setShippingCost] = useState(0); // 택배비(자재비 포함)
    const [unsettledB2B, setUnsettledB2B] = useState(0); // 미결산 B2B
    const [unsettledRecords, setUnsettledRecords] = useState<any[]>([]); // 미결산 상세 내역
    const [dbError, setDbError] = useState<string | null>(null); // DB 스키마 오류 상태

    // [안3] 원물/가공품/기타수입 분리
    const [cropRevenue, setCropRevenue] = useState(0);       // 원물 매출
    const [processedRevenue, setProcessedRevenue] = useState(0); // 가공품 매출
    const [otherIncomeTotal, setOtherIncomeTotal] = useState(0); // 기타수입 합계
    const [otherIncomeCount, setOtherIncomeCount] = useState(0); // 기타수입 건수
    const [processedCropNames, setProcessedCropNames] = useState<string[]>([]); // 가공품 이름 목록

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
    const [financeSaving, setFinanceSaving] = useState(false);
    const [expandedPartners, setExpandedPartners] = useState<string[]>([]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // B2C 입금확인 모달용 상태
    const [b2cConfirmModal, setB2cConfirmModal] = useState(false);
    const [b2cConfirmRecord, setB2cConfirmRecord] = useState<any>(null);
    const [b2cConfirmDate, setB2cConfirmDate] = useState(new Date().toISOString().split('T')[0]);
    const [b2cConfirmLoading, setB2cConfirmLoading] = useState(false);

    // 지출 상세 모달용 상태
    const [expenseDetailModal, setExpenseDetailModal] = useState<'labor' | 'meal' | 'shipping' | 'farming' | 'household' | null>(null);
    const [wageDetails, setWageDetails] = useState<any[]>([]);
    const [mealDetails, setMealDetails] = useState<any[]>([]);
    const [shippingDetails, setShippingDetails] = useState<any[]>([]);
    const [farmingDetails, setFarmingDetails] = useState<any[]>([]);
    const [householdDetails, setHouseholdDetails] = useState<any[]>([]);
    const [attendanceDetails, setAttendanceDetails] = useState<any[]>([]);

    useEffect(() => {
        if (initialized && farm?.id) {
            fetchFinanceData();
        }
    }, [farm, initialized, selectedMonth]);

    // [bkit] 실시간 결산 엔진 disabled - 무한 루프 방지
    // subscription이 enabled되면 데이터 변경 시마다 fetchFinanceData()가 호출되어 무한 루프 발생
    // 사용자가 수동으로 새로고침하거나 탭을 전환할 때 자동 로드
    /*
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
    */

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
            const cashStartDate = `${selectedMonth}-01`;
            const cashEndDate = `${selectedMonth}-${lastDay}`;

            // [bkit 전역 결산 엔진 - 3개 쿼리로 분리] (안2: 현금주의)
            // 1. B2C (택배): settled_at 기준 (입금일 기준) + is_settled=true만
            //    → 입금된 달에 매출 반영 (현금주의)
            // 2. B2B (거래처): settled_at 기준 + is_settled=true
            // 3. 미정산 내역: 전체 조회 (B2C + B2B 모두)
            
            // ⚠️ .or()는 복잡할 때 성능 문제 가능 → 별도 쿼리로 분리
            const [recordsB2CResult, recordsB2BResult, recordsUnsettledResult] = await Promise.all([
                // [안2] B2C (택배): recorded_at 기준으로 조회 (settled_at=null인 기존 레코드 포함)
                // JS 레벨에서 settled_at || recorded_at 으로 월 귀속 처리
                supabase
                    .from('sales_records')
                    .select('*, partner:partners(company_name), customer:customers(name)')
                    .eq('farm_id', farm.id)
                    .eq('delivery_method', 'courier')
                    .eq('is_settled', true)
                    .gte('recorded_at', startStr)
                    .lte('recorded_at', endStr)
                    .order('recorded_at', { ascending: false }),
                
                // B2B settled_at 기준 + is_settled=true
                supabase
                    .from('sales_records')
                    .select('*, partner:partners(company_name), customer:customers(name)')
                    .eq('farm_id', farm.id)
                    .eq('sale_type', 'b2b')
                    .eq('is_settled', true)
                    .gte('settled_at', cashStartDate)
                    .lte('settled_at', cashEndDate)
                    .order('settled_at', { ascending: false }),
                
                // 미정산 (전체 날짜 - B2C + B2B 모두)
                supabase
                    .from('sales_records')
                    .select('*, partner:partners(company_name), customer:customers(name)')
                    .eq('farm_id', farm.id)
                    .eq('is_settled', false)
                    .order('recorded_at', { ascending: false })
            ]);

            if (recordsB2CResult.error) throw recordsB2CResult.error;
            if (recordsB2BResult.error) throw recordsB2BResult.error;
            if (recordsUnsettledResult.error) throw recordsUnsettledResult.error;

            // 3개 결과를 병합 + 중복 제거 (쿼리1 B2C + 쿼리3 미정산에서 같은 레코드 중복 가능)
            const seenIds = new Set<string>();
            const salesData: any[] = [];
            [
                ...(recordsB2CResult.data || []),
                ...(recordsB2BResult.data || []),
                ...(recordsUnsettledResult.data || [])
            ].forEach((rec: any) => {
                if (!seenIds.has(rec.id)) {
                    seenIds.add(rec.id);
                    salesData.push(rec);
                }
            });


            // 2. 지출 데이터 (Expenditures) - 카테고리 포함 조회
            const [expensesResult, attendanceResult, farmCropsResult, otherIncomesResult] = await Promise.all([
                supabase
                    .from('expenditures')
                    .select('amount, category, main_category, expense_date, notes, payment_method')
                    .eq('farm_id', farm.id)
                    .gte('expense_date', startStr.split('T')[0])
                    .lte('expense_date', endStr.split('T')[0]),
                // 3. 인건비 데이터 (Attendance)
                supabase
                    .from('attendance_records')
                    .select('daily_wage, headcount, worker_name, work_date')
                    .eq('farm_id', farm.id)
                    .eq('is_present', true)
                    .gte('work_date', startStr.split('T')[0])
                    .lte('work_date', endStr.split('T')[0]),
                // 4. [안3] farm_crops 로드 (원물/가공품 구분용)
                supabase
                    .from('farm_crops')
                    .select('crop_name, category')
                    .eq('farm_id', farm.id)
                    .is('is_active', true),
                // 5. [안3] 기타수입 로드
                supabase
                    .from('other_incomes')
                    .select('amount, income_type, income_date')
                    .eq('farm_id', farm.id)
                    .gte('income_date', cashStartDate)
                    .lte('income_date', cashEndDate)
            ]);

            const expensesData = expensesResult.data;
            const attendanceData = attendanceResult.data;

            // [안3] 가공품 crop_name 목록 추출
            const processedNames = (farmCropsResult.data || [])
                .filter((c: any) => c.category === 'processed')
                .map((c: any) => c.crop_name);
            setProcessedCropNames(processedNames);

            // [안3] 기타수입 합계
            const otherInc = (otherIncomesResult.data || []).reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
            setOtherIncomeTotal(otherInc);
            setOtherIncomeCount((otherIncomesResult.data || []).length);

            let totalRev = 0;
            let b2bRev = 0;
            let b2cRev = 0;
            let totalShipping = 0;
            let unsettledAmt = 0;
            let unsettledCount = 0;
            let settledCount = 0;
            const uRecords: any[] = [];
            const newUnsettledB2c: any[] = [];

            // [안3] 원물 vs 가공품 매출 분리 추적
            let rawCropRev = 0;    // 원물 매출
            let procCropRev = 0;   // 가공품 매출

            salesData?.forEach((rec: any) => {
                const price = settlementService.calculateRecordTotal(rec);
                const isB2C = settlementService.isB2C(rec);
                const isB2B = !isB2C && settlementService.isB2B(rec);

                // [안3] 가공품 여부 판단: crop_name이 processedNames에 포함되면 가공품
                const isProcessedItem = processedNames.includes(rec.crop_name);
                
                if (isB2C) {
                    if (rec.is_settled) {
                        const settledDate = String(rec.settled_at || rec.recorded_at || '').split('T')[0];
                        const settledMonth = settledDate.slice(0, 7);
                        
                        if (settledMonth === selectedMonth) {
                            totalRev += price;
                            b2cRev += price;
                            totalShipping += (rec.shipping_cost || 0) + (rec.packaging_cost || 0);
                            // [안3] 원물/가공품 분리
                            if (isProcessedItem) procCropRev += price;
                            else rawCropRev += price;
                        }
                    } else {
                        newUnsettledB2c.push(rec);
                    }
                } else if (isB2B) {
                    if (rec.is_settled && rec.settled_at) {
                        const dateStr = String(rec.settled_at).split('T')[0];
                        if (dateStr.startsWith(selectedMonth)) {
                            totalRev += price;
                            b2bRev += price;
                            settledCount++;
                            // [안3] 원물/가공품 분리
                            if (isProcessedItem) procCropRev += price;
                            else rawCropRev += price;
                        }
                    } else if (!rec.is_settled) {
                        unsettledAmt += price;
                        unsettledCount++;
                        uRecords.push(rec);
                    }
                }
            });

            // [안3] 원물/가공품 매출 state 업데이트
            setCropRevenue(rawCropRev);
            setProcessedRevenue(procCropRev);

            // [bkit 데이터 출처 정밀화] 
            // 1. 인건비 및 식대 분리 집계
            const WAGE_CATS = ["기본급/월급", "명절떡값/선물", "성과급/보너스", "퇴직금/보험", "기타", "아르바이트(일당)", "기타 인건비"];

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

            // 가계 지출 (생활비/병원비 등) 분리
            const householdExpenses = normalExpenses.filter((e: any) => e.main_category === '가계생활');
            const farmingExpenses = normalExpenses.filter((e: any) => e.main_category !== '가계생활');
            const totalExp = farmingExpenses.reduce((acc: any, curr: any) => acc + (curr.amount || 0), 0) || 0;
            const totalHousehold = householdExpenses.reduce((acc: any, curr: any) => acc + (curr.amount || 0), 0) || 0;

            // [중요] 순이익 계산 로직 수정
            // 순이익 = (B2B 매출 + B2C 매출 + 기타수입) - (인건비 + 식대 + 택배/자재비 + 영농지출 + 가계)
            // totalShipping(택배비)를 경비에 포함시켜야 함
            const totalCost = finalWages + finalMeals + totalShipping + totalExp + totalHousehold;
            const netProfit = totalRev + otherInc - totalCost;

            setRevenue(totalRev);
            setB2bRevenue(b2bRev);
            setB2cRevenue(b2cRev);
            setShippingCost(totalShipping);  // 택배/자재비 별도 표시
            setLaborCost(finalWages);
            setMealCost(finalMeals);
            setExpense(totalExp);
            setHouseholdCost(totalHousehold);

            // 상세 모달용 데이터 저장
            setWageDetails(wagesExpenses);
            setMealDetails(mealsExpenses);
            setAttendanceDetails(attendanceData || []);
            setFarmingDetails(farmingExpenses);
            setHouseholdDetails(householdExpenses);

            // 택배/자재비 상세: 입금 완료된 B2C 중 해당 월에 입금된 건만
            const shippingDetailRecords = salesData.filter((rec: any) => {
                if (!settlementService.isB2C(rec)) return false;
                if (!rec.is_settled) return false; // 미정산은 제외
                const settledDate = String(rec.settled_at || rec.recorded_at || '').split('T')[0];
                const settledMonth = settledDate.slice(0, 7);
                if (settledMonth !== selectedMonth) return false;
                return (rec.shipping_cost || 0) + (rec.packaging_cost || 0) > 0;
            }).map((rec: any) => ({
                customer_name: rec.customer?.name || rec.customer_name || '미지정',
                recorded_at: rec.recorded_at,
                settled_at: rec.settled_at,
                shipping_cost: rec.shipping_cost || 0,
                packaging_cost: rec.packaging_cost || 0,
                total: (rec.shipping_cost || 0) + (rec.packaging_cost || 0)
            }));
            setShippingDetails(shippingDetailRecords);
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
            setHouseholdCost(totalHousehold);
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

            // [bkit 수정] 각 record의 예상 합계를 미리 계산
            const recordPrices: number[] = [];
            let totalExpectedPrice = 0;

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

                let recordTotal = 0;
                gradeEntries.forEach(entry => {
                    const priceEl = document.getElementById(`modal-price-${recIdx}-${entry.grade}`) as HTMLInputElement;
                    const p = priceEl ? (parseInt(priceEl.value.replace(/[^0-9]/g, "")) || 0) : 0;
                    const qtyEl = document.getElementById(`modal-qty-${recIdx}-${entry.grade}`) as HTMLInputElement;
                    const q = qtyEl ? (parseInt(qtyEl.value) || 0) : entry.qty;
                    recordTotal += (q * p);
                });

                recordPrices.push(recordTotal);
                totalExpectedPrice += recordTotal;
            });

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

                // [bkit 수정] 실제 입금액이 있는 경우: 예상금액 비율에 따라 분배
                let finalSettledAmt = 0;
                if (actualAmt > 0) {
                    if (totalExpectedPrice > 0) {
                        // 비율 분배: 입금액 × (이 건의 예상금액 / 전체 예상금액)
                        const ratio = recordPrices[recIdx] / totalExpectedPrice;
                        finalSettledAmt = Math.round(actualAmt * ratio);
                    } else {
                        // 예상금액이 없으면 균등 분배
                        finalSettledAmt = Math.round(actualAmt / selectedGroup.records.length);
                    }
                } else {
                    // 입금액이 없으면 계산된 totalPrice 사용
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

    // SettlementModal용 entries 변환 (compound grade 파싱)
    const financeModalEntries: ModalCropEntry[] = selectedGroup ? (() => {
        const entries: ModalCropEntry[] = [];
        selectedGroup.records.forEach((record: any) => {
            const unit = record.sale_unit || '박스';
            const cropName = record.crop_name || '딸기';
            if (record.grade && record.grade.includes(':')) {
                record.grade.split(',').forEach((g: string) => {
                    const parts = g.split(':');
                    const label = parts[0]?.trim() || '특/상';
                    const qty = Number(parts[1]) || 0;
                    entries.push({ recordId: record.id, cropName, grade: label, quantity: qty, unit, isProcessed: label === '-' });
                });
            } else {
                entries.push({
                    recordId: record.id, cropName,
                    grade: record.grade || '특/상',
                    quantity: record.quantity || 0, unit,
                    isProcessed: record.grade === '-',
                });
            }
        });
        return entries;
    })() : [];

    const handleFinanceSave = async (data: SettlementSaveData) => {
        if (!selectedGroup || !farm?.id) return;
        if (!confirm("입력하신 정보로 정산을 확정하시겠습니까?")) return;
        setFinanceSaving(true);
        const actualAmt = data.actualAmount || 0;
        try {
            // Group entries by recordId
            const recordMap = new Map<string, { entries: typeof data.entries; totalPrice: number }>();
            data.entries.forEach(entry => {
                const rid = entry.recordId;
                if (!rid) return;
                if (!recordMap.has(rid)) recordMap.set(rid, { entries: [], totalPrice: 0 });
                const g = recordMap.get(rid)!;
                g.entries.push(entry);
                g.totalPrice += entry.totalPrice;
            });
            const totalExpected = Array.from(recordMap.values()).reduce((s, g) => s + g.totalPrice, 0);
            const promises: Promise<any>[] = [];
            recordMap.forEach((group, recordId) => {
                let gradeStr: string;
                let totalQty: number;
                if (group.entries.length === 1) {
                    gradeStr = group.entries[0].grade;
                    totalQty = group.entries[0].quantity;
                } else {
                    gradeStr = group.entries.map(e => `${e.grade}:${e.quantity}`).join(',');
                    totalQty = group.entries.reduce((s, e) => s + e.quantity, 0);
                }
                let finalSettledAmt = 0;
                if (actualAmt > 0) {
                    finalSettledAmt = totalExpected > 0
                        ? Math.round(actualAmt * (group.totalPrice / totalExpected))
                        : Math.round(actualAmt / recordMap.size);
                } else {
                    finalSettledAmt = group.totalPrice;
                }
                promises.push(
                    supabase.from('sales_records').update({
                        quantity: totalQty, grade: gradeStr,
                        price: group.totalPrice || null,
                        is_settled: true,
                        settled_amount: finalSettledAmt,
                        settled_at: data.settleDate,
                        payment_method: data.paymentMethod,
                        harvest_note: data.deductionReason || null,
                        delivery_note: data.memo || null,
                    }).eq('id', recordId) as any
                );
            });
            const results = await Promise.all(promises);
            const errorResults = results.filter(r => r.error);
            if (errorResults.length > 0) throw new Error(errorResults.map(r => r.error?.message).join('\n'));
            alert("정산이 성공적으로 완료되었습니다! 🍓");
            setIsSettleModalOpen(false);
            setSelectedGroup(null);
            fetchFinanceData();
        } catch (e: any) {
            console.error("Finance save error:", e);
            alert("정산 오류: " + (e.message || "알 수 없는 오류"));
        } finally {
            setFinanceSaving(false);
        }
    };

    const netProfit = revenue + otherIncomeTotal - laborCost - expense - shippingCost - householdCost - mealCost;
    const totalIncome = revenue + otherIncomeTotal;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

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
                            <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">재무 대시보드</p>
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
                <div className="bg-red-600 rounded-[2.5rem] p-4 text-white shadow-2xl shadow-red-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-700/30 rounded-full -ml-16 -mb-16 blur-2xl"></div>

                    <div className="relative z-10 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                                <p className="text-gray-700 text-[10px] font-black uppercase tracking-[0.2em] mb-1">이번 달 예상 순이익</p>
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

                        <div className="space-y-2 pt-4 border-t border-white/10">
                            <div>
                                <p className="text-gray-700 text-[9px] font-bold uppercase mb-1.5">총 매출액</p>
                                <p className="text-lg font-black text-white break-all">{formatCurrency(revenue)}</p>
                                <p className="text-sm text-gray-200 font-bold mt-1">
                                    납품 <span className="text-white font-black">{formatCurrency(b2bRevenue)}</span> + 택배 <span className="text-white font-black">{formatCurrency(b2cRevenue)}</span>
                                </p>
                                {/* [안3] 원물/가공품 분리 표시 */}
                                {processedRevenue > 0 && (
                                    <p className="text-xs text-gray-300 font-bold mt-1.5 flex items-center gap-1">
                                        <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                        원물 <span className="text-white font-black">{formatCurrency(cropRevenue)}</span>
                                        <span className="mx-1 text-white/30">|</span>
                                        <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                                        가공품 <span className="text-amber-300 font-black">{formatCurrency(processedRevenue)}</span>
                                    </p>
                                )}
                                {/* [안3] 기타수입 표시 */}
                                {otherIncomeTotal > 0 && (
                                    <p className="text-xs text-gray-300 font-bold mt-1 flex items-center gap-1">
                                        <span className="inline-block w-1.5 h-1.5 bg-teal-400 rounded-full"></span>
                                        기타수입 <span className="text-teal-300 font-black">{formatCurrency(otherIncomeTotal)}</span>
                                        <span className="text-[10px] text-gray-400 ml-1">({otherIncomeCount}건)</span>
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                                <div>
                                    <p className="text-gray-700 text-[8px] font-bold uppercase mb-0.5">총 지출액</p>
                                    <p className="text-xs font-black text-gray-200 break-all">{formatCurrency(laborCost + mealCost + expense + shippingCost + householdCost)}</p>
                                </div>
                                {/* [안3] 총 수입 (매출+기타수입) */}
                                {otherIncomeTotal > 0 && (
                                    <div className="text-right">
                                        <p className="text-gray-700 text-[8px] font-bold uppercase mb-0.5">총 수입</p>
                                        <p className="text-xs font-black text-teal-300 break-all">{formatCurrency(revenue + otherIncomeTotal)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {/* 인건비 버튼 */}
                    <button onClick={() => setExpenseDetailModal('labor')} className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-1.5 relative overflow-hidden text-left hover:border-blue-300 hover:shadow-md active:scale-[0.97] transition-all">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-blue-50 rounded-lg shrink-0"><Users className="w-3.5 h-3.5 text-blue-600" /></div>
                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-wide truncate">순수 인건비</span>
                            <ChevronRight className="w-3 h-3 text-gray-400 ml-auto shrink-0" />
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(laborCost)}</p>
                        <p className="text-[9px] text-gray-700 font-bold">일당/월급 등</p>
                    </button>

                    {/* 식대 버튼 */}
                    <button onClick={() => setExpenseDetailModal('meal')} className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-1.5 relative overflow-hidden text-left hover:border-amber-300 hover:shadow-md active:scale-[0.97] transition-all">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-amber-50 rounded-lg shrink-0"><Utensils className="w-3.5 h-3.5 text-amber-600" /></div>
                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-wide truncate">식대/새참비</span>
                            <ChevronRight className="w-3 h-3 text-gray-400 ml-auto shrink-0" />
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(mealCost)}</p>
                        <p className="text-[9px] text-gray-700 font-bold">식당/새참 비용</p>
                    </button>

                    {/* 택배/자재비 버튼 */}
                    <button onClick={() => setExpenseDetailModal('shipping')} className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-1.5 relative overflow-hidden text-left hover:border-pink-300 hover:shadow-md active:scale-[0.97] transition-all">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-pink-50 rounded-lg shrink-0"><Truck className="w-3.5 h-3.5 text-pink-600" /></div>
                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-wide truncate">택배/자재비</span>
                            <ChevronRight className="w-3 h-3 text-gray-400 ml-auto shrink-0" />
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(shippingCost)}</p>
                        <p className="text-[9px] text-gray-700 font-bold">택배/자재비</p>
                    </button>

                    {/* 영농지출 버튼 */}
                    <button onClick={() => setExpenseDetailModal('farming')} className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm space-y-1.5 relative overflow-hidden text-left hover:border-indigo-300 hover:shadow-md active:scale-[0.97] transition-all">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-indigo-50 rounded-lg shrink-0"><Download className="w-3.5 h-3.5 text-indigo-600" /></div>
                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-wide truncate">영농지출/포장재/소모품</span>
                            <ChevronRight className="w-3 h-3 text-gray-400 ml-auto shrink-0" />
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(expense)}</p>
                        <p className="text-[9px] text-gray-700 font-bold">공과금/포장재/소모품</p>
                    </button>

                    {/* 가계 지출 버튼 */}
                    <button onClick={() => setExpenseDetailModal('household')} className="bg-white p-4 rounded-[2rem] border-2 border-sky-100 shadow-sm space-y-1.5 relative overflow-hidden text-left hover:border-sky-300 hover:shadow-md active:scale-[0.97] transition-all">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-sky-50 rounded-lg shrink-0"><Home className="w-3.5 h-3.5 text-sky-600" /></div>
                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-wide truncate">가계 지출</span>
                            <ChevronRight className="w-3 h-3 text-gray-400 ml-auto shrink-0" />
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(householdCost)}</p>
                        <p className="text-[9px] text-gray-700 font-bold">생활비/병원비/경조사 등</p>
                    </button>

                    {/* [안3] 기타수입 카드 (활성) */}
                    <Link href="/other-income" className="bg-white p-4 rounded-[2rem] border-2 border-teal-100 shadow-sm space-y-1.5 relative overflow-hidden text-left hover:border-teal-300 hover:shadow-md active:scale-[0.97] transition-all block">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="p-1.5 bg-teal-50 rounded-lg shrink-0"><Wallet className="w-3.5 h-3.5 text-teal-600" /></div>
                            <span className="text-[9px] font-black text-gray-700 uppercase tracking-wide truncate">기타수입</span>
                            <ChevronRight className="w-3 h-3 text-gray-400 ml-auto shrink-0" />
                        </div>
                        <p className="text-sm font-black text-gray-900 break-all">{formatCurrency(otherIncomeTotal)}</p>
                        <p className="text-[9px] text-gray-700 font-bold">영농지원금/임대수익 ({otherIncomeCount}건)</p>
                    </Link>
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
                                <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">일자별 미결산 건 현황</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${showCalendar ? 'bg-gray-100 text-gray-700' : 'bg-green-600 text-white shadow-lg shadow-green-100'}`}
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
                                <p className="text-xs font-bold text-gray-700 mb-1">입금 대기 중인 금액</p>
                                <h4 className="text-xl font-black text-gray-900 break-all">{formatCurrency(unsettledB2B)}</h4>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs font-bold text-green-600 mb-1">확정/입금된 금액</p>
                                <p className="text-base font-black text-gray-700">{formatCurrency(b2bRevenue - unsettledB2B)}</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm"><ArrowRightLeft className="w-4 h-4 text-gray-700" /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-700">전체 납품 거래</p>
                                    <p className="text-[10px] text-gray-700 font-medium">총 {settledB2bCount + unsettledB2bCount}건의 거래 발생</p>
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
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${financeTab === 'b2b' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-700'}`}
                    >
                        거래처 미결재 ({unsettledRecords.reduce((acc: number, p: any) => acc + p.dailyGroups.length, 0)})
                    </button>
                    <button
                        onClick={() => setFinanceTab('b2c')}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${financeTab === 'b2c' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-700'}`}
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
                        <span className="text-[10px] font-bold text-gray-700">날짜순 정렬</span>
                    </div>

                    <div className="space-y-4">
                        {financeTab === 'b2b' ? (
                            unsettledRecords.length === 0 ? (
                                <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 py-10 text-center">
                                    <p className="text-xs font-bold text-gray-700">모든 납품 정산이 완료되었습니다! 🍓</p>
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
                                                className={`w-full text-left rounded-3xl border-2 p-5 shadow-sm flex items-center justify-between transition-all active:scale-95 ${isExpanded ? 'border-green-400 bg-green-100 text-gray-900' : 'border-red-300 bg-red-50 text-gray-900'}`}
                                            >
                                                <div className="flex-1 min-w-0 space-y-1.5 pr-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-lg font-black text-gray-900 leading-tight truncate">{partnerGroup.companyName}</h4>
                                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${isExpanded ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                                            {partnerGroup.dailyGroups.length}건
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-700 font-black truncate">
                                                        미정산 · 총 {Object.entries(partnerGroup.qtyByUnit || {}).map(([u, q]) => `${(q as number).toLocaleString()}${u}`).join(', ')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <p className={`text-[10px] font-black uppercase tracking-wide mb-0.5 ${isExpanded ? 'text-green-700' : 'text-red-700'}`}>미결산</p>
                                                        <p className="text-xl font-black text-gray-900 whitespace-nowrap">{formatCurrency(partnerGroup.totalAmount)}</p>
                                                    </div>
                                                    <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-green-200 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                        <ChevronRight className={`w-5 h-5 ${isExpanded ? 'rotate-90' : ''}`} />
                                                    </div>
                                                </div>
                                            </button>

                                            {/* [bkit 상세 내역 아코디언] */}
                                            {isExpanded && (
                                                <div className="pl-2 sm:pl-6 border-l-2 sm:border-l-4 border-green-200 space-y-4 animate-in slide-in-from-top-2 duration-300">
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
                                                            <div className="flex gap-3 sm:gap-6 items-center">
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
                                                                            return <span key={r.id} className="text-xs font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">{cropIcon} {r.crop_name}</span>;
                                                                        })}
                                                                        {dateGroup.records.length > 3 && <span className="text-xs font-black text-gray-700">외 {dateGroup.records.length - 3}</span>}
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
                                    <p className="text-xs font-bold text-gray-700">모든 택배 입금이 확인되었습니다! 🍓</p>
                                </div>
                            ) : (
                                unsettledB2cRecords.map((rec, idx) => (
                                    <div key={`${rec.id}-${idx}`} className="bg-white rounded-3xl border border-pink-100 p-5 shadow-sm space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black bg-pink-100 text-pink-700 px-2 py-0.5 rounded">택배 입금전</span>
                                                    <span className="text-[10px] font-bold text-gray-700">{rec.recorded_at.split('T')[0]}</span>
                                                </div>
                                                <h4 className="font-black text-gray-900 flex items-center gap-2">
                                                    {rec.customer?.name || rec.customer_name}
                                                    <span className="text-[10px] font-bold text-pink-400 bg-pink-50 px-1.5 py-0.5 rounded ml-auto">진짜 데이터 🍓</span>
                                                </h4>
                                                <p className="text-[10px] text-gray-700 mt-1 line-clamp-1 bg-gray-50 p-2 rounded-lg">🏠 {rec.address || rec.customer?.address || "주소 미상"}</p>
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
                                                onClick={() => {
                                                    setB2cConfirmRecord(rec);
                                                    setB2cConfirmDate(new Date().toISOString().split('T')[0]);
                                                    setB2cConfirmModal(true);
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

                {/* B2C 입금확인 날짜 선택 모달 */}
                {b2cConfirmModal && b2cConfirmRecord && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-black text-gray-900">택배 입금 확인</h3>
                                <button onClick={() => setB2cConfirmModal(false)} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            <div className="bg-pink-50 rounded-2xl p-4 space-y-2">
                                <p className="text-xs font-black text-pink-700">
                                    {b2cConfirmRecord.customer?.name || b2cConfirmRecord.customer_name}
                                </p>
                                <p className="text-[10px] text-gray-600 font-bold">
                                    판매일: {b2cConfirmRecord.recorded_at?.split('T')[0]} · {b2cConfirmRecord.quantity || 1}{b2cConfirmRecord.sale_unit || '박스'}
                                </p>
                                <p className="text-lg font-black text-pink-600">{formatCurrency(b2cConfirmRecord.price || 0)}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-700 block">입금 확인 날짜</label>
                                <input
                                    type="date"
                                    value={b2cConfirmDate}
                                    onChange={(e) => setB2cConfirmDate(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-black text-gray-800 outline-none focus:border-pink-400 transition-all"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setB2cConfirmModal(false)}
                                    className="flex-1 py-3 rounded-xl text-sm font-black text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                                >
                                    취소
                                </button>
                                <button
                                    disabled={b2cConfirmLoading}
                                    onClick={async () => {
                                        setB2cConfirmLoading(true);
                                        const { error } = await supabase
                                            .from('sales_records')
                                            .update({
                                                is_settled: true,
                                                settled_at: b2cConfirmDate,
                                                payment_status: 'completed'
                                            })
                                            .eq('id', b2cConfirmRecord.id);
                                        setB2cConfirmLoading(false);
                                        if (!error) {
                                            setB2cConfirmModal(false);
                                            setB2cConfirmRecord(null);
                                            fetchFinanceData();
                                        } else {
                                            alert('입금 확인 실패: ' + error.message);
                                        }
                                    }}
                                    className={`flex-1 py-3 rounded-xl text-sm font-black text-white shadow-lg transition-all
                                        ${b2cConfirmLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-700 active:scale-95 shadow-pink-200'}`}
                                >
                                    {b2cConfirmLoading ? '처리중...' : '입금 확인'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 판매 채널별 매출 비중 */}
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-3 space-y-3">
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-gray-700" /> 판매 채널별 매출
                    </h3>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black text-gray-700">납품 (거래처)</span>
                                <span className="text-sm font-black text-gray-900">{formatCurrency(b2bRevenue)}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${(b2bRevenue / (revenue || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black text-gray-700">택배 (개별)</span>
                                <span className="text-sm font-black text-gray-900">{formatCurrency(b2cRevenue)}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-pink-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${(b2cRevenue / (revenue || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* [안3] 원물/가공품 매출 비중 */}
                    {processedRevenue > 0 && (
                        <div className="pt-3 mt-3 border-t border-gray-100 space-y-3">
                            <h4 className="text-xs font-black text-gray-600 flex items-center gap-1.5">
                                <Factory className="w-3.5 h-3.5 text-gray-500" /> 상품 유형별
                            </h4>
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> 원물
                                    </span>
                                    <span className="text-sm font-black text-gray-900">{formatCurrency(cropRevenue)}</span>
                                </div>
                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${(cropRevenue / (revenue || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span> 가공품
                                    </span>
                                    <span className="text-sm font-black text-gray-900">{formatCurrency(processedRevenue)}</span>
                                </div>
                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${(processedRevenue / (revenue || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* [안3] 기타수입 비중 */}
                    {otherIncomeTotal > 0 && (
                        <div className="pt-3 mt-1 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-teal-700 flex items-center gap-1">
                                    <Wallet className="w-3 h-3 text-teal-500" /> 기타수입
                                </span>
                                <Link href="/other-income" className="text-sm font-black text-teal-600 hover:underline">{formatCurrency(otherIncomeTotal)}</Link>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">영농지원금·임대수익 등 ({otherIncomeCount}건)</p>
                        </div>
                    )}
                </section>

                {/* 기타 지출 상세 */}
                <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-3 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                            <ArrowDownCircle className="w-4 h-4 text-red-400" /> 일반 기타 지출
                        </h3>
                        <p className="text-lg font-black text-gray-900">{formatCurrency(expense)}</p>
                    </div>
                    <p className="text-[10px] text-gray-700 font-medium">자재비, 비료, 공과금, 유류비 등 영농 부대 비용</p>
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

                {/* [통합 SettlementModal] */}
                {isSettleModalOpen && selectedGroup && (
                    <SettlementModal
                        mode="finance"
                        companyName={selectedGroup.companyName}
                        deliveryDate={selectedGroup.date}
                        cropEntries={financeModalEntries}
                        initialSettleDate={settleDate}
                        initialPaymentMethod="계좌이체"
                        onSave={handleFinanceSave}
                        onClose={() => { setIsSettleModalOpen(false); setSelectedGroup(null); }}
                        saving={financeSaving}
                    />
                )}
                {/* 지출 상세 모달 */}
                {expenseDetailModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setExpenseDetailModal(null)}>
                        <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            {/* 모달 헤더 */}
                            <div className={`p-4 flex items-center justify-between ${
                                expenseDetailModal === 'labor' ? 'bg-blue-50 border-b border-blue-100' :
                                expenseDetailModal === 'meal' ? 'bg-amber-50 border-b border-amber-100' :
                                expenseDetailModal === 'shipping' ? 'bg-pink-50 border-b border-pink-100' :
                                expenseDetailModal === 'farming' ? 'bg-indigo-50 border-b border-indigo-100' :
                                'bg-sky-50 border-b border-sky-100'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <div className={`p-2 rounded-xl ${
                                        expenseDetailModal === 'labor' ? 'bg-blue-100' :
                                        expenseDetailModal === 'meal' ? 'bg-amber-100' :
                                        expenseDetailModal === 'shipping' ? 'bg-pink-100' :
                                        expenseDetailModal === 'farming' ? 'bg-indigo-100' :
                                        'bg-sky-100'
                                    }`}>
                                        {expenseDetailModal === 'labor' && <Users className="w-4 h-4 text-blue-600" />}
                                        {expenseDetailModal === 'meal' && <Utensils className="w-4 h-4 text-amber-600" />}
                                        {expenseDetailModal === 'shipping' && <Truck className="w-4 h-4 text-pink-600" />}
                                        {expenseDetailModal === 'farming' && <Download className="w-4 h-4 text-indigo-600" />}
                                        {expenseDetailModal === 'household' && <Home className="w-4 h-4 text-sky-600" />}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-gray-900">
                                            {expenseDetailModal === 'labor' && '순수 인건비 상세'}
                                            {expenseDetailModal === 'meal' && '식대/새참비 상세'}
                                            {expenseDetailModal === 'shipping' && '택배/자재비 상세'}
                                            {expenseDetailModal === 'farming' && '영농지출 상세'}
                                            {expenseDetailModal === 'household' && '가계 지출 상세'}
                                        </h3>
                                        <p className="text-[10px] text-gray-500 font-bold">{selectedMonth} 기준</p>
                                    </div>
                                </div>
                                <button onClick={() => setExpenseDetailModal(null)} className="p-2 hover:bg-white/80 rounded-xl transition-colors">
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* 모달 총액 */}
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500">합계</span>
                                    <span className="text-base font-black text-gray-900">
                                        {expenseDetailModal === 'labor' && formatCurrency(laborCost)}
                                        {expenseDetailModal === 'meal' && formatCurrency(mealCost)}
                                        {expenseDetailModal === 'shipping' && formatCurrency(shippingCost)}
                                        {expenseDetailModal === 'farming' && formatCurrency(expense)}
                                        {expenseDetailModal === 'household' && formatCurrency(householdCost)}
                                    </span>
                                </div>
                            </div>

                            {/* 모달 리스트 */}
                            <div className="overflow-y-auto max-h-[55vh] p-4 space-y-2">
                                {/* 인건비 상세 */}
                                {expenseDetailModal === 'labor' && (
                                    <>
                                        {wageDetails.length > 0 ? wageDetails.map((item: any, i: number) => (
                                            <div key={`wage-${i}`} className="flex items-center justify-between py-2.5 px-3 bg-white border border-gray-100 rounded-xl">
                                                <div>
                                                    <p className="text-xs font-black text-gray-900">{item.category || '인건비'}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold">{item.expense_date || ''}{item.notes ? ` · ${item.notes}` : ''}</p>
                                                </div>
                                                <p className="text-xs font-black text-blue-700">{formatCurrency(item.amount)}</p>
                                            </div>
                                        )) : (
                                            <p className="text-center text-xs text-gray-400 font-bold py-8">등록된 인건비가 없습니다</p>
                                        )}
                                    </>
                                )}

                                {/* 식대 상세 */}
                                {expenseDetailModal === 'meal' && (
                                    <>
                                        {mealDetails.length > 0 ? mealDetails.map((item: any, i: number) => (
                                            <div key={`meal-${i}`} className="flex items-center justify-between py-2.5 px-3 bg-white border border-gray-100 rounded-xl">
                                                <div>
                                                    <p className="text-xs font-black text-gray-900">{item.category || '식대'}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold">{item.expense_date || ''}{item.notes ? ` · ${item.notes}` : ''}</p>
                                                </div>
                                                <p className="text-xs font-black text-amber-700">{formatCurrency(item.amount)}</p>
                                            </div>
                                        )) : (
                                            <p className="text-center text-xs text-gray-400 font-bold py-8">등록된 식대가 없습니다</p>
                                        )}
                                    </>
                                )}

                                {/* 택배/자재비 상세 */}
                                {expenseDetailModal === 'shipping' && (
                                    <>
                                        {shippingDetails.length > 0 ? shippingDetails.map((item: any, i: number) => (
                                            <div key={`ship-${i}`} className="flex items-center justify-between py-2.5 px-3 bg-white border border-gray-100 rounded-xl">
                                                <div>
                                                    <p className="text-xs font-black text-gray-900">{item.customer_name}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold">
                                                        {String(item.recorded_at || '').split('T')[0]}
                                                        {item.shipping_cost > 0 && ` · 택배 ${formatCurrency(item.shipping_cost)}`}
                                                        {item.packaging_cost > 0 && ` · 포장 ${formatCurrency(item.packaging_cost)}`}
                                                    </p>
                                                </div>
                                                <p className="text-xs font-black text-pink-700">{formatCurrency(item.total)}</p>
                                            </div>
                                        )) : (
                                            <p className="text-center text-xs text-gray-400 font-bold py-8">이번 달 택배/자재비가 없습니다</p>
                                        )}
                                    </>
                                )}

                                {/* 영농지출 상세 */}
                                {expenseDetailModal === 'farming' && (
                                    <>
                                        {farmingDetails.length > 0 ? farmingDetails.map((item: any, i: number) => (
                                            <div key={`farm-${i}`} className="flex items-center justify-between py-2.5 px-3 bg-white border border-gray-100 rounded-xl">
                                                <div>
                                                    <p className="text-xs font-black text-gray-900">{item.category || item.main_category || '영농지출'}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold">{item.expense_date || ''}{item.notes ? ` · ${item.notes}` : ''}</p>
                                                </div>
                                                <p className="text-xs font-black text-indigo-700">{formatCurrency(item.amount)}</p>
                                            </div>
                                        )) : (
                                            <p className="text-center text-xs text-gray-400 font-bold py-8">등록된 영농지출이 없습니다</p>
                                        )}
                                    </>
                                )}

                                {/* 가계 지출 상세 */}
                                {expenseDetailModal === 'household' && (
                                    <>
                                        {householdDetails.length > 0 ? householdDetails.map((item: any, i: number) => (
                                            <div key={`house-${i}`} className="flex items-center justify-between py-2.5 px-3 bg-white border border-gray-100 rounded-xl">
                                                <div>
                                                    <p className="text-xs font-black text-gray-900">{item.category || '가계생활'}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold">{item.expense_date || ''}{item.notes ? ` · ${item.notes}` : ''}</p>
                                                </div>
                                                <p className="text-xs font-black text-sky-700">{formatCurrency(item.amount)}</p>
                                            </div>
                                        )) : (
                                            <p className="text-center text-xs text-gray-400 font-bold py-8">등록된 가계 지출이 없습니다</p>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* 모달 하단 닫기 */}
                            <div className="p-4 border-t border-gray-100">
                                <button
                                    onClick={() => setExpenseDetailModal(null)}
                                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm font-black text-gray-700 transition-colors active:scale-[0.97]"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
