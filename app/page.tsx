"use client";

import { useEffect, useState } from "react";
import { Sprout, Users, TrendingUp, Package } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";

type HarvestItem = { crop: string; unit: string; qty: number };
type SalesItem = { unit: string; qty: number };

export default function Home() {
  const { farm, initialized } = useAuthStore();
  const [harvestItems, setHarvestItems] = useState<HarvestItem[]>([]);
  const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
  const [staffCount, setStaffCount] = useState(0);   // 직원/식구
  const [laborCount, setLaborCount] = useState(0);   // 알바/용역 headcount 합
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  useEffect(() => {
    if (initialized) {
      if (farm?.id) {
        fetchTodayData();
      } else {
        console.warn("[Dashboard] No farm ID found, skipping today data fetch.");
        setLoading(false);
      }
    }
  }, [farm, initialized]);

  // 농장이 없는 경우 (신규 유저)
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

  const fetchTodayData = async () => {
    if (!farm?.id) return;
    setLoading(true);

    try {
      const [harvestRes, cropsRes, attendanceRes, salesRes, laborRes] = await Promise.all([
        // 수확: crop_name 별 수량
        supabase.from('harvest_records').select('quantity, crop_name')
          .eq('farm_id', farm.id)
          .gte('recorded_at', `${today}T00:00:00`)
          .lte('recorded_at', `${today}T23:59:59`),
        // 작물별 기본 단위 조회
        supabase.from('farm_crops').select('crop_name, default_unit')
          .eq('farm_id', farm.id).eq('is_active', true),
        // 출근: 직원/식구
        supabase.from('attendance_records').select('worker_name')
          .eq('farm_id', farm.id).eq('work_date', today).eq('is_present', true),
        // 출하: sale_unit 별 수량
        supabase.from('sales_records').select('quantity, sale_unit')
          .eq('farm_id', farm.id)
          .gte('recorded_at', `${today}T00:00:00`)
          .lte('recorded_at', `${today}T23:59:59`),
        // 알바/용역 headcount 합산
        supabase.from('labor_costs').select('headcount')
          .eq('farm_id', farm.id).eq('work_date', today),
      ]);

      // 작물 단위 맵
      const cropUnitMap: Record<string, string> = {};
      (cropsRes.data ?? []).forEach(c => {
        cropUnitMap[c.crop_name] = c.default_unit || '박스';
      });

      // 수확 → crop_name 별 합산
      const harvestMap: Record<string, number> = {};
      (harvestRes.data ?? []).forEach(r => {
        const crop = r.crop_name || '수확물';
        harvestMap[crop] = (harvestMap[crop] || 0) + (r.quantity || 0);
      });
      setHarvestItems(
        Object.entries(harvestMap).map(([crop, qty]) => ({
          crop,
          unit: cropUnitMap[crop] || '박스',
          qty,
        }))
      );

      // 출하 → sale_unit 별 합산
      const salesMap: Record<string, number> = {};
      (salesRes.data ?? []).forEach(r => {
        const unit = r.sale_unit || '박스';
        salesMap[unit] = (salesMap[unit] || 0) + Number(r.quantity || 0);
      });
      setSalesItems(
        Object.entries(salesMap).map(([unit, qty]) => ({ unit, qty }))
      );

      // 출근
      setStaffCount((attendanceRes.data ?? []).length);
      setLaborCount((laborRes.data ?? []).reduce((s, r) => s + (r.headcount || 0), 0));

    } catch (err) {
      console.error("[Dashboard] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalWorkers = staffCount + laborCount;

  return (
    <div className="p-4 md:p-3 pb-20 md:pb-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{farm?.farm_name ?? "관리 시스템"}</h1>
        <p className="text-gray-700 text-sm mt-1">{todayDate}</p>
      </div>

      {/* 오늘 현황 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

        {/* ── 오늘 수확 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-red-100 p-2 rounded-xl">
              <Sprout className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">오늘 수확</span>
          </div>
          {loading ? (
            <p className="text-2xl font-bold text-gray-900">—</p>
          ) : harvestItems.length === 0 ? (
            <p className="text-2xl font-bold text-gray-900">
              0 <span className="text-sm font-normal text-gray-700">박스</span>
            </p>
          ) : (
            <div className="space-y-0.5">
              {harvestItems.map(item => (
                <p key={item.crop} className="font-bold text-gray-900">
                  <span className="text-2xl">{item.qty.toLocaleString()}</span>
                  <span className="text-sm font-normal text-gray-700 ml-1">{item.unit}</span>
                  {harvestItems.length > 1 && (
                    <span className="text-xs text-gray-600 ml-1.5">({item.crop})</span>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* ── 오늘 출하 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-100 p-2 rounded-xl">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">오늘 출하</span>
          </div>
          {loading ? (
            <p className="text-2xl font-bold text-gray-900">—</p>
          ) : salesItems.length === 0 ? (
            <p className="text-2xl font-bold text-gray-900">
              0 <span className="text-sm font-normal text-gray-700">박스</span>
            </p>
          ) : (
            <div className="space-y-0.5">
              {salesItems.map(item => (
                <p key={item.unit} className="font-bold text-gray-900">
                  <span className="text-2xl">{item.qty.toLocaleString()}</span>
                  <span className="text-sm font-normal text-gray-700 ml-1">{item.unit}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* ── 오늘 출근 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-100 p-2 rounded-xl">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">오늘 출근</span>
          </div>
          {loading ? (
            <p className="text-2xl font-bold text-gray-900">—</p>
          ) : (
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {totalWorkers.toLocaleString()}
                <span className="text-sm font-normal text-gray-700 ml-1">명</span>
              </p>
              {totalWorkers > 0 && (staffCount > 0 || laborCount > 0) && (
                <div className="flex gap-2 mt-1 flex-wrap">
                  {staffCount > 0 && (
                    <span className="text-xs font-bold text-blue-600">직원 {staffCount}명</span>
                  )}
                  {laborCount > 0 && (
                    <span className="text-xs font-bold text-orange-600">알바 {laborCount}명</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 빠른 기록 */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">빠른 기록</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: "/harvest", label: "수확 기록", icon: Sprout, color: "red" },
            { href: "/bulk", label: "납품 기록", icon: TrendingUp, color: "green" },
            { href: "/attendance", label: "출근 체크", icon: Users, color: "blue" },
          ].map(({ href, label, icon: Icon, color }) => (
            <a key={href} href={href}
              className={`bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 p-3 sm:p-4 flex flex-col items-center gap-2 sm:gap-3 hover:translate-y-[-4px] active:translate-y-0 transition-all active:scale-95 group`}>
              <div className={`p-3 sm:p-4 bg-${color}-50 rounded-2xl group-hover:bg-${color}-100 transition-colors`}>
                <Icon className={`w-6 h-6 sm:w-8 sm:h-8 text-${color}-500`} />
              </div>
              <span className="text-sm font-black text-gray-700 text-center">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
