"use client";

import Link from "next/link";
import {
  Sprout,
  Users,
  CloudSun
} from "lucide-react";
import { useFarmStore } from "@/store/farmStore";
import { useEffect, useState } from "react";

export default function Home() {
  const { farmName } = useFarmStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mock data for dashboard
  const todayHarvest = 150; // boxes
  const todayWorkers = 5; // people
  const todayDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{farmName}</h1>
            <p className="text-gray-500 text-sm mt-1">{todayDate}</p>
          </div>
          <div className="bg-red-50 p-2 rounded-full">
            <CloudSun className="w-6 h-6 text-red-500" />
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <Sprout className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600">오늘 수확</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{todayHarvest} <span className="text-sm font-normal text-gray-500">박스</span></p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">오늘 출근</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{todayWorkers} <span className="text-sm font-normal text-gray-500">명</span></p>
          </div>
        </div>
      </header>

      {/* Recent Activity (Mock) */}
      <div className="px-6 pb-6 mt-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">최근 활동</h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-50 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">오후 2:30</span>
            <span className="text-sm text-gray-900">12동 수확 15박스 완료</span>
          </div>
          <div className="p-4 border-b border-gray-50 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">오전 11:00</span>
            <span className="text-sm text-gray-900">농협 출하 50박스</span>
          </div>
          <div className="p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">오전 8:00</span>
            <span className="text-sm text-gray-900">외국인 3명 출근 완료</span>
          </div>
        </div>
      </div>
    </main>
  );
}
