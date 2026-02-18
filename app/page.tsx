"use client";

import { useEffect, useState } from "react";
import { Sprout, Users, TrendingUp, Package, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const { farm, profile, initialized } = useAuthStore();
  const [todayHarvest, setTodayHarvest] = useState(0);
  const [todayWorkers, setTodayWorkers] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
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

  const fetchTodayData = async () => {
    if (!farm?.id) return;
    setLoading(true);

    try {
      console.log("[Dashboard] Fetching today data for farm:", farm.id);
      const [harvestRes, attendanceRes, salesRes] = await Promise.all([
        supabase.from('harvest_records').select('quantity')
          .eq('farm_id', farm.id)
          .gte('recorded_at', `${today}T00:00:00`)
          .lte('recorded_at', `${today}T23:59:59`),
        supabase.from('attendance_records').select('worker_name')
          .eq('farm_id', farm.id).eq('work_date', today).eq('is_present', true),
        supabase.from('sales_records').select('quantity')
          .eq('farm_id', farm.id)
          .gte('recorded_at', `${today}T00:00:00`)
          .lte('recorded_at', `${today}T23:59:59`),
      ]);

      if (harvestRes.error) console.error("[Dashboard] Harvest error:", harvestRes.error);
      if (attendanceRes.error) console.error("[Dashboard] Attendance error:", attendanceRes.error);
      if (salesRes.error) console.error("[Dashboard] Sales error:", salesRes.error);

      setTodayHarvest(harvestRes.data?.reduce((s, r) => s + (r.quantity || 0), 0) ?? 0);
      setTodayWorkers(attendanceRes.data?.length ?? 0);
      setTodaySales(salesRes.data?.reduce((s, r) => s + Number(r.quantity || 0), 0) ?? 0);
    } catch (err) {
      console.error("[Dashboard] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 미승인 농장주 (관리자는 예외)
  if (farm && !farm.is_active && profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-2xl mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">승인 대기 중</h2>
          <p className="text-gray-500 text-sm">관리자 승인 후 사용 가능합니다.<br />잠시만 기다려 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{farm?.farm_name ?? "관리 시스템"}</h1>
        <p className="text-gray-500 text-sm mt-1">{todayDate}</p>
      </div>

      {/* 오늘 현황 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "오늘 수확", val: todayHarvest, unit: "박스", icon: Sprout, color: "red", bg: "bg-red-100" },
          { label: "오늘 출하", val: todaySales, unit: "박스", icon: Package, color: "green", bg: "bg-green-100" },
          { label: "오늘 출근", val: todayWorkers, unit: "명", icon: Users, color: "blue", bg: "bg-blue-100" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className={`${item.bg} p-2 rounded-xl`}><item.icon className={`w-5 h-5 text-${item.color}-600`} /></div>
              <span className="text-sm font-medium text-gray-500">{item.label}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {loading ? "—" : item.val}
              <span className="text-base font-normal text-gray-400 ml-1">{item.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 빠른 기록 */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3 ml-1">빠른 기록</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: "/harvest", label: "수확 기록", icon: Sprout, color: "red" },
            { href: "/sales", label: "판매 기록", icon: TrendingUp, color: "green" },
            { href: "/attendance", label: "출근 체크", icon: Users, color: "blue" },
          ].map(({ href, label, icon: Icon, color }) => (
            <a key={href} href={href}
              className={`bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 p-6 flex flex-col items-center gap-3 hover:translate-y-[-4px] active:translate-y-0 transition-all active:scale-95 group`}>
              <div className={`p-4 bg-${color}-50 rounded-2xl group-hover:bg-${color}-100 transition-colors`}>
                <Icon className={`w-8 h-8 text-${color}-500`} />
              </div>
              <span className="text-sm font-black text-gray-700 text-center">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
