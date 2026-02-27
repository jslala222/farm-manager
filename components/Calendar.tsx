"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface CalendarProps {
    selectedDate: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    harvestedDates?: Record<string, number[]>; // { "2024-02-22": [1, 2, 6] }
    mode?: 'harvest' | 'expenditure';
    legend?: { label: string; items: { value: number; label: string; color: string }[] };
}

export default function Calendar({ selectedDate, onChange, harvestedDates = {}, mode = 'harvest', legend }: CalendarProps) {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));

    // 현재 표시 중인 달의 날짜 리스트 계산
    const days = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();

        const prevMonthLastDate = new Date(year, month, 0).getDate();

        const dayList = [];

        // 이전 달 날짜 채우기
        for (let i = firstDay - 1; i >= 0; i--) {
            dayList.push({
                date: new Date(year, month - 1, prevMonthLastDate - i),
                currentMonth: false
            });
        }

        // 현재 달 날짜 채우기
        for (let i = 1; i <= lastDate; i++) {
            dayList.push({
                date: new Date(year, month, i),
                currentMonth: true
            });
        }

        // 다음 달 날짜 채우기 (5주(35칸) 또는 6주(42칸) 맞춤)
        const totalSlots = dayList.length <= 35 ? 35 : 42;
        const remaining = totalSlots - dayList.length;
        for (let i = 1; i <= remaining; i++) {
            dayList.push({
                date: new Date(year, month + 1, i),
                currentMonth: false
            });
        }

        return dayList;
    }, [viewDate]);

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const isSelected = (date: Date) => {
        const sel = new Date(selectedDate);
        return date.getDate() === sel.getDate() &&
            date.getMonth() === sel.getMonth() &&
            date.getFullYear() === sel.getFullYear();
    };

    const formatDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 마커 색상 매핑
    const getMarkerColor = (value: number) => {
        if (legend) {
            const item = legend.items.find(i => i.value === value);
            if (item) return item.color;
        }

        const colors: Record<number, string> = {
            1: "bg-red-400",
            2: "bg-red-400",
            3: "bg-red-400",
            6: "bg-orange-400",
            7: "bg-sky-400",
            8: "bg-indigo-400"
        };
        return colors[value] || "bg-green-400";
    };

    const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

    return (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
                        <CalendarIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-900 leading-none">
                            {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
                        </h3>
                        <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest mt-1">
                            {mode === 'harvest' ? 'Calendar & Harvest' : 'Expenditure Calendar'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 text-gray-700 hover:text-gray-900">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => {
                            const now = new Date();
                            const todayKey = formatDateKey(now);
                            setViewDate(now);
                            onChange(todayKey);
                        }}
                        className="px-3 text-[10px] font-black text-green-600 bg-white border border-green-100 rounded-lg shadow-sm hover:bg-green-50 transition-all"
                    >
                        오늘
                    </button>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 text-gray-700 hover:text-gray-900">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="p-4 bg-white">
                <div className="grid grid-cols-7 mb-2">
                    {weekDays.map((d, i) => (
                        <div key={d} className={`text-center py-2 text-[10px] font-black uppercase tracking-tighter ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-600'}`}>
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((item, i) => {
                        const dateKey = formatDateKey(item.date);
                        const housesWithHarvest = harvestedDates[dateKey] || [];
                        const hasHarvest = housesWithHarvest.length > 0;
                        const selected = isSelected(item.date);
                        const today = isToday(item.date);

                        return (
                            <button
                                key={i}
                                onClick={() => {
                                    onChange(dateKey);
                                    if (!item.currentMonth) setViewDate(new Date(item.date));
                                }}
                                className={`
                                    relative h-14 rounded-2xl flex flex-col items-center justify-start pt-2.5 transition-all
                                    ${!item.currentMonth ? 'opacity-20 translate-y-1' : ''}
                                    ${selected
                                        ? 'bg-green-600 text-white shadow-lg ring-4 ring-green-100 z-10 scale-105 border-transparent'
                                        : today
                                            ? 'bg-orange-50 border-2 border-red-500 shadow-sm'
                                            : hasHarvest
                                                ? 'border-2 border-green-400 shadow-sm shadow-green-50 hover:bg-gray-50'
                                                : 'border-2 border-transparent hover:bg-gray-50'
                                    }
                                `}
                            >
                                <span className={`text-xs font-black ${selected ? 'text-white' : today ? 'text-orange-600' : ''}`}>
                                    {item.date.getDate()}
                                </span>

                                {/* 분류별 마커 표시 (점) */}
                                <div className="absolute bottom-2.5 flex gap-0.5 px-1 justify-center max-w-full overflow-hidden">
                                    {housesWithHarvest.slice(0, 5).map(val => (
                                        <div
                                            key={val}
                                            className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : getMarkerColor(val)} shadow-[0_0_4px_rgba(0,0,0,0.1)]`}
                                            title={mode === 'harvest' ? `${val}동 수확` : '지출 발생'}
                                        />
                                    ))}
                                    {housesWithHarvest.length > 5 && (
                                        <div className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-gray-400'} flex items-center justify-center`}>
                                            <span className="text-[5px] font-bold">+</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center gap-4 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-3 h-3 border-2 border-red-500 bg-orange-50 rounded-md"></div>
                    <span className="text-[10px] font-black text-gray-700">오늘</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-3 h-3 border-2 ${mode === 'harvest' ? 'border-green-400' : 'border-blue-400'} rounded-md`}></div>
                    <span className="text-[10px] font-black text-gray-700">{mode === 'harvest' ? '수확 활동' : '지출 내역'}</span>
                </div>
                <div className="h-3 w-px bg-gray-200 mx-1"></div>
                <div className="flex items-center gap-2 pointer-events-none">
                    <span className="text-[10px] font-black text-gray-600 mr-1 italic">
                        {legend?.label || 'HOUSE COLOR'}:
                    </span>
                    {legend ? (
                        legend.items.map(item => (
                            <div key={item.value} className="flex items-center gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${item.color}`}></div>
                                <span className="text-[9px] font-bold text-gray-700">{item.label}</span>
                            </div>
                        ))
                    ) : (
                        [1, 6, 7, 8].map(hNum => (
                            <div key={hNum} className="flex items-center gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${getMarkerColor(hNum)}`}></div>
                                <span className="text-[9px] font-bold text-gray-700">{hNum}동</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
