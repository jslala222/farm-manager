"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Minus } from "lucide-react";
import { useFarmStore } from "@/store/farmStore";

export default function HarvestPage() {
    const { houseCount } = useFarmStore();
    const [selectedHouse, setSelectedHouse] = useState<number | null>(null);
    const [selectedGrade, setSelectedGrade] = useState<'sang' | 'jung' | 'ha'>('sang');
    const [quantity, setQuantity] = useState(1);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const houses = Array.from({ length: houseCount }, (_, i) => i + 1);

    const handleSave = () => {
        if (!selectedHouse) {
            alert("하우스 동을 선택해주세요!");
            return;
        }
        // TODO: Supabase integration
        const summary = `${selectedHouse}동 / ${getSelectedGradeLabel()} / ${quantity}박스`;
        alert(`[저장 완료]\n${summary} 저장되었습니다.`);

        // Reset for next input
        setQuantity(1);
        setSelectedHouse(null);
    };

    const getSelectedGradeLabel = () => {
        switch (selectedGrade) {
            case 'sang': return '상(특)';
            case 'jung': return '중(보통)';
            case 'ha': return '하(주스)';
        }
    };

    if (!mounted) return null;

    return (
        <main className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white p-4 shadow-sm flex items-center justify-center sticky top-0 z-10">
                <h1 className="text-xl font-bold text-gray-900">수확 기록</h1>
            </header>

            <div className="p-6 space-y-8">
                {/* Section 1: House Selection */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">1. 하우스 선택</h2>
                    <div className="grid grid-cols-4 gap-3">
                        {houses.map((house) => (
                            <button
                                key={house}
                                onClick={() => setSelectedHouse(house)}
                                className={`
                  h-14 rounded-xl font-bold text-lg border transition-all
                  ${selectedHouse === house
                                        ? 'bg-red-500 text-white border-red-600 shadow-md transform scale-105'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:bg-red-50'}
                `}
                            >
                                {house}동
                            </button>
                        ))}
                    </div>
                </section>

                {/* Section 2: Grade Selection */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">2. 등급 선택</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { id: 'sang', label: '특/상' },
                            { id: 'jung', label: '중/보통' },
                            { id: 'ha', label: '하/주스' },
                        ].map((grade) => (
                            <button
                                key={grade.id}
                                onClick={() => setSelectedGrade(grade.id as any)}
                                className={`
                  py-4 rounded-xl font-bold text-lg border transition-all
                  ${selectedGrade === grade.id
                                        ? 'bg-red-100 text-red-700 border-red-300 ring-2 ring-red-500'
                                        : 'bg-white text-gray-500 border-gray-200'}
                `}
                            >
                                {grade.label}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Section 3: Quantity */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">3. 수량 (박스)</h2>
                    <div className="flex items-center justify-center gap-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 transition-colors"
                        >
                            <Minus className="w-8 h-8 text-gray-600" />
                        </button>

                        <span className="text-4xl font-bold text-gray-900 w-20 text-center">{quantity}</span>

                        <button
                            onClick={() => setQuantity(quantity + 1)}
                            className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 active:bg-red-300 transition-colors"
                        >
                            <Plus className="w-8 h-8 text-red-600" />
                        </button>
                    </div>
                </section>

                {/* Action Button */}
                <button
                    onClick={handleSave}
                    className="w-full bg-gray-900 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-gray-800 active:transform active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Save className="w-6 h-6" />
                    저장하기
                </button>
            </div>
        </main>
    );
}
