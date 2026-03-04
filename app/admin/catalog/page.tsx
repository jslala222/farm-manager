"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, CropCatalog, CropCatalogGroup } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { Upload, Trash2, ChevronLeft, ImageIcon, Eye, EyeOff, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/utils";

const TARGET_KB = 150; // 자동 압축 목표

const ICONS = ['🍓','🍠','🥔','🧅','🧄','🍅','🌶️','🍇','🍎','🍐','🍑','🍈','🥒','🥬','🥕','🌽','🌾','🍄','🍯','🧊','🧃','🥤','🫙','🏭'];

export default function AdminCatalogPage() {
    const router = useRouter();
    const { profile } = useAuthStore();
    const [groups, setGroups] = useState<CropCatalogGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addPhotoInputRef = useRef<HTMLInputElement>(null);

    // 신규 작물 등록 상태
    const [newName, setNewName] = useState('');
    const [newIcon, setNewIcon] = useState('🌱');
    const [newCategory, setNewCategory] = useState<'crop' | 'processed'>('crop');
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // 사진 추가 대상 그룹
    const [addingToKey, setAddingToKey] = useState<string | null>(null);
    const [addFile, setAddFile] = useState<File | null>(null);
    const [addPreview, setAddPreview] = useState<string | null>(null);

    const [filterCategory, setFilterCategory] = useState<'all' | 'crop' | 'processed'>('all');

    useEffect(() => {
        if (profile && profile.role !== 'admin') {
            alert('관리자 전용 페이지입니다.');
            router.push('/');
            return;
        }
        fetchCatalog();
    }, [profile]);

    const fetchCatalog = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('crop_catalog')
            .select('*')
            .order('crop_key')
            .order('display_order');

        // crop_key 기준으로 그룹핑
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

    // 파일 크기 체크
    // 신규 작물 파일 선택 (자동 압축)
    const handleNewFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) { e.target.value = ''; return; }
        e.target.value = '';
        try {
            const compressed = await compressImage(file, TARGET_KB);
            setPendingFile(compressed);
            setPreviewUrl(URL.createObjectURL(compressed));
        } catch {
            alert('이미지 처리 중 오류가 발생했습니다.');
        }
    };

    // 신규 작물 등록 (작물명 + 첫 사진)
    const handleRegister = async () => {
        if (!pendingFile || !newName.trim()) {
            alert('작물명과 사진을 모두 입력해주세요.');
            return;
        }
        setUploading(true);
        try {
            const cropKey = newName.trim();
            const fileName = `catalog/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;

            const { error: uploadErr } = await supabase.storage
                .from('crop-photos')
                .upload(fileName, pendingFile, { upsert: false });
            if (uploadErr) throw uploadErr;

            const { data: urlData } = supabase.storage.from('crop-photos').getPublicUrl(fileName);

            const { error: insertErr } = await supabase.from('crop_catalog').insert({
                crop_key: cropKey,
                crop_name: cropKey,
                crop_icon: newIcon,
                image_url: urlData.publicUrl,
                category: newCategory,
                display_order: 0,
                is_published: true,
            });
            if (insertErr) throw insertErr;

            setNewName(''); setNewIcon('🌱'); setPendingFile(null); setPreviewUrl(null);
            fetchCatalog();
        } catch (err: any) {
            alert('등록 실패: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    // 기존 작물에 사진 추가 파일 선택 (자동 압축)
    const handleAddFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) { e.target.value = ''; return; }
        e.target.value = '';
        try {
            const compressed = await compressImage(file, TARGET_KB);
            setAddFile(compressed);
            setAddPreview(URL.createObjectURL(compressed));
        } catch {
            alert('이미지 처리 중 오류가 발생했습니다.');
        }
    };

    // 기존 작물에 사진 추가 업로드
    const handleAddPhoto = async (group: CropCatalogGroup) => {
        if (!addFile) return;
        setUploading(true);
        try {
            const fileName = `catalog/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;

            const { error: uploadErr } = await supabase.storage
                .from('crop-photos')
                .upload(fileName, addFile, { upsert: false });
            if (uploadErr) throw uploadErr;

            const { data: urlData } = supabase.storage.from('crop-photos').getPublicUrl(fileName);

            await supabase.from('crop_catalog').insert({
                crop_key: group.crop_key,
                crop_name: group.crop_name,
                crop_icon: group.crop_icon,
                image_url: urlData.publicUrl,
                category: group.category,
                display_order: group.photos.length,
                is_published: true,
            });

            setAddingToKey(null);
            setAddFile(null);
            setAddPreview(null);
            fetchCatalog();
        } catch (err: any) {
            alert('업로드 실패: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    // 사진 1장 삭제
    const deletePhoto = async (photo: CropCatalog) => {
        if (!confirm(`이 사진을 삭제하시겠습니까?`)) return;

        // 이 이미지를 사용 중인 farm_crops 초기화
        await supabase.from('farm_crops')
            .update({ crop_image_url: null, image_source: 'emoji' })
            .eq('crop_image_url', photo.image_url);

        // Storage 파일 삭제
        const path = photo.image_url.split('/crop-photos/')[1]?.split('?')[0];
        if (path) await supabase.storage.from('crop-photos').remove([path]);

        await supabase.from('crop_catalog').delete().eq('id', photo.id);
        fetchCatalog();
    };

    // 그룹 전체 공개/비공개
    const toggleGroupPublish = async (group: CropCatalogGroup) => {
        const newVal = !group.photos.every(p => p.is_published);
        await supabase.from('crop_catalog')
            .update({ is_published: newVal })
            .eq('crop_key', group.crop_key);
        fetchCatalog();
    };

    const filteredGroups = groups.filter(g =>
        filterCategory === 'all' || g.category === filterCategory
    );

    return (
        <div className="p-4 md:p-6 pb-20 max-w-4xl mx-auto">
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => router.push('/admin')}
                    className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h1 className="text-xl font-black text-gray-900">작물 사진 카탈로그</h1>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Admin 전용 · 1개 작물에 여러 사진 등록 가능
                    </p>
                </div>
            </div>

            {/* ── 신규 작물 등록 ── */}
            <div className="bg-white rounded-[2rem] border border-green-100 shadow-sm p-5 mb-5 space-y-4">
                <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-5 bg-green-500 rounded-full" />
                    새 작물 등록 <span className="text-gray-400 font-normal text-xs">(첫 사진과 함께)</span>
                </h2>

                {/* 사진 드롭존 */}
                <div onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-2xl border-2 border-dashed border-green-200 hover:border-green-400 bg-green-50/30 hover:bg-green-50 flex items-center justify-center cursor-pointer transition-all overflow-hidden">
                    {previewUrl
                        ? <img src={previewUrl} alt="미리보기" className="w-full h-full object-cover" />
                        : <div className="flex flex-col items-center gap-1.5 text-green-400">
                            <Upload className="w-7 h-7" />
                            <span className="text-xs font-black">사진 선택 (최대 300KB)</span>
                        </div>
                    }
                </div>
                <input ref={fileInputRef} type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleNewFileSelect} className="hidden" />

                <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="작물명 (예: 딸기)"
                        value={newName} onChange={e => setNewName(e.target.value)}
                        className="col-span-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-green-400" />
                    <div onClick={() => setNewCategory('crop')}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer font-black text-sm transition-all ${newCategory === 'crop' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400'}`}>
                        🌱 원물
                    </div>
                    <div onClick={() => setNewCategory('processed')}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer font-black text-sm transition-all ${newCategory === 'processed' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-400'}`}>
                        🏭 가공품
                    </div>
                </div>

                {/* 아이콘 */}
                <div className="flex flex-wrap gap-1.5">
                    {ICONS.map(em => (
                        <button key={em} onClick={() => setNewIcon(em)}
                            className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${newIcon === em ? 'bg-green-500 shadow-md scale-110 ring-2 ring-green-300' : 'bg-gray-50 hover:bg-green-50 border border-gray-100'}`}>
                            {em}
                        </button>
                    ))}
                </div>

                <button onClick={handleRegister}
                    disabled={uploading || !pendingFile || !newName.trim()}
                    className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100">
                    {uploading ? '등록 중...' : '✓ 카탈로그에 등록'}
                </button>
            </div>

            {/* ── 등록된 작물 목록 (그룹) ── */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-5 bg-blue-500 rounded-full" />
                        작물 그룹 ({groups.length}종)
                    </h2>
                    <div className="flex gap-1">
                        {(['all', 'crop', 'processed'] as const).map(cat => (
                            <button key={cat} onClick={() => setFilterCategory(cat)}
                                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${filterCategory === cat ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                {cat === 'all' ? '전체' : cat === 'crop' ? '원물' : '가공품'}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>
                ) : filteredGroups.length === 0 ? (
                    <div className="py-12 text-center">
                        <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium text-sm">등록된 작물이 없습니다</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredGroups.map(group => {
                            const allPublished = group.photos.every(p => p.is_published);
                            const isAdding = addingToKey === group.crop_key;
                            return (
                                <div key={group.crop_key}
                                    className="border border-gray-100 rounded-2xl p-4 space-y-3">

                                    {/* 그룹 헤더 */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{group.crop_icon}</span>
                                            <div>
                                                <p className="text-sm font-black text-gray-900">{group.crop_name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${group.category === 'crop' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {group.category === 'crop' ? '원물' : '가공품'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-bold">
                                                        사진 {group.photos.length}장
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => toggleGroupPublish(group)}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                                                title={allPublished ? '전체 숨기기' : '전체 공개'}>
                                                {allPublished
                                                    ? <Eye className="w-4 h-4 text-green-600" />
                                                    : <EyeOff className="w-4 h-4 text-gray-400" />}
                                            </button>
                                            {/* 사진 추가 버튼 */}
                                            <button
                                                onClick={() => {
                                                    setAddingToKey(isAdding ? null : group.crop_key);
                                                    setAddFile(null);
                                                    setAddPreview(null);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-black transition-all">
                                                <Plus className="w-3.5 h-3.5" />
                                                사진 추가
                                            </button>
                                        </div>
                                    </div>

                                    {/* 사진 추가 인라인 폼 */}
                                    {isAdding && (
                                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-2">
                                            <p className="text-xs font-black text-blue-600">
                                                {group.crop_name} 사진 추가 (300KB 이하)
                                            </p>
                                            <div onClick={() => addPhotoInputRef.current?.click()}
                                                className="w-full h-24 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 bg-white flex items-center justify-center cursor-pointer transition-all overflow-hidden">
                                                {addPreview
                                                    ? <img src={addPreview} alt="미리보기" className="w-full h-full object-cover" />
                                                    : <div className="flex flex-col items-center gap-1 text-blue-300">
                                                        <Upload className="w-5 h-5" />
                                                        <span className="text-[10px] font-black">파일 선택</span>
                                                    </div>
                                                }
                                            </div>
                                            <input ref={addPhotoInputRef} type="file"
                                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                                onChange={handleAddFileSelect} className="hidden" />
                                            <div className="flex gap-2">
                                                <button onClick={() => { setAddingToKey(null); setAddFile(null); setAddPreview(null); }}
                                                    className="flex-1 py-2 text-xs font-black text-gray-500 bg-white border border-gray-200 rounded-xl">
                                                    취소
                                                </button>
                                                <button onClick={() => handleAddPhoto(group)}
                                                    disabled={!addFile || uploading}
                                                    className="flex-1 py-2 text-xs font-black text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 rounded-xl transition-all">
                                                    {uploading ? '업로드 중...' : '✓ 추가'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* 사진 목록 (가로 스크롤) */}
                                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                                        {group.photos.map((photo, idx) => (
                                            <div key={photo.id}
                                                className={`relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 transition-all ${photo.is_published ? 'border-transparent' : 'border-gray-200 opacity-50'}`}>
                                                <img src={photo.image_url} alt={`${group.crop_name} ${idx + 1}`}
                                                    className="w-full h-full object-cover" />
                                                {/* 대표사진 표시 */}
                                                {idx === 0 && (
                                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-500/80 rounded-full">
                                                        <span className="text-[8px] font-black text-white">대표</span>
                                                    </div>
                                                )}
                                                {/* 삭제 버튼 */}
                                                <button onClick={() => deletePhoto(photo)}
                                                    className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-lg hover:bg-red-500 transition-all">
                                                    <Trash2 className="w-3 h-3 text-white" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
