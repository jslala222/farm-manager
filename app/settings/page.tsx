"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, Home, LayoutGrid, AlertCircle, Building2, CheckCircle2, Sprout, GripVertical } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Farm, FarmHouse, FarmCrop } from "@/lib/supabase";
import { formatPhone, formatBusinessNumber } from "@/lib/utils";
import AddressSearch from "@/components/AddressSearch";
import { Search } from "lucide-react";

export default function SettingsPage() {
    const { user, farm: storeFarm, profile, initialize, initialized } = useAuthStore();
    const [farm, setFarm] = useState<Partial<Farm>>({});
    const [houses, setHouses] = useState<FarmHouse[]>([]);
    const [newHouseNum, setNewHouseNum] = useState("");
    const [initialHouseCount, setInitialHouseCount] = useState("");
    const [saving, setSaving] = useState(false);
    const [loadingHouses, setLoadingHouses] = useState(false);

    // [bkit 엔터프라이즈] 작물 관리 상태
    const [farmCrops, setFarmCrops] = useState<FarmCrop[]>([]);
    const [newCropName, setNewCropName] = useState('');
    const [newCropIcon, setNewCropIcon] = useState('🌱');
    const [loadingCrops, setLoadingCrops] = useState(false);

    // 컴포넌트 마운트 시 초기화 확인
    useEffect(() => {
        console.log("SettingsPage 마운트. User:", user?.email, "Initialized:", initialized);
        if (!initialized) {
            initialize();
        }
    }, []);

    // 스토어의 농장 정보가 변경되면 로컬 상태 동기화
    useEffect(() => {
        console.log("Store Farm 변경 감지:", storeFarm?.farm_name);
        if (storeFarm) {
            setFarm(storeFarm);
            fetchHouses();
            fetchCrops();
        } else {
            setFarm({});
            setHouses([]);
            setFarmCrops([]);
        }
    }, [storeFarm]);

    const fetchHouses = async () => {
        if (!storeFarm?.id) return;
        setLoadingHouses(true);
        console.log("하우스 목록 가져오기 시도... Farm ID:", storeFarm.id);
        const { data, error } = await supabase.from('farm_houses').select('*')
            .eq('farm_id', storeFarm.id).order('house_number');

        if (error) console.error("하우스 로딩 실패:", error);
        setHouses(data ?? []);
        setLoadingHouses(false);
    };

    const handleSaveFarm = async () => {
        console.log("--- handleSaveFarm 호출됨 ---");
        console.log("현재 User 상태:", user);
        console.log("현재 Farm ID:", storeFarm?.id);
        console.log("입력된 Farm 데이터:", farm);

        if (!user) {
            alert("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
            return;
        }

        if (!farm.farm_name?.trim()) {
            alert("농장 이름을 입력해주세요.");
            return;
        }

        setSaving(true);

        try {
            if (storeFarm?.id) {
                // 기존 농장 정보 수정
                console.log("기존 농장 수정 프로세스 시작...");
                const { data: updatedData, error } = await supabase.from('farms').update({
                    farm_name: farm.farm_name,
                    phone: farm.phone,
                    fax: farm.fax,
                    email: farm.email,
                    address: farm.address,
                    postal_code: farm.postal_code,
                    latitude: farm.latitude,
                    longitude: farm.longitude,
                    business_number: farm.business_number,
                    notes: farm.notes,
                }).eq('id', storeFarm.id).select(); // .select() 추가하여 결과 확인

                if (error) throw error;

                if (!updatedData || updatedData.length === 0) {
                    alert("⚠️ 저장에 실패했습니다. 농장주 본인이나 관리자 권한이 있는지 확인해 주세요. (RLS 정책 위반)");
                    setSaving(false);
                    return;
                }

                alert("✅ 농장 정보가 성공적으로 수정되었습니다!");
                await initialize(true); // 강제 갱신 호출
            } else {
                // 신규 농장 등록
                console.log("신규 농장 등록 프로세스 시작...");
                const { data: newFarm, error } = await supabase.from('farms').insert({
                    owner_id: user.id,
                    farm_name: farm.farm_name,
                    phone: farm.phone,
                    fax: farm.fax,
                    email: farm.email,
                    address: farm.address,
                    postal_code: farm.postal_code,
                    latitude: farm.latitude,
                    longitude: farm.longitude,
                    business_number: farm.business_number,
                    notes: farm.notes,
                    is_active: true
                }).select().single();

                if (error) throw error;
                console.log("신규 농장 생성 완료 ID:", newFarm.id);

                // 초기 동 자동 생성
                const count = parseInt(initialHouseCount);
                if (count > 0 && !isNaN(count)) {
                    console.log(`초기 동 ${count}개 생성 중...`);
                    const initialHouses = [];
                    for (let i = 1; i <= count; i++) {
                        initialHouses.push({
                            farm_id: newFarm.id,
                            house_number: i,
                            house_name: `${i}동`,
                            is_active: true
                        });
                    }
                    const { error: houseError } = await supabase.from('farm_houses').insert(initialHouses);
                    if (houseError) console.error("초기 동 생성 중 오류:", houseError);
                }

                alert("✅ 농장 등록 및 하우스 세팅이 완료되었습니다!");
                await initialize();
            }
        } catch (error: any) {
            console.error("데이터 저장 실패 상세 에러:", error);
            alert(`저장 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
        } finally {
            setSaving(false);
            console.log("--- handleSaveFarm 종료 ---");
        }
    };

    const addHouse = async () => {
        if (!newHouseNum.trim()) { alert("추가할 동 정보를 입력해주세요."); return; }
        if (!storeFarm?.id) return;

        let nums: number[] = [];
        const trimmed = newHouseNum.trim();

        // 1. 범위 처리 (예: 1-6)
        if (trimmed.includes('-')) {
            const parts = trimmed.split('-');
            const start = parseInt(parts[0]);
            const end = parseInt(parts[1]);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) nums.push(i);
            }
        }
        // 2. 단일 숫자 (스마트 처리)
        else {
            const n = parseInt(trimmed);
            if (!isNaN(n)) {
                // 현재 하우스가 0개인데 큰 숫자를 입력한 경우, 1~N까지 일괄 생성을 제안
                if (houses.length === 0 && n > 1) {
                    if (confirm(`${n}을 입력하셨습니다. 1동부터 ${n}동까지 총 ${n}개의 하우스를 한 번에 생성하시겠습니까?`)) {
                        for (let i = 1; i <= n; i++) nums.push(i);
                    } else {
                        nums = [n];
                    }
                } else {
                    nums = [n];
                }
            }
        }

        if (nums.length === 0) {
            alert("입력 형식이 올바르지 않습니다. (숫자 또는 1-6 형식을 사용하세요)");
            return;
        }

        // 중복 체크
        const existingNums = houses.map(h => h.house_number);
        const uniqueNewNums = nums.filter(num => !existingNums.includes(num));

        if (uniqueNewNums.length === 0) {
            alert("이미 등록된 하우스 번호입니다.");
            return;
        }

        const newHouses = uniqueNewNums.map(num => ({
            farm_id: storeFarm.id,
            house_number: num,
            house_name: `${num}동`,
            current_crop: '', // 기본값 비움 - 작물은 사용자가 설정에서 직접 입력
            is_active: true
        }));

        const { error } = await supabase.from('farm_houses').insert(newHouses);

        if (error) {
            alert(`동 추가 실패: ${error.message}`);
        } else {
            setNewHouseNum("");
            fetchHouses();
        }
    };

    const toggleHouse = async (id: string, isActive: boolean) => {
        await supabase.from('farm_houses').update({ is_active: !isActive }).eq('id', id);
        fetchHouses();
    };

    const deleteHouse = async (id: string) => {
        if (!confirm("해당 하우스 동을 정말 삭제하시겠습니까?")) return;
        await supabase.from('farm_houses').delete().eq('id', id);
        fetchHouses();
    };

    // ========================
    // [bkit 엔터프라이즈] 작물 관리 CRUD
    // ========================
    const fetchCrops = async () => {
        if (!storeFarm?.id) return;
        setLoadingCrops(true);
        const { data, error } = await supabase
            .from('farm_crops')
            .select('*')
            .eq('farm_id', storeFarm.id)
            .order('sort_order');
        if (error) console.error('작물 목록 로딩 실패:', error);
        setFarmCrops(data ?? []);
        setLoadingCrops(false);
    };

    const addCrop = async () => {
        if (!newCropName.trim() || !storeFarm?.id) return;
        const exists = farmCrops.some(c => c.crop_name === newCropName.trim());
        if (exists) { alert('이미 등록된 작물입니다.'); return; }

        const defaultUnits = newCropName.trim() === '딸기' ? ['박스', 'kg', '다라'] : ['kg', '박스', '포대'];
        const { error } = await supabase.from('farm_crops').insert({
            farm_id: storeFarm.id,
            crop_name: newCropName.trim(),
            crop_icon: newCropIcon,
            default_unit: defaultUnits[0],
            available_units: defaultUnits,
            sort_order: farmCrops.length,
        });
        if (error) { alert(`작물 추가 실패: ${error.message}`); return; }
        setNewCropName('');
        setNewCropIcon('🌱');
        fetchCrops();
    };

    const deleteCrop = async (id: string, name: string) => {
        if (!confirm(`"${name}" 작물을 삭제하시겠습니까? (기존 판매/수확 데이터는 유지됩니다)`)) return;
        await supabase.from('farm_crops').delete().eq('id', id);
        fetchCrops();
    };

    const addPresetCrops = async (presets: { name: string; icon: string; units: string[] }[]) => {
        if (!storeFarm?.id) return;
        const existing = farmCrops.map(c => c.crop_name);
        const newOnes = presets.filter(p => !existing.includes(p.name));
        if (newOnes.length === 0) { alert('모든 추천 작물이 이미 등록되어 있습니다.'); return; }
        const inserts = newOnes.map((p, i) => ({
            farm_id: storeFarm.id,
            crop_name: p.name,
            crop_icon: p.icon,
            default_unit: p.units[0],
            available_units: p.units,
            sort_order: farmCrops.length + i,
        }));
        const { error } = await supabase.from('farm_crops').insert(inserts);
        if (error) { alert(`프리셋 추가 실패: ${error.message}`); return; }
        fetchCrops();
    };

    // 추천 프리셋 목록
    const PRESETS = {
        '딸기 농장': [
            { name: '딸기', icon: '🍓', units: ['박스', 'kg', '다라'] },
        ],
        '채소 농장': [
            { name: '감자', icon: '🥔', units: ['kg', '포대', '박스'] },
            { name: '고구마', icon: '🍠', units: ['kg', '포대', '박스'] },
            { name: '상추', icon: '🥬', units: ['kg', '박스'] },
            { name: '고추', icon: '🌶️', units: ['kg', '근', '박스'] },
        ],
        '과일 농장': [
            { name: '참외', icon: '🍈', units: ['박스', 'kg', '개'] },
            { name: '멜론', icon: '🍈', units: ['박스', 'kg', '개'] },
            { name: '토마토', icon: '🍅', units: ['kg', '박스'] },
        ],
        '버섯/특수': [
            { name: '송이버섯', icon: '🍄', units: ['kg', '근', '박스'] },
            { name: '느타리', icon: '🍄', units: ['kg', '박스'] },
            { name: '두릉', icon: '🌱', units: ['kg', '근', '단'] },
        ],
    } as Record<string, { name: string; icon: string; units: string[] }[]>;


    const field = (label: string, key: keyof Farm, type = "text", placeholder = "") => (
        <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-500 ml-1">{label}</label>
            <input type={type} value={(farm[key] as string) ?? ""} placeholder={placeholder}
                onChange={(e) => {
                    let val = e.target.value;
                    if (key === 'phone' || key === 'fax') {
                        val = formatPhone(val);
                    }
                    if (key === 'business_number') {
                        val = formatBusinessNumber(val);
                    }
                    setFarm({ ...farm, [key]: val });
                }}
                className="w-full p-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-red-200 focus:ring-4 focus:ring-red-50/50 outline-none transition-all text-gray-900 shadow-sm" />
        </div>
    );

    if (!initialized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-10 h-10 border-4 border-red-100 border-t-red-600 rounded-full animate-spin"></div>
                <p className="text-gray-400 font-medium animate-pulse">농장 정보 로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 pb-32 max-w-2xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl shadow-lg shadow-red-200">
                        <Home className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">농장 설정</h1>
                        <p className="text-sm text-gray-400 font-medium">Farm Settings & Management</p>
                    </div>
                </div>
                {storeFarm?.id && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100 shadow-sm select-none">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Active</span>
                    </div>
                )}
            </div>

            {/* 신규 등록 안내 */}
            {!storeFarm?.id && (
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-2xl p-5 shadow-sm animate-bounce-subtle">
                    <div className="flex gap-3">
                        <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                        <div className="space-y-1">
                            <p className="font-bold text-amber-900">환영합니다! 농장을 먼저 등록해 주세요.</p>
                            <p className="text-sm text-amber-700 leading-relaxed">
                                농장 이름과 총 하우스 개수를 입력하면 즉시 관리가 시작됩니다.<br />
                                <span className="font-semibold underline">하우스 개수만큼 자동으로 1동, 2동... 등이 생성됩니다.</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 기본 정보 섹션 */}
            <section className="bg-white rounded-[2rem] shadow-xl shadow-gray-100/50 border border-gray-100 p-6 md:p-10 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-50/50 rounded-full -mr-16 -mt-16 blur-3xl"></div>

                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3 relative">
                    <span className="w-2 h-7 bg-red-500 rounded-full"></span>
                    기본 정보 {storeFarm?.id ? "업데이트" : "등록하기"}
                </h2>

                <div className="space-y-5 relative">
                    {field("농장 이름 (필수) *", "farm_name", "text", "예: 베리베리 스트로베리")}

                    {!storeFarm?.id && (
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-red-500 ml-1">초기 하우스 개수 설정</label>
                            <div className="relative group">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 transition-transform group-focus-within:scale-110">
                                    <LayoutGrid className="w-5 h-5 text-red-300" />
                                </div>
                                <input type="number" value={initialHouseCount} onChange={(e) => setInitialHouseCount(e.target.value)}
                                    placeholder="총 동 갯수 (예: 12)"
                                    className="w-full p-5 pl-14 bg-red-50/30 border-2 border-red-100 rounded-[1.25rem] focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none text-gray-900 font-black text-xl placeholder:text-red-200 transition-all shadow-inner" />
                            </div>
                            <p className="text-[11px] text-gray-400 mt-2 ml-1">해당 숫자만큼 동이 자동으로 생성됩니다. 나중에 추가/삭제도 가능해요!</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {field("농장 전화", "phone", "tel", "010-0000-0000")}
                        {field("팩스 번호", "fax", "tel", "055-000-0000")}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {field("대표 이메일", "email", "email", "contact@farm.com")}
                        {field("사업자 등록 번호", "business_number", "text", "000-00-00000")}
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-9">
                            <AddressSearch
                                label="배송/농장 주소"
                                value={farm.address || ""}
                                onChange={(val) => setFarm({ ...farm, address: val })}
                                onAddressSelect={(res) => setFarm({
                                    ...farm,
                                    address: res.address,
                                    postal_code: res.zonecode
                                })}
                                placeholder="도로명 주소를 입력하세요"
                            />
                        </div>
                        <div className="col-span-3 space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight ml-1">우편번호</label>
                            <input value={farm.postal_code || ""}
                                onChange={(e) => setFarm({ ...farm, postal_code: e.target.value })}
                                className="w-full py-5 px-1 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:bg-white focus:border-red-200 outline-none text-center font-bold text-sm" placeholder="00000" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-semibold text-gray-500 ml-1">농장 운영 메모</label>
                        <textarea value={farm.notes ?? ""} onChange={(e) => setFarm({ ...farm, notes: e.target.value })}
                            placeholder="메모하고 싶은 사항 (영업시간, 주력 품종 등)"
                            className="w-full p-5 bg-gray-50 border border-transparent rounded-[1.5rem] focus:bg-white focus:border-red-200 focus:ring-4 focus:ring-red-50/50 outline-none h-40 text-gray-900 transition-all resize-none shadow-sm" />
                    </div>
                </div>

                <button onClick={handleSaveFarm} disabled={saving}
                    className="w-full h-16 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-[1.25rem] font-bold text-xl hover:from-red-700 hover:to-rose-700 active:scale-[0.98] transition-all shadow-xl shadow-red-200/60 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 relative group">
                    <Save className={`w-6 h-6 ${saving ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'}`} />
                    <span>{saving ? "저장 처리 중..." : storeFarm?.id ? "수정 사항 저장하기" : "농장 시작하기"}</span>
                </button>
            </section>

            {/* [bkit 엔터프라이즈] 재배 작물 관리 섹션 */}
            {storeFarm?.id && (
                <section className="bg-white rounded-[2rem] shadow-xl shadow-gray-100/30 border border-gray-100 p-6 md:p-10 space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                            <span className="w-2 h-7 bg-green-400 rounded-full"></span>
                            재배 작물 관리
                        </h2>
                        <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold">
                            {farmCrops.length}개 등록
                        </span>
                    </div>

                    {/* 작물 추가 입력 */}
                    <div className="flex gap-3">
                        <div className="relative flex-1 group">
                            <Sprout className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-300 group-focus-within:text-green-500 transition-colors" />
                            <input type="text" value={newCropName}
                                onChange={(e) => setNewCropName(e.target.value)}
                                placeholder="작물명 입력 (예: 딸기, 송이버섯, 참외...)"
                                onKeyDown={(e) => e.key === 'Enter' && addCrop()}
                                className="w-full p-4 pl-12 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-green-200 focus:ring-4 focus:ring-green-50/50 outline-none transition-all shadow-inner" />
                        </div>
                        <select value={newCropIcon} onChange={(e) => setNewCropIcon(e.target.value)}
                            className="w-16 text-center text-2xl bg-gray-50 border border-transparent rounded-2xl focus:border-green-200 outline-none cursor-pointer">
                            <option value="🍓">🍓</option>
                            <option value="🥔">🥔</option>
                            <option value="🍠">🍠</option>
                            <option value="🍈">🍈</option>
                            <option value="🍅">🍅</option>
                            <option value="🍄">🍄</option>
                            <option value="🥬">🥬</option>
                            <option value="🌶️">🌶️</option>
                            <option value="🥒">🥒</option>
                            <option value="🌱">🌱</option>
                            <option value="📦">📦</option>
                        </select>
                        <button onClick={addCrop}
                            className="bg-green-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-100 flex items-center gap-2 shrink-0">
                            <Plus className="w-5 h-5" />
                            <span>추가</span>
                        </button>
                    </div>

                    {/* 추천 프리셋 버튼 */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">한국 농장 프리셋 (클릭하면 자동 추가)</p>
                        <div className="flex gap-2 flex-wrap">
                            {Object.entries(PRESETS).map(([label, crops]) => (
                                <button key={label} onClick={() => addPresetCrops([...crops])}
                                    className="px-4 py-2.5 bg-gray-50 hover:bg-green-50 border border-gray-100 hover:border-green-200 rounded-xl text-xs font-bold text-gray-500 hover:text-green-600 transition-all">
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 등록된 작물 목록 */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {loadingCrops ? (
                            <div className="col-span-full py-10 text-center text-gray-300">작물 목록 로딩 중...</div>
                        ) : farmCrops.length === 0 ? (
                            <div className="col-span-full text-center py-16 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100">
                                <Sprout className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                <p className="text-gray-400 font-medium">등록된 작물이 없습니다.<br />
                                    <span className="text-xs text-gray-300">위의 프리셋 버튼을 누르거나 직접 입력해 주세요!</span>
                                </p>
                            </div>
                        ) : (
                            farmCrops.map((crop) => (
                                <div key={crop.id}
                                    className="group flex flex-col items-center justify-center p-5 rounded-[1.5rem] border-2 bg-white border-green-50 shadow-sm hover:shadow-green-100/50 hover:border-green-200 transition-all relative">
                                    <button onClick={() => deleteCrop(crop.id, crop.crop_name)}
                                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-all p-1.5 opacity-0 group-hover:opacity-100 scale-75 hover:scale-100">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <span className="text-3xl mb-1">{crop.crop_icon}</span>
                                    <span className="text-sm font-black text-gray-800">{crop.crop_name}</span>
                                    <span className="text-[9px] text-gray-400 font-bold mt-0.5">
                                        {crop.available_units?.join(' · ') || crop.default_unit}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            )}

            {/* 하우스 동 관리 섹션 (등록 후 노출) */}
            {storeFarm?.id && (
                <section className="bg-white rounded-[2rem] shadow-xl shadow-gray-100/30 border border-gray-100 p-6 md:p-10 space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                            <span className="w-2 h-7 bg-red-400 rounded-full"></span>
                            하우스 동 설정
                        </h2>
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">Total: {houses.length}</span>
                    </div>

                    {/* 개별 추가 컨트롤 */}
                    <div className="flex gap-3">
                        <div className="relative flex-1 group">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-red-400 transition-colors" />
                            <input type="text" value={newHouseNum} onChange={(e) => setNewHouseNum(e.target.value)}
                                placeholder="예: 6 (또는 1-12 범위)"
                                className="w-full p-4 pl-12 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-red-200 focus:ring-4 focus:ring-red-50/50 outline-none transition-all shadow-inner" />
                        </div>
                        <button onClick={addHouse}
                            className="bg-red-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-100 flex items-center gap-2 shrink-0">
                            <Plus className="w-5 h-5" />
                            <span>추가</span>
                        </button>
                    </div>

                    {/* 하우스 동 목록 - 작물 드롭다운 선택 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {loadingHouses ? (
                            <div className="col-span-full py-16 text-center text-gray-300 font-medium">하우스 목록 불러오는 중...</div>
                        ) : (
                            houses.map((h) => {
                                const cropInfo = farmCrops.find(c => c.crop_name === h.current_crop);
                                return (
                                    <div key={h.id}
                                        className={`group flex flex-col items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all relative ${h.is_active ? 'bg-white border-red-50 shadow-md hover:shadow-red-100/50 hover:border-red-200' : 'bg-gray-50 border-transparent opacity-50 grayscale'}`}>

                                        <button onClick={() => deleteHouse(h.id)}
                                            className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-all p-1.5 opacity-0 group-hover:opacity-100 scale-75 hover:scale-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>

                                        <div className="flex flex-col items-center gap-2 w-full">
                                            {/* 작물 아이콘 (선택된 작물이 있으면 해당 아이콘, 없으면 하우스 아이콘) */}
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${h.is_active ? (cropInfo ? 'bg-green-50' : 'bg-red-50 text-red-600') : 'bg-gray-200 text-gray-400'}`}
                                                onClick={() => toggleHouse(h.id, h.is_active)}>
                                                {cropInfo ? (
                                                    <span className="text-2xl">{cropInfo.crop_icon}</span>
                                                ) : (
                                                    <Building2 className="w-6 h-6" />
                                                )}
                                            </div>

                                            {/* 동 번호 */}
                                            <span className={`text-xl font-black ${h.is_active ? 'text-gray-900' : 'text-gray-400'}`}>{h.house_number}동</span>

                                            {/* 작물 선택 드롭다운 */}
                                            <select
                                                value={h.current_crop || ""}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={async (e) => {
                                                    const val = e.target.value;
                                                    const updated = houses.map(item => item.id === h.id ? { ...item, current_crop: val } : item);
                                                    setHouses(updated);
                                                    await supabase.from('farm_houses').update({ current_crop: val }).eq('id', h.id);
                                                }}
                                                className={`w-full text-center text-[11px] font-black py-2 px-1 rounded-xl border-2 outline-none cursor-pointer transition-all appearance-none
                                                ${h.current_crop
                                                        ? 'bg-green-50 border-green-200 text-green-700'
                                                        : 'bg-yellow-50 border-yellow-200 text-yellow-600 animate-pulse'}`}
                                            >
                                                <option value="">-- 작물 선택 --</option>
                                                {farmCrops.map(crop => (
                                                    <option key={crop.id} value={crop.crop_name}>
                                                        {crop.crop_icon} {crop.crop_name}
                                                    </option>
                                                ))}
                                                <option value="휴작중">💤 휴작중</option>
                                            </select>

                                            {/* 상태 배지 */}
                                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-tighter cursor-pointer ${h.is_active ? 'bg-red-500 text-white shadow-sm shadow-red-200' : 'bg-gray-300 text-gray-500'}`}
                                                onClick={() => toggleHouse(h.id, h.is_active)}>
                                                {h.is_active ? 'Active' : 'Hidden'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {!loadingHouses && houses.length === 0 && (
                        <div className="text-center py-20 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100">
                            <LayoutGrid className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-400 font-medium">등록된 하우스가 없습니다.<br /><span className="text-xs text-gray-300">위의 입력창에서 동을 추가해보세요!</span></p>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
