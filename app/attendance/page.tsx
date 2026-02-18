"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, UserCheck, UserX } from "lucide-react";

type Worker = {
    id: string;
    name: string;
    role: 'family' | 'foreign' | 'part_time';
    isPresent: boolean;
};

export default function AttendancePage() {
    // Mock data
    const [workers, setWorkers] = useState<Worker[]>([
        { id: '1', name: '사장님', role: 'family', isPresent: true },
        { id: '2', name: '부모님(부)', role: 'family', isPresent: true },
        { id: '3', name: '부모님(모)', role: 'family', isPresent: true },
        { id: '4', name: '며느리', role: 'family', isPresent: true },
        { id: '5', name: '알리', role: 'foreign', isPresent: true },
        { id: '6', name: '자말', role: 'foreign', isPresent: true },
        { id: '7', name: '하산', role: 'foreign', isPresent: true },
        { id: '8', name: '알바1', role: 'part_time', isPresent: false },
        { id: '9', name: '알바2', role: 'part_time', isPresent: false },
    ]);

    const toggleAttendance = (id: string) => {
        setWorkers(workers.map(w =>
            w.id === id ? { ...w, isPresent: !w.isPresent } : w
        ));
    };

    const handleSave = () => {
        // TODO: Supabase integration
        const presentCount = workers.filter(w => w.isPresent).length;
        alert(`[저장 완료]\n총 ${presentCount}명 출근 기록되었습니다.`);
    };

    const renderGroup = (title: string, role: string) => (
        <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                {title}
                <span className="text-sm font-normal text-gray-500">
                    ({workers.filter(w => w.role === role && w.isPresent).length} / {workers.filter(w => w.role === role).length})
                </span>
            </h2>
            <div className="grid grid-cols-1 gap-3">
                {workers.filter(w => w.role === role).map(worker => (
                    <button
                        key={worker.id}
                        onClick={() => toggleAttendance(worker.id)}
                        className={`
              flex items-center justify-between p-4 rounded-xl border transition-all
              ${worker.isPresent
                                ? 'bg-blue-50 border-blue-200 shadow-sm'
                                : 'bg-white border-gray-100 text-gray-400'}
            `}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${worker.isPresent ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                {worker.isPresent
                                    ? <UserCheck className="w-6 h-6 text-blue-600" />
                                    : <UserX className="w-6 h-6 text-gray-400" />
                                }
                            </div>
                            <span className={`text-lg font-bold ${worker.isPresent ? 'text-gray-900' : 'text-gray-400'}`}>
                                {worker.name}
                            </span>
                        </div>

                        <div className={`
              px-3 py-1 rounded-lg text-sm font-bold
              ${worker.isPresent ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}
            `}>
                            {worker.isPresent ? '출근' : '결근'}
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );

    return (
        <main className="min-h-screen bg-gray-50 pb-20">
            <header className="bg-white p-4 shadow-sm flex items-center justify-center sticky top-0 z-10">
                <h1 className="text-xl font-bold text-gray-900">출근 체크</h1>
            </header>

            <div className="p-6">
                {renderGroup("💼 가족 (관리자)", 'family')}
                {renderGroup("🌏 외국인 근로자", 'foreign')}
                {renderGroup("⏳ 아르바이트", 'part_time')}

                <button
                    onClick={handleSave}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-blue-700 active:transform active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
                >
                    <Save className="w-6 h-6" />
                    출근부 저장
                </button>
            </div>
        </main>
    );
}
