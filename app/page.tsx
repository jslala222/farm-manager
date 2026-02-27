"use client";

import { useEffect, useState, useMemo } from "react";
import { Sprout, Users, TrendingUp, Package, AlertTriangle, ChevronLeft, ChevronRight, BarChart3, Activity } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";

const DAY_NAMES_KR = ['일', '월', '화', '수', '목', '금', '토'];

type HarvestItem = { crop: string; unit: string; qty: number };
type SalesItem = { unit: string; qty: number };
type RecentActivity = { id: string; type: 'harvest' | 'sales'; label: string; qty: number; unit: string; time: string };

export default function Home() {
  const { farm, initialized } = useAuthStore();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [harvestItems, setHarvestItems] = useState<HarvestItem[]>([]);
  const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [laborCount, setLaborCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [monthSales, setMonthSales] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [unpaidB2BCount, setUnpaidB2BCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  // 주간 날짜 계산 (월~일)
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

  const moveWeek = (direction: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + direction * 7);
    const next = d.toISOString().split('T')[0];
    if (next <= todayStr) setSelectedDate(next);
  };

  const selectedDateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  useEffect(() => {
    if (initialized) {
      if (farm?.id) {
        fetchAllData();
      } else {
        setLoading(false);
      }
    }
  }, [farm, initialized, selectedDate]);

  if (initialized && !farm && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-3 text-center">
        <div className="bg-red-50 p-3 rounded-[2.5rem] mb-6 shadow-inner">
          <Sprout className="w-12 h-12 text-red-600 animate-bounce-slow" />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-3">농장 정보가 없습니다</h2>
        <p className="text-gray-700 mb-8 max-w-xs mx-auto leading-relaxed">
          시스템을 사용하려면 먼저 농장을 등록해야 합니다.<br />
          아래 버튼을 눌러 첫 농장을 설정해 주세요.
        </p>
        <a href="/settings" className="bg-gray-900 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all">
          첫 농장 등록하기
        </a>
      </div>
    );
  }

  const fetchAllData = async () => {
    if (!farm?.id) return;
    setLoading(true);

    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      const monthStart = `${y}-${m}-01`;
      const monthEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

      const [
        harvestRes, cropsRes, attendanceRes, salesRes, laborRes,
        monthlySalesRes, monthlyExpRes, unpaidRes,
        recentHarvestRes, recentSalesRes,
      ] = await Promise.all([
        supabase.from('harvest_records').select('quantity, crop_name')
          .eq('farm_id', farm.id)
          .gte('recorded_at', `${selectedDate}T00:00:00`)
          .lte('recorded_at', `${selectedDate}T23:59:59`),

        supabase.from('farm_crops').select('crop_name, default_unit')
          .eq('farm_id', farm.id).eq('is_active', true),

        supabase.from('attendance_records').select('worker_name')
          .eq('farm_id', farm.id).eq('work_date', selectedDate).eq('is_present', true),

        supabase.from('sales_records').select('quantity, sale_unit')
          .eq('farm_id', farm.id)
          .gte('recorded_at', `${selectedDate}T00:00:00`)
          .lte('recorded_at', `${selectedDate}T23:59:59`),

        supabase.from('labor_costs').select('headcount')
          .eq('farm_id', farm.id).eq('work_date', selectedDate),

        supabase.from('sales_records')
          .select('price, settled_amount, is_settled, shipping_cost, sale_type, delivery_method')
          .eq('farm_id', farm.id)
          .gte('recorded_at', `${monthStart}T00:00:00`)
          .lte('recorded_at', `${monthEnd}T23:59:59`),

        supabase.from('expenditures').select('amount')
          .eq('farm_id', farm.id)
          .gte('expense_date', monthStart)
          .lte('expense_date', monthEnd),

        supabase.from('sales_records').select('id', { count: 'exact', head: true })
          .eq('farm_id', farm.id)
          .eq('is_settled', false)
          .eq('sale_type', 'b2b'),

        supabase.from('harvest_records').select('id, crop_name, quantity, recorded_at')
          .eq('farm_id', farm.id)
          .order('recorded_at', { ascending: false })
          .limit(5),

        supabase.from('sales_records').select('id, crop_name, quantity, sale_unit, recorded_at')
          .eq('farm_id', farm.id)
          .order('recorded_at', { ascending: false })
          .limit(5),
      ]);

      // 작물 단위 맵
      const cropUnitMap: Record<string, string> = {};
      (cropsRes.data ?? []).forEach(c => {
        cropUnitMap[c.crop_name] = c.default_unit || '박스';
      });

      // 수확 합산
      const harvestMap: Record<string, number> = {};
      (harvestRes.data ?? []).forEach(r => {
        const crop = r.crop_name || '수확물';
        harvestMap[crop] = (harvestMap[crop] || 0) + (r.quantity || 0);
      });
      setHarvestItems(Object.entries(harvestMap).map(([crop, qty]) => ({
        crop, unit: cropUnitMap[crop] || '박스', qty,
      })));

      // 출하 합산
      const salesMap: Record<string, number> = {};
      (salesRes.data ?? []).forEach(r => {
        const unit = r.sale_unit || '박스';
        salesMap[unit] = (salesMap[unit] || 0) + Number(r.quantity || 0);
      });
      setSalesItems(Object.entries(salesMap).map(([unit, qty]) => ({ unit, qty })));

      setStaffCount((attendanceRes.data ?? []).length);
      setLaborCount((laborRes.data ?? []).reduce((s, r) => s + (r.headcount || 0), 0));

      // 이번달 매출
      const totalSales = (monthlySalesRes.data ?? []).reduce((sum, r) => {
        if (r.is_settled && r.settled_amount != null) return sum + r.settled_amount;
        let amt = r.price || 0;
        if (r.sale_type === 'b2c' || r.delivery_method === 'courier') amt += (r.shipping_cost || 0);
        return sum + amt;
      }, 0);
      setMonthSales(totalSales);

      // 이번달 지출
      setMonthExpenses((monthlyExpRes.data ?? []).reduce((sum, r) => sum + (r.amount || 0), 0));

      // 미결재 B2B
      setUnpaidB2BCount(unpaidRes.count ?? 0);

      // 최근 활동
      const activities: RecentActivity[] = [];
      (recentHarvestRes.data ?? []).forEach(r => {
        activities.push({
          id: `h-${r.id}`, type: 'harvest',
          label: r.crop_name || '수확물',
          qty: r.quantity || 0,
          unit: cropUnitMap[r.crop_name] || '박스',
          time: r.recorded_at,
        });
      });
      (recentSalesRes.data ?? []).forEach(r => {
        activities.push({
          id: `s-${r.id}`, type: 'sales',
          label: r.crop_name || '출하',
          qty: Number(r.quantity || 0),
          unit: r.sale_unit || '박스',
          time: r.recorded_at,
        });
      });
      activities.sort((a, b) => b.time.localeCompare(a.time));
      setRecentActivity(activities.slice(0, 5));

    } catch (err) {
      console.error("[Dashboard] error:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalWorkers = staffCount + laborCount;
  const isToday = selectedDate === todayStr;
  const formatCurrency = (n: number) => n.toLocaleString('ko-KR') + '원';

  return (
    <div className="p-4 md:p-3 pb-20 md:pb-6">

      {/* 헤더 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{farm?.farm_name ?? "관리 시스템"}</h1>
        <p className="text-gray-700 text-sm mt-1">{selectedDateLabel}</p>
      </div>

      {/* ── 주간 날짜 칩 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-xs font-black text-gray-700">날짜 선택</span>
          <div className="flex gap-1">
            <button
              onClick={() => moveWeek(-1)}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-green-100 text-gray-700 hover:text-green-600 transition-all active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              disabled={isToday}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-gray-100 hover:bg-green-100 text-gray-700 hover:text-green-600 transition-all disabled:opacity-40"
            >
              오늘
            </button>
            <button
              onClick={() => moveWeek(1)}
              disabled={weekDates[6] >= todayStr}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-green-100 text-gray-700 hover:text-green-600 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto px-3 pb-3 pt-1 gap-2 scrollbar-hide">
          {weekDates.map(date => {
            const d = new Date(date + 'T00:00:00');
            const dayName = DAY_NAMES_KR[d.getDay()];
            const dayNum = parseInt(date.slice(8));
            const isSelected = date === selectedDate;
            const isTodayDate = date === todayStr;
            const isFuture = date > todayStr;
            return (
              <button
                key={date}
                onClick={() => !isFuture && setSelectedDate(date)}
                disabled={isFuture}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl shrink-0 transition-all min-w-[46px] active:scale-95 ${
                  isSelected
                    ? 'bg-green-500 shadow-md shadow-green-100'
                    : isFuture
                    ? 'bg-gray-50 opacity-25 cursor-not-allowed'
                    : 'bg-gray-50 hover:bg-green-50'
                }`}
              >
                <span className={`text-[9px] font-black ${isSelected ? 'text-green-100' : 'text-gray-700'}`}>
                  {dayName}
                </span>
                <span className={`text-sm font-black leading-none ${
                  isSelected ? 'text-white' : isTodayDate ? 'text-green-500' : 'text-gray-800'
                }`}>
                  {dayNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 선택 날짜 현황 카드 3개 ── */}
      <div className="grid grid-cols-3 gap-3 mb-4">

        {/* 수확 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="bg-red-100 p-1.5 rounded-xl"><Sprout className="w-4 h-4 text-red-600" /></div>
            <span className="text-[11px] font-black text-gray-700">{isToday ? '오늘 ' : ''}수확</span>
          </div>
          {loading ? (
            <p className="text-xl font-bold text-gray-900">—</p>
          ) : harvestItems.length === 0 ? (
            <p className="text-xl font-bold text-gray-900">0 <span className="text-xs font-normal text-gray-700">박스</span></p>
          ) : (
            <div className="space-y-0.5">
              {harvestItems.map(item => (
                <p key={item.crop} className="font-bold text-gray-900">
                  <span className="text-xl">{item.qty.toLocaleString()}</span>
                  <span className="text-xs font-normal text-gray-700 ml-1">{item.unit}</span>
                  {harvestItems.length > 1 && (
                    <span className="text-[10px] text-gray-600 ml-1">({item.crop})</span>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* 출하 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="bg-blue-100 p-1.5 rounded-xl"><Package className="w-4 h-4 text-blue-600" /></div>
            <span className="text-[11px] font-black text-gray-700">{isToday ? '오늘 ' : ''}출하</span>
          </div>
          {loading ? (
            <p className="text-xl font-bold text-gray-900">—</p>
          ) : salesItems.length === 0 ? (
            <p className="text-xl font-bold text-gray-900">0 <span className="text-xs font-normal text-gray-700">박스</span></p>
          ) : (
            <div className="space-y-0.5">
              {salesItems.map(item => (
                <p key={item.unit} className="font-bold text-gray-900">
                  <span className="text-xl">{item.qty.toLocaleString()}</span>
                  <span className="text-xs font-normal text-gray-700 ml-1">{item.unit}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* 출근 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="bg-orange-100 p-1.5 rounded-xl"><Users className="w-4 h-4 text-orange-600" /></div>
            <span className="text-[11px] font-black text-gray-700">{isToday ? '오늘 ' : ''}출근</span>
          </div>
          {loading ? (
            <p className="text-xl font-bold text-gray-900">—</p>
          ) : (
            <div>
              <p className="text-xl font-bold text-gray-900">
                {totalWorkers.toLocaleString()}
                <span className="text-xs font-normal text-gray-700 ml-1">명</span>
              </p>
              {totalWorkers > 0 && (
                <div className="flex gap-1.5 mt-0.5 flex-wrap">
                  {staffCount > 0 && <span className="text-[10px] font-bold text-blue-600">직원 {staffCount}</span>}
                  {laborCount > 0 && <span className="text-[10px] font-bold text-orange-600">알바 {laborCount}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ⚠️ 처리 필요 ── */}
      {!loading && unpaidB2BCount > 0 && (
        <a href="/finance" className="block mb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-all">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-black text-amber-800">처리 필요</p>
              <p className="text-xs font-bold text-amber-700 mt-0.5">미결재 B2B {unpaidB2BCount}건이 있습니다</p>
            </div>
            <span className="text-xs font-black text-amber-600">확인 →</span>
          </div>
        </a>
      )}

      {/* ── 이번달 요약 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-700" />
          <span className="text-sm font-black text-gray-800">이번달 요약</span>
        </div>
        {loading ? (
          <p className="text-gray-700 text-sm">로딩 중...</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-600 mb-0.5">매출</p>
              <p className="text-sm font-black text-gray-900 leading-tight">{formatCurrency(monthSales)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-600 mb-0.5">지출</p>
              <p className="text-sm font-black text-gray-900 leading-tight">{formatCurrency(monthExpenses)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-600 mb-0.5">순이익</p>
              <p className={`text-sm font-black leading-tight ${monthSales - monthExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(monthSales - monthExpenses)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 최근 활동 ── */}
      {!loading && recentActivity.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-gray-700" />
            <span className="text-sm font-black text-gray-800">최근 활동</span>
          </div>
          <div className="space-y-2.5">
            {recentActivity.map(act => {
              const t = new Date(act.time);
              const timeStr = `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
              return (
                <div key={act.id} className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${act.type === 'harvest' ? 'bg-red-400' : 'bg-blue-400'}`} />
                  <span className="text-sm font-bold text-gray-900 flex-1 truncate">
                    {act.type === 'harvest' ? '🌱 수확' : '📦 출하'} {act.label} {act.qty.toLocaleString()}{act.unit}
                  </span>
                  <span className="text-[10px] font-bold text-gray-600 shrink-0">{timeStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 빠른 기록 ── */}
      <div>
        <h2 className="text-sm font-black text-gray-800 mb-3 ml-1">빠른 기록</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: "/harvest", label: "수확 기록", icon: Sprout, color: "red" },
            { href: "/bulk", label: "납품 기록", icon: TrendingUp, color: "green" },
            { href: "/attendance", label: "출근 체크", icon: Users, color: "blue" },
          ].map(({ href, label, icon: Icon, color }) => (
            <a key={href} href={href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-2 hover:translate-y-[-3px] active:translate-y-0 transition-all active:scale-95 group">
              <div className={`p-3 bg-${color}-50 rounded-2xl group-hover:bg-${color}-100 transition-colors`}>
                <Icon className={`w-6 h-6 text-${color}-500`} />
              </div>
              <span className="text-xs font-black text-gray-700 text-center">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
