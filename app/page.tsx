"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Sprout, Users, Package,
    ChevronLeft, ChevronRight, BarChart3, Activity, Bell,
    Building2, Truck, Receipt, TrendingUp, CheckCircle2, Circle
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useHarvestStore } from "@/store/harvestStore";
import { supabase } from "@/lib/supabase";

const DAY_NAMES_KR = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_FULL_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const toLocalDateStr = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const wmoToKr = (code: number) => {
    if (code === 0) return { label: '맑음', icon: '☀️' };
    if (code <= 2) return { label: '구름 조금', icon: '🌤️' };
    if (code <= 3) return { label: '흐림', icon: '☁️' };
    if (code <= 48) return { label: '안개', icon: '🌫️' };
    if (code <= 57) return { label: '이슬비', icon: '🌦️' };
    if (code <= 67) return { label: '비', icon: '🌧️' };
    if (code <= 77) return { label: '눈', icon: '🌨️' };
    if (code <= 82) return { label: '소나기', icon: '🌦️' };
    return { label: '뇌우', icon: '⛈️' };
};

type HarvestItem = { crop: string; unit: string; qty: number };
type SalesItem = { crop: string; unit: string; qty: number };
type RecentActivity = { id: string; type: 'harvest' | 'sales'; label: string; qty: number; unit: string; time: string };
type WeatherData = { temp: number; weatherCode: number; windSpeed: number; humidity: number; tempMax: number; tempMin: number } | null;
type CropItem = { id: string; crop_name: string; crop_icon: string };

const HEADER_BG = 'linear-gradient(180deg, #5BAE7E 0%, #469265 100%)';

