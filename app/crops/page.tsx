"use client";

import { useState, useEffect } from "react";
import { supabase, FarmCrop, SalesRecord } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { ChevronLeft, ImageIcon, X, TrendingUp, Package, AlertCircle, Tag } from "lucide-react";
import { useRouter } from "next/navigation";

const CROP_ICON_MAP: Record<string, string> = {
    '딸기': '🍓', '고구마': '🍠', '감자': '🥔', '상추': '🥬', '고추': '🌶️',
    '토마토': '🍅', '참외': '🍈', '멜론': '🍈', '수박': '🍉', '사과': '🍎',
    '포도': '🍇', '샤인머스켓': '🍇', '옥수수': '🌽', '당근': '🥕',
    '양파': '🧅', '마늘': '🧄', '배추': '🥬', '오이': '🥒',
};
const getCropIcon = (name: string) => {
    for (const [key, icon] of Object.entries(CROP_ICON_MAP)) {
        if (name.includes(key)) return icon;
    }
    return '🌱';
};

interface CropStats {
    monthlyQty: number;
    unit: string;
    monthlyRevenue: number;
    unsettledAmount: number;
    recentPrices: { grade: string; price: number }[];
    recentDeliveries: { partner: string; qty: number; unit: string; date: string; isSettled: boolean }[];
}

