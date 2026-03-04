"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, CropCatalog, CropCatalogGroup } from "@/lib/supabase";
import { X, Upload, ImageIcon, Check, ChevronLeft } from "lucide-react";
import { compressImage } from "@/lib/utils";

const TARGET_KB = 150; // 자동 압축 목표

interface CropImagePickerProps {
    farmId: string;
    cropId: string;
    cropName: string;
    currentImageUrl?: string | null;
    currentSource?: string;
    onSelect: (imageUrl: string, source: 'catalog' | 'custom') => void;
    onRemove: () => void;
    onClose: () => void;
}

export default function CropImagePicker({
    farmId, cropId, cropName,
    currentImageUrl, currentSource,
    onSelect, onRemove, onClose,
}: CropImagePickerProps) {
    const [tab, setTab] = useState<'catalog' | 'upload'>('catalog');
    const [groups, setGroups] = useState<CropCatalogGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // 카탈로그: 그룹 선택 → 사진 선택 2단계
    const [selectedGroup, setSelectedGroup] = useState<CropCatalogGroup | null>(null);
    const [filterCategory, setFilterCategory] = useState<'all' | 'crop' | 'processed'>('all');
    const [search, setSearch] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchCatalog();
    }, []);

    const fetchCatalog = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('crop_catalog')
            .select('*')
            .eq('is_published', true)
            .order('crop_key')
            .order('display_order');

        // crop_key 기준 그룹핑
        const map: Record<string, CropCatalogGroup> = {};
        (data ?? []).forEach((item: CropCatalog) => {
            const key = item.crop_key || item.crop_name;
            if (!map[key]) {
                map[key] = {
                    crop_key: key,
                    crop_name: item.crop_name,
                    crop_icon: item.crop_icon,
                    category: item.category,
                    photos: [],
                };
            }
            map[key].photos.push(item);
        });
        setGroups(Object.values(map));
        setLoading(false);
    };

    const filteredGroups = groups.filter(g => {
        const matchCat = filterCategory === 'all' || g.category === filterCategory;
        const matchSearch = !search || g.crop_name.includes(search);
        return matchCat && matchSearch;
    });

    // 사진 1장 선택 (카탈로그)
    const handlePhotoSelect = (photo: CropCatalog) => {
        onSelect(photo.image_url, 'catalog');
    };

    // 직접 업로드 (자동 압축 150KB)
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const path = `farms/${farmId}/${cropId}.jpg`;

        setUploading(true);
        try {
            const compressed = await compressImage(file, TARGET_KB);
            await supabase.storage.from('crop-photos').remove([path]);
            const { error } = await supabase.storage
                .from('crop-photos')
                .upload(path, compressed, { upsert: true });
            if (error) throw error;

            const { data: urlData } = supabase.storage.from('crop-photos').getPublicUrl(path);
            onSelect(urlData.publicUrl + `?t=${Date.now()}`, 'custom');
        } catch (err: any) {
            alert('업로드 실패: ' + err.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-3">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300"
                style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

                {/* 헤더 */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                        {selectedGroup && (
                            <button onClick={() => setSelectedGroup(null)}
                                className="p-1 rounded-lg hover:bg-gray-100 transition-all">
                                <ChevronLeft className="w-4 h-4 text-gray-500" />
                            </button>
                        )}
                        <div>
                            <h3 className="text-base font-black text-gray-900">
                                {selectedGroup ? `${selectedGroup.crop_name} 사진 선택` : '사진 선택'}
                            </h3>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">{cropName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* 탭 (그룹 목록에서만 표시) */}
                {!selectedGroup && (
                    <div className="flex border-b border-gray-100 shrink-0">
                        <button onClick={() => setTab('catalog')}
                            className={`flex-1 py-3 text-sm font-black transition-all ${tab === 'catalog' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-400'}`}>
                            📚 카탈로그
                        </button>
                        <button onClick={() => setTab('upload')}
                            className={`flex-1 py-3 text-sm font-black transition-all ${tab === 'upload' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400'}`}>
                            📤 직접 업로드
                        </button>
                    </div>
                )}

                {/* 스크롤 영역 */}
                <div className="flex-1 overflow-y-auto">

                    {/* ── 카탈로그 탭 ── */}
                    {tab === 'catalog' && !selectedGroup && (
                        <div className="p-4 space-y-3">
                            {/* 필터 */}
                            <div className="flex gap-2">
                                <input type="text" placeholder="작물명 검색..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-green-400" />
                                <div className="flex gap-1">
                                    {(['all', 'crop', 'processed'] as const).map(cat => (
                                        <button key={cat} onClick={() => setFilterCategory(cat)}
                                            className={`px-2.5 py-2 text-xs font-black rounded-xl transition-all ${filterCategory === cat ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            {cat === 'all' ? '전체' : cat === 'crop' ? '원물' : '가공'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 작물 그룹 목록 */}
                            {loading ? (
                                <div className="py-10 text-center text-gray-400 text-sm">로딩 중...</div>
                            ) : filteredGroups.length === 0 ? (
                                <div className="py-10 text-center">
                                    <ImageIcon className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400 font-medium">
                                        {groups.length === 0 ? 'Admin이 아직 카탈로그를 등록하지 않았습니다' : '검색 결과 없음'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {filteredGroups.map(group => {
                                        const repPhoto = group.photos[0];
                                        const isCurrentGroup = group.photos.some(p => p.image_url === currentImageUrl);
                                        return (
                                            <button key={group.crop_key}
                                                onClick={() => {
                                                    // 사진 1장이면 바로 선택, 여러 장이면 갤러리 진입
                                                    if (group.photos.length === 1) {
                                                        handlePhotoSelect(repPhoto);
                                                    } else {
                                                        setSelectedGroup(group);
                                                    }
                                                }}
                                                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${isCurrentGroup ? 'border-green-500 ring-2 ring-green-300' : 'border-transparent hover:border-green-300'}`}>
                                                <img src={repPhoto.image_url} alt={group.crop_name}
                                                    className="w-full h-full object-cover" />
                                                {/* 사진 장수 뱃지 */}
                                                {group.photos.length > 1 && (
                                                    <div className="absolute top-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5">
                                                        <span className="text-[9px] font-black text-white">{group.photos.length}장</span>
                                                    </div>
                                                )}
                                                {isCurrentGroup && (
                                                    <div className="absolute top-1 left-1 bg-green-500 rounded-full p-0.5">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                                                    <p className="text-white text-[10px] font-black truncate">{group.crop_name}</p>
                                                </div>
                                                <span className={`absolute top-1 ${group.photos.length > 1 ? 'right-8' : 'right-1'} text-[8px] font-black px-1 py-0.5 rounded-full ${group.category === 'crop' ? 'bg-green-500/80 text-white' : 'bg-amber-500/80 text-white'}`}>
                                                    {group.category === 'crop' ? '원물' : '가공'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── 갤러리 (그룹 내 사진 선택) ── */}
                    {tab === 'catalog' && selectedGroup && (
                        <div className="p-4 space-y-3">
                            <p className="text-xs text-gray-400 font-bold">
                                사진 {selectedGroup.photos.length}장 중 원하는 사진을 선택하세요
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {selectedGroup.photos.map((photo, idx) => {
                                    const isSelected = currentImageUrl === photo.image_url;
                                    return (
                                        <button key={photo.id}
                                            onClick={() => handlePhotoSelect(photo)}
                                            className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-green-500 ring-2 ring-green-300' : 'border-transparent hover:border-green-300'}`}>
                                            <img src={photo.image_url} alt={`${selectedGroup.crop_name} ${idx + 1}`}
                                                className="w-full h-full object-cover" />
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                                    <Check className="w-7 h-7 text-white drop-shadow" />
                                                </div>
                                            )}
                                            {idx === 0 && (
                                                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-green-500/80 rounded-full">
                                                    <span className="text-[9px] font-black text-white">대표</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── 직접 업로드 탭 ── */}
                    {tab === 'upload' && !selectedGroup && (
                        <div className="p-4 space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
                                <p className="text-xs text-blue-700 font-bold">
                                    📌 <strong>자동 압축 적용</strong> (150KB 이하) · JPG, PNG, WebP 지원<br />
                                    카탈로그에 없는 사진을 직접 올릴 수 있습니다
                                </p>
                            </div>

                            {/* 현재 직접 업로드 사진 미리보기 */}
                            {currentImageUrl && currentSource === 'custom' && (
                                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-200">
                                    <img src={currentImageUrl} alt="현재 사진" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                    <p className="absolute bottom-2 left-3 text-white text-xs font-bold">현재 사진 (직접 업로드)</p>
                                </div>
                            )}

                            <button onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full py-5 border-2 border-dashed border-blue-200 rounded-2xl flex flex-col items-center gap-2 hover:border-blue-400 hover:bg-blue-50/50 transition-all disabled:opacity-50">
                                <Upload className={`w-8 h-8 ${uploading ? 'text-blue-300 animate-bounce' : 'text-blue-400'}`} />
                                <span className="text-sm font-black text-blue-600">
                                    {uploading ? '업로드 중...' : '사진 파일 선택'}
                                </span>
                                <span className="text-xs text-gray-400">자동 압축 · JPG, PNG, WebP</span>
                            </button>
                            <input ref={fileInputRef} type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                onChange={handleFileChange} className="hidden" />
                        </div>
                    )}
                </div>

                {/* 하단 버튼 */}
                <div className="p-4 border-t border-gray-100 shrink-0 flex gap-2">
                    {currentImageUrl && (
                        <button onClick={onRemove}
                            className="px-4 py-3 text-sm font-black text-red-500 border border-red-100 rounded-2xl hover:bg-red-50 transition-all">
                            사진 제거
                        </button>
                    )}
                    <button onClick={onClose}
                        className="flex-1 py-3 text-sm font-black bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all">
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
