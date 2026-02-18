"use client";

import { useFarmStore } from "@/store/farmStore";
import { useState, useEffect } from "react";
import { Save, Settings } from "lucide-react";

export default function SettingsPage() {
    const { farmName, houseCount, setFarmName, setHouseCount } = useFarmStore();

    // Local state for form input
    const [name, setName] = useState("");
    const [count, setCount] = useState(12);
    const [mounted, setMounted] = useState(false);

    // Sync with store on mount
    useEffect(() => {
        setName(farmName);
        setCount(houseCount);
        setMounted(true);
    }, [farmName, houseCount]);

    const handleSave = () => {
        setFarmName(name);
        setHouseCount(count);
        alert("농장 설정이 저장되었습니다! 🏡");
    };

    if (!mounted) return null; // Prevent hydration mismatch

    return (
        <main className="min-h-screen bg-gray-50 pb-24 font-sans">
            <header className="bg-white p-4 shadow-sm flex items-center justify-center sticky top-0 z-10">
                <h1 className="text-xl font-bold text-gray-900">농장 설정</h1>
            </header>

            <div className="p-6 space-y-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-gray-100 p-2 rounded-lg">
                            <Settings className="w-6 h-6 text-gray-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">기본 정보</h2>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                농장 이름
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full p-4 text-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                                placeholder="예: 대박 농원"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                하우스 동 수 (개)
                            </label>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setCount(Math.max(1, count - 1))}
                                    className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center text-xl font-bold active:scale-95 transition-transform"
                                >
                                    -
                                </button>
                                <div className="flex-1 text-center font-bold text-3xl text-gray-900">
                                    {count}
                                </div>
                                <button
                                    onClick={() => setCount(count + 1)}
                                    className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center text-xl font-bold active:scale-95 transition-transform"
                                >
                                    +
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 text-center">
                                최소 1동부터 설정 가능합니다.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    className="w-full bg-red-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Save className="w-5 h-5" />
                    설정 저장하기
                </button>
            </div>
        </main>
    );
}