export default function CropsPage() {
    const router = useRouter();
    const { farm } = useAuthStore();
    const [crops, setCrops] = useState<FarmCrop[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'all' | 'crop' | 'processed'>('all');

    // 바텀시트 상태
    const [selectedCrop, setSelectedCrop] = useState<FarmCrop | null>(null);
    const [cropStats, setCropStats] = useState<CropStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    useEffect(() => {
        if (farm?.id) fetchCrops();
    }, [farm?.id]);

    const fetchCrops = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('farm_crops')
            .select('*')
            .eq('farm_id', farm!.id)
            .eq('is_active', true)
            .order('sort_order');
        setCrops(data ?? []);
        setLoading(false);
    };

    const handleCropClick = async (crop: FarmCrop) => {
        if (!farm?.id) return;
        setSelectedCrop(crop);
        setCropStats(null);
        setStatsLoading(true);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // 이번달 전체 + 최근 20건 한 번에 조회
        const [monthRes, recentRes, unsettledRes] = await Promise.all([
            supabase
                .from('sales_records')
                .select('quantity, price, sale_unit, is_settled')
                .eq('farm_id', farm!.id)
                .eq('crop_name', crop.crop_name)
                .gte('recorded_at', monthStart),
            supabase
                .from('sales_records')
                .select('quantity, price, grade, sale_unit, recorded_at, is_settled, sale_type, partner:partner_id(company_name)')
                .eq('farm_id', farm!.id)
                .eq('crop_name', crop.crop_name)
                .order('recorded_at', { ascending: false })
                .limit(20),
            supabase
                .from('sales_records')
                .select('quantity, price')
                .eq('farm_id', farm!.id)
                .eq('crop_name', crop.crop_name)
                .eq('is_settled', false),
        ]);

        const monthRecords: SalesRecord[] = monthRes.data ?? [];
        const recentRecords: SalesRecord[] = recentRes.data ?? [];
        const unsettledRecords: SalesRecord[] = unsettledRes.data ?? [];

        // 이번달 출하량 / 매출
        const monthlyQty = monthRecords.reduce((s, r) => s + (r.quantity ?? 0), 0);
        const monthlyRevenue = monthRecords.reduce((s, r) => s + ((r.quantity ?? 0) * (r.price ?? 0)), 0);

        // 미정산 금액
        const unsettledAmount = unsettledRecords.reduce((s, r) => s + ((r.quantity ?? 0) * (r.price ?? 0)), 0);

        // 등급별 최근 단가
        const priceMap = new Map<string, number>();
        recentRecords.forEach(r => {
            const grade = r.grade ?? '미지정';
            if ((r.price ?? 0) > 0 && !priceMap.has(grade)) {
                priceMap.set(grade, r.price!);
            }
        });
        const recentPrices = Array.from(priceMap.entries()).map(([grade, price]) => ({ grade, price }));

        // 최근 납품 리스트 (B2B, 분 단위 그룹화로 중복 제거)
        const deliveryMap = new Map<string, { partner: string; qty: number; unit: string; date: string; isSettled: boolean }>();
        recentRecords
            .filter(r => r.sale_type === 'b2b' || (r.sale_type === 'etc' && r.partner))
            .forEach(r => {
                const partner = (r.partner as { company_name?: string } | null)?.company_name ?? '거래처';
                const dateKey = r.recorded_at.slice(0, 16); // 분 단위 키
                if (!deliveryMap.has(dateKey)) {
                    const dateStr = r.recorded_at.slice(0, 10).replace(/-/g, '/');
                    deliveryMap.set(dateKey, {
                        partner,
                        qty: r.quantity ?? 0,
                        unit: r.sale_unit ?? crop.default_unit,
                        date: dateStr,
                        isSettled: r.is_settled ?? false,
                    });
                } else {
                    deliveryMap.get(dateKey)!.qty += r.quantity ?? 0;
                }
            });
        const recentDeliveries = Array.from(deliveryMap.values()).slice(0, 5);

        setCropStats({
            monthlyQty,
            unit: crop.default_unit,
            monthlyRevenue,
            unsettledAmount,
            recentPrices,
            recentDeliveries,
        });
        setStatsLoading(false);
    };

    const closeSheet = () => {
        setSelectedCrop(null);
        setCropStats(null);
    };

    const filtered = crops.filter(c =>
        tab === 'all' || c.category === tab
    );

    const cropCount = crops.filter(c => c.category === 'crop').length;
    const processedCount = crops.filter(c => c.category === 'processed').length;

    const gradients = [
        'linear-gradient(135deg, #14311e 0%, #236940 100%)',
        'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        'linear-gradient(135deg, #4a1d96 0%, #7c3aed 100%)',
        'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
        'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
        'linear-gradient(135deg, #831843 0%, #db2777 100%)',
        'linear-gradient(135deg, #1c1917 0%, #78716c 100%)',
        'linear-gradient(135deg, #134e4a 0%, #0d9488 100%)',
    ];

    const now = new Date();
    const monthLabel = `${now.getMonth() + 1}월`;

    return (
        <div className="p-4 md:p-6 pb-20 max-w-4xl mx-auto">
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-2">
                <button onClick={() => router.push('/')}
                    className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h1 className="text-xl font-black text-gray-900">작물 현황 전체보기</h1>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                        {farm?.farm_name} · 총 {crops.length}종
                    </p>
                </div>
            </div>

            {/* 요약 뱃지 */}
            <div className="flex gap-2 mb-5 ml-11">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black">
                    🌱 원물 {cropCount}종
                </span>
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-black">
                    🏭 가공품 {processedCount}종
                </span>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-2xl">
                {([
                    { key: 'all', label: '전체', icon: '🌾' },
                    { key: 'crop', label: '원물', icon: '🌱' },
                    { key: 'processed', label: '가공품', icon: '🏭' },
                ] as const).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${tab === t.key
                            ? 'bg-white shadow-sm text-gray-900'
                            : 'text-gray-400 hover:text-gray-600'}`}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* 카드 그리드 */}
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-20 text-center">
                    <ImageIcon className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">
                        {crops.length === 0
                            ? '등록된 작물이 없습니다.\n설정에서 작물을 추가해보세요!'
                            : '해당 카테고리에 작물이 없습니다'}
                    </p>
                    {crops.length === 0 && (
                        <button onClick={() => router.push('/settings')}
                            className="mt-4 px-6 py-3 bg-green-600 text-white rounded-2xl font-black text-sm">
                            설정으로 이동
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filtered.map((crop, idx) => (
                        <button
                            key={crop.id}
                            onClick={() => handleCropClick(crop)}
                            className="relative rounded-2xl overflow-hidden shadow-md aspect-[3/4] text-left active:scale-[0.97] transition-transform"
                            style={{
                                background: crop.crop_image_url
                                    ? undefined
                                    : gradients[idx % gradients.length]
                            }}>

                            {/* 배경 사진 */}
                            {crop.crop_image_url ? (
                                <img
                                    src={crop.crop_image_url}
                                    alt={crop.crop_name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            ) : (
                                <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full"
                                    style={{ background: 'rgba(255,255,255,0.07)' }} />
                            )}

                            {/* 카테고리 뱃지 */}
                            <div className="absolute top-3 left-3">
                                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${crop.category === 'crop'
                                    ? 'bg-green-500/80 text-white'
                                    : 'bg-amber-500/80 text-white'}`}>
                                    {crop.category === 'crop' ? '원물' : '가공품'}
                                </span>
                            </div>

                            {/* 콘텐츠 - 반투명 어두운 배경 추가 */}
                            <div className="absolute bottom-0 left-0 right-0">
                                <div className="w-full h-full absolute bottom-0 left-0 right-0" style={{ background: 'rgba(0,0,0,0.55)', borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}></div>
                                <div className="relative p-3">
                                    {!crop.crop_image_url && (
                                        <span className="text-4xl block mb-2">
                                            {crop.crop_icon || getCropIcon(crop.crop_name)}
                                        </span>
                                    )}
                                    <div className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black mb-1.5"
                                        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                                        재배중
                                    </div>
                                    <p className="text-white font-black text-sm leading-tight">
                                        {crop.crop_name}
                                    </p>
                                    <p className="text-white/60 text-[10px] font-bold mt-0.5">
                                        단위: {crop.default_unit}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* 설정 바로가기 */}
            {crops.length > 0 && (
                <div className="mt-6 text-center">
                    <button onClick={() => router.push('/settings')}
                        className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all">
                        ⚙️ 사진 설정하기
                    </button>
                </div>
            )}

            {/* ── 바텀시트 오버레이 ── */}
            {selectedCrop && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={closeSheet}
                >
                    <div
                        className="bg-white w-full max-w-md rounded-t-[2rem] shadow-2xl max-h-[82vh] flex flex-col animate-slide-up"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 핸들 + 헤더 */}
                        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">
                                    {selectedCrop.crop_icon || getCropIcon(selectedCrop.crop_name)}
                                </span>
                                <div>
                                    <p className="text-base font-black text-slate-900">{selectedCrop.crop_name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">
                                        {selectedCrop.category === 'crop' ? '원물' : '가공품'} · 단위: {selectedCrop.default_unit}
                                    </p>
                                </div>
                            </div>
                            <button onClick={closeSheet}
                                className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* 콘텐츠 */}
                        <div className="overflow-y-auto flex-1 px-5 pb-6 space-y-4">
                            {statsLoading ? (
                                <div className="space-y-3 pt-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            ) : cropStats ? (
                                <>
                                    {/* KPI 카드 4개 */}
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {/* 이번달 출하량 */}
                                        <div className="bg-emerald-50 rounded-2xl p-3.5 flex items-start gap-2.5">
                                            <div className="p-1.5 bg-emerald-100 rounded-xl shrink-0">
                                                <Package className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-emerald-500 uppercase">{monthLabel} 출하</p>
                                                <p className="text-lg font-black text-emerald-800 leading-tight">
                                                    {cropStats.monthlyQty.toLocaleString()}
                                                    <span className="text-xs ml-0.5">{cropStats.unit}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* 이번달 매출 */}
                                        <div className="bg-blue-50 rounded-2xl p-3.5 flex items-start gap-2.5">
                                            <div className="p-1.5 bg-blue-100 rounded-xl shrink-0">
                                                <TrendingUp className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-blue-500 uppercase">{monthLabel} 매출</p>
                                                <p className="text-lg font-black text-blue-800 leading-tight">
                                                    {cropStats.monthlyRevenue > 0
                                                        ? `${Math.round(cropStats.monthlyRevenue / 10000)}만`
                                                        : '-'}
                                                    {cropStats.monthlyRevenue > 0 && <span className="text-xs ml-0.5">원</span>}
                                                </p>
                                            </div>
                                        </div>

                                        {/* 미정산 금액 */}
                                        <div className={`rounded-2xl p-3.5 flex items-start gap-2.5 ${cropStats.unsettledAmount > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                                            <div className={`p-1.5 rounded-xl shrink-0 ${cropStats.unsettledAmount > 0 ? 'bg-rose-100' : 'bg-slate-100'}`}>
                                                <AlertCircle className={`w-4 h-4 ${cropStats.unsettledAmount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
                                            </div>
                                            <div>
                                                <p className={`text-[9px] font-black uppercase ${cropStats.unsettledAmount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>미정산</p>
                                                <p className={`text-lg font-black leading-tight ${cropStats.unsettledAmount > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                                                    {cropStats.unsettledAmount > 0
                                                        ? `${Math.round(cropStats.unsettledAmount / 10000)}만`
                                                        : '없음'}
                                                    {cropStats.unsettledAmount > 0 && <span className="text-xs ml-0.5">원</span>}
                                                </p>
                                            </div>
                                        </div>

                                        {/* 최근 단가 */}
                                        <div className="bg-amber-50 rounded-2xl p-3.5 flex items-start gap-2.5">
                                            <div className="p-1.5 bg-amber-100 rounded-xl shrink-0">
                                                <Tag className="w-4 h-4 text-amber-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-black text-amber-500 uppercase">최근 단가</p>
                                                {cropStats.recentPrices.length > 0 ? (
                                                    <div className="mt-0.5 space-y-0.5">
                                                        {cropStats.recentPrices.slice(0, 2).map(({ grade, price }) => (
                                                            <p key={grade} className="text-xs font-black text-amber-800">
                                                                <span className="text-amber-500">{grade} </span>
                                                                {price.toLocaleString()}원
                                                            </p>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-lg font-black text-slate-300">-</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 최근 납품 리스트 */}
                                    {cropStats.recentDeliveries.length > 0 && (
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2 px-1">최근 납품</p>
                                            <div className="space-y-1.5">
                                                {cropStats.recentDeliveries.map((d, i) => (
                                                    <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-black text-slate-800 truncate">{d.partner}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold">{d.date}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-sm font-black text-slate-700">
                                                                {d.qty.toLocaleString()}{d.unit}
                                                            </p>
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${d.isSettled
                                                                ? 'bg-emerald-100 text-emerald-600'
                                                                : 'bg-amber-100 text-amber-600'}`}>
                                                                {d.isSettled ? '완료' : '미정산'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 데이터 없음 */}
                                    {cropStats.monthlyQty === 0 && cropStats.recentDeliveries.length === 0 && (
                                        <div className="py-8 text-center">
                                            <p className="text-slate-300 font-black text-sm">이번달 출하 기록이 없습니다</p>
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
