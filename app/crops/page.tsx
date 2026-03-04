"use client";

import { useState, useEffect } from "react";
import { supabase, FarmCrop } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { ChevronLeft, ImageIcon } from "lucide-react";
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

export default function CropsPage() {
    const router = useRouter();
    const { farm } = useAuthStore();
    const [crops, setCrops] = useState<FarmCrop[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'all' | 'crop' | 'processed'>('all');

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
                        <div key={crop.id}
                            className="relative rounded-2xl overflow-hidden shadow-md aspect-[3/4]"
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
                                /* 이모지 배경 장식 */
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

                            {/* 콘텐츠 */}
                            <div className="absolute bottom-0 left-0 right-0 p-3">
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
        </div>
    );
}