export default function Home() {
    const router = useRouter();
    const { farm, initialized } = useAuthStore();
    const { setActiveTab } = useHarvestStore();

    const todayStr = toLocalDateStr();
    const [selectedDate, setSelectedDate] = useState(todayStr);

    const [harvestItems, setHarvestItems] = useState<HarvestItem[]>([]);
    const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
    const [staffCount, setStaffCount] = useState(0);
    const [laborCount, setLaborCount] = useState(0);
    const [activeCropCount, setActiveCropCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const [unpaidB2BCount, setUnpaidB2BCount] = useState(0);
    const [unpaidB2CCount, setUnpaidB2CCount] = useState(0);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [weather, setWeather] = useState<WeatherData>(null);
    const [cropsList, setCropsList] = useState<CropItem[]>([]);

    const weekDates = useMemo(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        const dow = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
        return Array.from({ length: 7 }, (_, i) => {
            const dd = new Date(monday);
            dd.setDate(monday.getDate() + i);
            return toLocalDateStr(dd);
        });
    }, [selectedDate]);

    const moveWeek = (direction: number) => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + direction * 7);
        const next = toLocalDateStr(d);
        if (next <= todayStr) setSelectedDate(next);
    };

    useEffect(() => {
        const lat = farm?.latitude ?? 36.5;
        const lon = farm?.longitude ?? 127.7;
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1`)
            .then(r => r.json())
            .then(data => {
                const c = data?.current;
                const day = data?.daily;
                if (c) setWeather({
                    temp: Math.round(c.temperature_2m),
                    weatherCode: c.weather_code,
                    windSpeed: Math.round(c.wind_speed_10m),
                    humidity: Math.round(c.relative_humidity_2m),
                    tempMax: Math.round(day?.temperature_2m_max?.[0] ?? c.temperature_2m + 3),
                    tempMin: Math.round(day?.temperature_2m_min?.[0] ?? c.temperature_2m - 5),
                });
            })
            .catch(() => { });
    }, [farm?.latitude, farm?.longitude]);

    useEffect(() => {
        if (initialized) {
            if (farm?.id) fetchAllData();
            else setLoading(false);
        }
    }, [farm, initialized, selectedDate]);

    if (initialized && !farm && !loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-3 text-center">
                <div className="p-6 rounded-[2.5rem] mb-6" style={{ background: '#dcfce7' }}>
                    <Sprout className="w-12 h-12" style={{ color: '#16a34a' }} />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-3">농장 정보가 없습니다</h2>
                <p className="text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">시스템을 사용하려면 먼저 농장을 등록해야 합니다.</p>
                <a href="/settings" className="text-white px-8 py-4 rounded-2xl font-black text-base shadow-lg" style={{ background: '#16a34a' }}>
                    첫 농장 등록하기
                </a>
            </div>
        );
    }

    const fetchAllData = async () => {
        if (!farm?.id) return;
        setLoading(true);
        try {
            const [
                harvestRes, cropsRes, attendanceRes, salesRes, laborRes,
                unpaidRes,
                recentHarvestRes, recentSalesRes,
            ] = await Promise.all([
                supabase.from('harvest_records').select('quantity, crop_name').eq('farm_id', farm.id)
                    .gte('recorded_at', `${selectedDate}T00:00:00`).lte('recorded_at', `${selectedDate}T23:59:59`),
                supabase.from('farm_crops').select('id, crop_name, default_unit, crop_icon').eq('farm_id', farm.id).eq('is_active', true),
                supabase.from('attendance_records').select('worker_name').eq('farm_id', farm.id).eq('work_date', selectedDate).eq('is_present', true),
                supabase.from('sales_records').select('quantity, sale_unit, crop_name').eq('farm_id', farm.id)
                    .gte('recorded_at', `${selectedDate}T00:00:00`).lte('recorded_at', `${selectedDate}T23:59:59`),
                supabase.from('labor_costs').select('headcount').eq('farm_id', farm.id).eq('work_date', selectedDate),
                supabase.from('sales_records').select('id, delivery_method, sale_type, partner_id, recorded_at')
                    .eq('farm_id', farm.id).eq('is_settled', false),
                supabase.from('harvest_records').select('id, crop_name, quantity, recorded_at')
                    .eq('farm_id', farm.id).order('recorded_at', { ascending: false }).limit(5),
                supabase.from('sales_records').select('id, crop_name, quantity, sale_unit, recorded_at')
                    .eq('farm_id', farm.id).order('recorded_at', { ascending: false }).limit(5),
            ]);

            const cropUnitMap: Record<string, string> = {};
            (cropsRes.data ?? []).forEach((c: any) => { cropUnitMap[c.crop_name] = c.default_unit || '박스'; });
            setActiveCropCount((cropsRes.data ?? []).length);
            setCropsList((cropsRes.data ?? []).map((c: any) => ({ id: c.id || c.crop_name, crop_name: c.crop_name, crop_icon: c.crop_icon || '🌿' })));

            const harvestMap: Record<string, number> = {};
            (harvestRes.data ?? []).forEach((r: any) => {
                const crop = r.crop_name || '수확물';
                harvestMap[crop] = (harvestMap[crop] || 0) + (r.quantity || 0);
            });
            setHarvestItems(Object.entries(harvestMap).map(([crop, qty]) => ({ crop, unit: cropUnitMap[crop] || '박스', qty })));

            const salesCropMap: Record<string, { unit: string; qty: number }> = {};
            (salesRes.data ?? []).forEach((r: any) => {
                const crop = r.crop_name || '출하물';
                const unit = r.sale_unit || 'kg';
                if (!salesCropMap[crop]) salesCropMap[crop] = { unit, qty: 0 };
                salesCropMap[crop].qty += Number(r.quantity || 0);
            });
            setSalesItems(Object.entries(salesCropMap).map(([crop, { unit, qty }]) => ({ crop, unit, qty })));

            setStaffCount((attendanceRes.data ?? []).length);
            setLaborCount((laborRes.data ?? []).reduce((s: number, r: any) => s + (r.headcount || 0), 0));

            const unpaidData = unpaidRes.data ?? [];
            const b2bRecords = (unpaidData as any[]).filter((r: any) => r.delivery_method !== 'courier' && (r.sale_type === 'b2b' || r.partner_id));
            const dailyGroupSet = new Set<string>();
            b2bRecords.forEach((r: any) => {
                const date = String(r.recorded_at || '').split('T')[0];
                dailyGroupSet.add(`${r.partner_id || 'no-id'}_${date}`);
            });
            setUnpaidB2BCount(dailyGroupSet.size);
            setUnpaidB2CCount((unpaidData as any[]).filter((r: any) => r.delivery_method === 'courier').length);

            const activities: RecentActivity[] = [];
            (recentHarvestRes.data ?? []).forEach((r: any) => {
                activities.push({ id: `h-${r.id}`, type: 'harvest', label: r.crop_name || '수확물', qty: r.quantity || 0, unit: cropUnitMap[r.crop_name] || '박스', time: r.recorded_at });
            });
            (recentSalesRes.data ?? []).forEach((r: any) => {
                activities.push({ id: `s-${r.id}`, type: 'sales', label: r.crop_name || '출하', qty: Number(r.quantity || 0), unit: r.sale_unit || '박스', time: r.recorded_at });
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
    const totalUnpaid = unpaidB2BCount + unpaidB2CCount;

    const todayDateObj = new Date(todayStr + 'T00:00:00');
    const fullDateLabel = `${todayDateObj.getFullYear()}년 ${todayDateObj.getMonth() + 1}월 ${todayDateObj.getDate()}일 ${DAY_FULL_KR[todayDateObj.getDay()]}`;

    const wmo = weather ? wmoToKr(weather.weatherCode) : null;
    const harvestTotal = harvestItems.reduce((s, i) => s + i.qty, 0);
    const salesTotal = salesItems.reduce((s, i) => s + i.qty, 0);

    // 헤더 4개 통계
    const headerStats = [
        { emoji: '🌱', value: loading ? '—' : String(activeCropCount), unit: '종', label: '재배 작물' },
        { emoji: '🌿', value: loading ? '—' : String(harvestTotal), unit: harvestItems[0]?.unit || '박스', label: '오늘 수확' },
        { emoji: '📦', value: loading ? '—' : String(salesTotal), unit: salesItems[0]?.unit || '박스', label: '오늘 출하' },
        { emoji: totalUnpaid > 0 ? '⚠️' : '✅', value: loading ? '—' : String(totalUnpaid), unit: '건', label: '미결재', warn: totalUnpaid > 0 },
    ];

    // 오늘 현황 목록 (할 일 스타일)
    const todayTasks = [
        ...(unpaidB2BCount > 0 ? [{ id: 'b2b', color: '#ef4444', done: false, label: `거래처 미정산 ${unpaidB2BCount}건 처리`, sub: '통합결산 → 거래처 정산', href: '/finance' }] : []),
        ...(unpaidB2CCount > 0 ? [{ id: 'b2c', color: '#f59e0b', done: false, label: `택배 미정산 ${unpaidB2CCount}건 처리`, sub: '통합결산 → 택배 정산', href: '/finance' }] : []),
        ...(harvestTotal > 0 ? [{ id: 'harvest', color: '#22c55e', done: true, label: `오늘 수확 기록 완료 (${harvestTotal}${harvestItems[0]?.unit || '박스'})`, sub: '수확 관리에서 확인', href: '/harvest' }] : [{ id: 'harvest-remind', color: '#22c55e', done: false, label: '오늘 수확 기록 입력', sub: '수확 관리 메뉴에서 입력', href: '/harvest' }]),
        ...(totalWorkers > 0 ? [{ id: 'workers', color: '#3b82f6', done: true, label: `출근 체크 완료 (${totalWorkers}명)`, sub: '일일 현황에서 확인', href: '/labor' }] : [{ id: 'workers-remind', color: '#3b82f6', done: false, label: '오늘 출근 체크', sub: '출근 관리 메뉴에서 입력', href: '/attendance' }]),
    ].slice(0, 4);

    return (
        <div className="min-h-screen pb-20 md:pb-6" style={{ background: '#F8FAF9' }}>

            {/* ══════════════════════════════
                짙은 녹색 헤더
            ══════════════════════════════ */}
            <div className="relative overflow-hidden px-5 pt-5 pb-12" style={{ background: HEADER_BG }}>
                {/* 장식 원 */}
                <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="absolute top-6 -right-4 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.04)' }} />

                {/* 날짜 + 인사 + 알림 */}
                <div className="relative flex items-start justify-between mb-4 pl-12 md:pl-0">
                    <div>
                        <p className="text-sm font-medium" style={{ color: '#C8E8D5' }}>{fullDateLabel}</p>
                        <h1 className="text-white text-xl font-bold mt-0.5">
                            안녕하세요, {farm?.farm_name ?? '농장주'}님 👋
                        </h1>
                    </div>
                    <button onClick={() => router.push('/finance')}
                        className="relative p-2.5 rounded-2xl shrink-0 active:scale-90 transition-all"
                        style={{ background: 'rgba(255,255,255,0.15)' }}>
                        <Bell className="w-5 h-5 text-white" />
                        {totalUnpaid > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                                style={{ border: '2px solid #5BAE7E' }}>
                                {totalUnpaid > 9 ? '9+' : totalUnpaid}
                            </span>
                        )}
                    </button>
                </div>

                {/* 날씨 스트립 */}
                <div className="relative rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
                    {weather && wmo ? (
                        <>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{wmo.icon}</span>
                                <div>
                                    <p className="text-white text-sm font-black">{wmo.label} · {weather.temp}°C</p>
                                    <p className="text-xs" style={{ color: '#C8E8D5' }}>최고 {weather.tempMax}° / 최저 {weather.tempMin}°</p>
                                </div>
                            </div>
                            <div className="flex gap-3 text-xs" style={{ color: '#C8E8D5' }}>
                                <span>💧 {weather.humidity}%</span>
                                <span>💨 {weather.windSpeed}m/s</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 w-full">
                            <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.2)' }} />
                            <div className="h-4 rounded-lg flex-1 animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
                        </div>
                    )}
                </div>

                {/* 4개 통계 (헤더 안, 가로 4열) */}
                <div className="relative grid grid-cols-4 gap-2">
                    {headerStats.map((s, i) => (
                        <div key={i} className="rounded-2xl p-3 text-center"
                            style={{ background: s.warn ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.2)', border: s.warn ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                            <span className="text-xl leading-none">{s.emoji}</span>
                            <p className="text-white text-lg font-black leading-tight mt-1">{s.value}</p>
                            <p className="text-[9px] font-medium mt-0.5 leading-tight" style={{ color: s.warn ? '#fcd34d' : '#D6EFE0' }}>
                                {s.unit}<br />{s.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ══════════════════════════════
                흰 섹션 (헤더 위로 둥근 모서리로 겹침)
            ══════════════════════════════ */}
            <div className="-mt-6 relative z-10" style={{ borderRadius: '28px 28px 0 0', background: '#F8FAF9' }}>
                <div className="px-4 pt-5">

                    {/* 빠른 기록 4버튼 */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                        {[
                            { href: "/harvest", label: "수확 기록", icon: Sprout, bg: "#dcfce7", color: "#16a34a", action: () => { setActiveTab('statistics'); router.push('/harvest'); } },
                            { href: "/bulk", label: "납품 기록", icon: Building2, bg: "#dbeafe", color: "#2563eb" },
                            { href: "/courier", label: "택배 기록", icon: Truck, bg: "#ede9fe", color: "#7c3aed" },
                            { href: "/attendance", label: "출근 체크", icon: Users, bg: "#ffedd5", color: "#ea580c" },
                        ].map(({ href, label, icon: Icon, bg, color, action }) => (
                            <button key={href}
                                onClick={action || (() => router.push(href))}
                                className="bg-white rounded-2xl py-3 px-1 flex flex-col items-center gap-2 shadow-sm active:scale-95 transition-all">
                                <div className="p-3 rounded-2xl" style={{ background: bg }}>
                                    <Icon className="w-5 h-5" style={{ color }} />
                                </div>
                                <span className="text-[10px] font-black text-center leading-tight" style={{ color: '#374151' }}>{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* 오늘 현황 */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-black" style={{ color: '#14311e' }}>오늘 현황</h2>
                            <a href="/finance" className="text-xs font-bold" style={{ color: '#16a34a' }}>전체보기 &gt;</a>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                            {loading ? (
                                <div className="p-4 space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-1 h-10 rounded-full animate-pulse" style={{ background: '#e5e7eb' }} />
                                            <div className="flex-1 space-y-1.5">
                                                <div className="h-3.5 rounded animate-pulse" style={{ background: '#e5e7eb', width: '70%' }} />
                                                <div className="h-3 rounded animate-pulse" style={{ background: '#f3f4f6', width: '50%' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : todayTasks.length === 0 ? (
                                <div className="px-4 py-6 text-center">
                                    <p className="text-2xl mb-2">🎉</p>
                                    <p className="text-sm font-bold" style={{ color: '#16a34a' }}>오늘 처리할 항목이 없습니다!</p>
                                    <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>모든 정산이 완료되었습니다</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {todayTasks.map((task) => (
                                        <a key={task.id} href={task.href}
                                            className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-colors">
                                            {/* 색상 좌측 바 */}
                                            <div className="w-1 h-10 rounded-full shrink-0" style={{ background: task.color }} />
                                            {/* 체크 서클 */}
                                            <div className="shrink-0">
                                                {task.done
                                                    ? <CheckCircle2 className="w-5 h-5" style={{ color: task.color }} />
                                                    : <Circle className="w-5 h-5" style={{ color: '#d1d5db' }} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold leading-tight ${task.done ? 'line-through' : ''}`}
                                                    style={{ color: task.done ? '#9ca3af' : '#111827' }}>
                                                    {task.label}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{task.sub}</p>
                                            </div>
                                            <span className="text-xs" style={{ color: '#d1d5db' }}>›</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 작물 현황 */}
                    {cropsList.length > 0 && (
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-black" style={{ color: '#14311e' }}>작물 현황</h2>
                                <a href="/harvest" className="text-xs font-bold" style={{ color: '#16a34a' }}>전체보기 &gt;</a>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                                {cropsList.map((crop, idx) => {
                                    const gradients = [
                                        'linear-gradient(135deg, #14311e 0%, #236940 100%)',
                                        'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
                                        'linear-gradient(135deg, #4a1d96 0%, #7c3aed 100%)',
                                        'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
                                        'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
                                    ];
                                    return (
                                        <div key={crop.id} className="shrink-0 w-36 rounded-2xl shadow-sm relative overflow-hidden"
                                            style={{ background: gradients[idx % gradients.length] }}>
                                            <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full pointer-events-none"
                                                style={{ background: 'rgba(255,255,255,0.07)' }} />
                                            <div className="p-4 pt-5">
                                                <span className="text-3xl block mb-2">{crop.crop_icon}</span>
                                                <div className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mb-2"
                                                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                                                    재배중
                                                </div>
                                                <p className="text-white font-black text-sm leading-tight">{crop.crop_name}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 최근 알림 */}
                    {!loading && (unpaidB2BCount > 0 || unpaidB2CCount > 0 || recentActivity.length > 0) && (
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-base font-black" style={{ color: '#14311e' }}>최근 알림</h2>
                                {totalUnpaid > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: '#fee2e2', color: '#dc2626' }}>
                                        {totalUnpaid}개 미처리
                                    </span>
                                )}
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                {unpaidB2BCount > 0 && (
                                    <a href="/finance" className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 active:bg-gray-50 transition-colors">
                                        <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#fff7ed' }}>
                                            <span className="text-base">⚠️</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold" style={{ color: '#111827' }}>거래처 미정산 {unpaidB2BCount}건</p>
                                            <p className="text-[10px]" style={{ color: '#9ca3af' }}>정산이 필요한 거래처 전표가 있습니다</p>
                                        </div>
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                                            style={{ background: '#ef4444', color: '#fff' }}>
                                            {unpaidB2BCount > 9 ? '9+' : unpaidB2BCount}
                                        </span>
                                    </a>
                                )}
                                {unpaidB2CCount > 0 && (
                                    <a href="/finance" className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 active:bg-gray-50 transition-colors">
                                        <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#eff6ff' }}>
                                            <span className="text-base">📦</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold" style={{ color: '#111827' }}>택배 미정산 {unpaidB2CCount}건</p>
                                            <p className="text-[10px]" style={{ color: '#9ca3af' }}>정산이 필요한 택배 건이 있습니다</p>
                                        </div>
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                                            style={{ background: '#3b82f6', color: '#fff' }}>
                                            {unpaidB2CCount > 9 ? '9+' : unpaidB2CCount}
                                        </span>
                                    </a>
                                )}
                                {recentActivity.slice(0, 2).map((act) => {
                                    const t = new Date(act.time);
                                    const timeStr = `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
                                    return (
                                        <div key={act.id} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-0 border-gray-50">
                                            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
                                                style={{ background: act.type === 'harvest' ? '#dcfce7' : '#dbeafe' }}>
                                                <span className="text-base">{act.type === 'harvest' ? '🌿' : '✅'}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate" style={{ color: '#111827' }}>
                                                    {act.type === 'harvest' ? '수확' : '출하'} · {act.label} {act.qty.toLocaleString()}{act.unit}
                                                </p>
                                                <p className="text-[10px]" style={{ color: '#9ca3af' }}>{timeStr}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 내 농장 */}
                    {farm && (
                        <div className="mb-5">
                            <h2 className="text-base font-black mb-3" style={{ color: '#14311e' }}>내 농장</h2>
                            <div className="rounded-2xl overflow-hidden shadow-sm relative" style={{ background: HEADER_BG }}>
                                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full pointer-events-none"
                                    style={{ background: 'rgba(255,255,255,0.06)' }} />
                                <div className="absolute bottom-0 right-4 w-24 h-24 rounded-full pointer-events-none"
                                    style={{ background: 'rgba(255,255,255,0.04)' }} />
                                <div className="relative p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                                            style={{ background: 'rgba(255,255,255,0.15)' }}>
                                            🌱
                                        </div>
                                        <div>
                                            <p className="text-white font-black text-base">{farm.farm_name}</p>
                                            <p className="text-xs mt-0.5" style={{ color: '#C8E8D5' }}>내 농장 정보</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: '재배 작물', value: `${activeCropCount}종` },
                                            { label: '오늘 출근', value: `${totalWorkers}명` },
                                            { label: '미정산', value: `${totalUnpaid}건`, warn: totalUnpaid > 0 },
                                        ].map((item) => (
                                            <div key={item.label} className="rounded-xl p-2.5"
                                                style={{ background: 'rgba(255,255,255,0.1)' }}>
                                                <p className="text-[9px] font-bold" style={{ color: '#C8E8D5' }}>{item.label}</p>
                                                <p className="font-black text-lg leading-tight"
                                                    style={{ color: item.warn ? '#fbbf24' : '#fff' }}>{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 주간 날짜 선택 */}
                    <div className="bg-white rounded-2xl shadow-sm mb-5">
                        <div className="flex items-center justify-between px-4 pt-3 pb-1">
                            <span className="text-sm font-black" style={{ color: '#14311e' }}>날짜 선택</span>
                            <div className="flex gap-1.5">
                                <button onClick={() => moveWeek(-1)} className="p-1.5 rounded-xl" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setSelectedDate(todayStr)} disabled={isToday}
                                    className="px-3 py-1 rounded-xl text-[10px] font-black disabled:opacity-30"
                                    style={{ background: '#f0fdf4', color: '#16a34a' }}>오늘</button>
                                <button onClick={() => moveWeek(1)} disabled={weekDates[6] >= todayStr}
                                    className="p-1.5 rounded-xl disabled:opacity-30" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex overflow-x-auto px-3 pb-3 pt-1 gap-1.5 scrollbar-hide">
                            {weekDates.map(date => {
                                const d = new Date(date + 'T00:00:00');
                                const dayName = DAY_NAMES_KR[d.getDay()];
                                const dayNum = parseInt(date.slice(8));
                                const isSelected = date === selectedDate;
                                const isTodayDate = date === todayStr;
                                const isFuture = date > todayStr;
                                return (
                                    <button key={date} onClick={() => !isFuture && setSelectedDate(date)} disabled={isFuture}
                                        className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-2xl shrink-0 min-w-[46px] ${isFuture ? 'opacity-20 cursor-not-allowed' : ''}`}
                                        style={isSelected ? { background: 'linear-gradient(180deg,#1b5130,#236940)', boxShadow: '0 4px 10px rgba(35,105,64,0.3)' } : {}}>
                                        <span className="text-[9px] font-black" style={{ color: isSelected ? '#86efac' : '#9ca3af' }}>{dayName}</span>
                                        <span className="text-sm font-black leading-none" style={{ color: isSelected ? '#fff' : isTodayDate ? '#16a34a' : '#1f2937' }}>{dayNum}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 바로가기 */}
                    <div className="mb-5">
                        <h2 className="text-sm font-black mb-3" style={{ color: '#14311e' }}>바로가기</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { href: "/finance", label: "통합 결산", sub: "수입·지출 현황", bg: "#dbeafe", color: "#2563eb", icon: BarChart3 },
                                { href: "/expenses", label: "지출 관리", sub: "경비 입력", bg: "#fee2e2", color: "#dc2626", icon: Receipt },
                                { href: "/settled", label: "거래처 정산", sub: "B2B 정산 완료", bg: "#dcfce7", color: "#16a34a", icon: TrendingUp },
                                { href: "/b2c-settled", label: "택배 정산", sub: "B2C 정산 완료", bg: "#ede9fe", color: "#7c3aed", icon: Package },
                            ].map(({ href, label, sub, bg, color, icon: Icon }) => (
                                <a key={href} href={href}
                                    className="flex items-center gap-3 bg-white rounded-2xl p-3.5 shadow-sm active:scale-[0.98] transition-all">
                                    <div className="p-2.5 rounded-xl shrink-0" style={{ background: bg }}>
                                        <Icon className="w-5 h-5" style={{ color }} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black leading-tight" style={{ color: '#111827' }}>{label}</p>
                                        <p className="text-[10px] mt-0.5" style={{ color: '#6b7280' }}>{sub}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* 최근 활동 */}
                    {!loading && recentActivity.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity className="w-4 h-4" style={{ color: '#16a34a' }} />
                                <span className="text-sm font-black" style={{ color: '#14311e' }}>최근 활동</span>
                            </div>
                            <div className="space-y-3">
                                {recentActivity.map(act => {
                                    const t = new Date(act.time);
                                    const timeStr = `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
                                    return (
                                        <div key={act.id} className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
                                                style={{ background: act.type === 'harvest' ? '#dcfce7' : '#dbeafe' }}>
                                                {act.type === 'harvest'
                                                    ? <Sprout className="w-4 h-4" style={{ color: '#16a34a' }} />
                                                    : <Package className="w-4 h-4" style={{ color: '#2563eb' }} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate" style={{ color: '#111827' }}>
                                                    {act.type === 'harvest' ? '수확' : '출하'} · {act.label} {act.qty.toLocaleString()}{act.unit}
                                                </p>
                                                <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>{timeStr}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
