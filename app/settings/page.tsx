"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, Home, LayoutGrid, AlertCircle, Building2, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, Farm, FarmHouse } from "@/lib/supabase";

export default function SettingsPage() {
    const { user, farm: storeFarm, profile, initialize, initialized } = useAuthStore();
    const [farm, setFarm] = useState<Partial<Farm>>({});
    const [houses, setHouses] = useState<FarmHouse[]>([]);
    const [newHouseNum, setNewHouseNum] = useState("");
    const [initialHouseCount, setInitialHouseCount] = useState("");
    const [saving, setSaving] = useState(false);
    const [loadingHouses, setLoadingHouses] = useState(false);

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
        } else {
            setFarm({});
            setHouses([]);
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
                const { error } = await supabase.from('farms').update({
                    farm_name: farm.farm_name,
                    phone: farm.phone,
                    fax: farm.fax,
                    email: farm.email,
                    address: farm.address,
                    business_number: farm.business_number,
                    notes: farm.notes,
                }).eq('id', storeFarm.id);

                if (error) throw error;
                alert("✅ 농장 정보가 성공적으로 수정되었습니다!");
                await initialize();
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
        const num = parseInt(newHouseNum);
        if (!num || isNaN(num)) { alert("추가할 동 번호를 입력해주세요."); return; }
        if (!storeFarm?.id) return;

        const { error } = await supabase.from('farm_houses').insert({
            farm_id: storeFarm.id,
            house_number: num,
            house_name: `${num}동`,
            is_active: true
        });

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

    // 전화번호/팩스 자동 포맷팅 함수
    const formatPhoneNumber = (value: string) => {
        const numbers = value.replace(/[^\d]/g, '');
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    };

    const field = (label: string, key: keyof Farm, type = "text", placeholder = "") => (
        <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-500 ml-1">{label}</label>
            <input type={type} value={(farm[key] as string) ?? ""} placeholder={placeholder}
                onChange={(e) => {
                    let val = e.target.value;
                    if (key === 'phone' || key === 'fax') {
                        val = formatPhoneNumber(val);
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

                    {field("배송/농장 주소", "address", "text", "도로명 주소를 입력하세요")}

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
                            <input type="number" value={newHouseNum} onChange={(e) => setNewHouseNum(e.target.value)}
                                placeholder="추가할 동 번호 (예: 13)"
                                className="w-full p-4 pl-12 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-red-200 focus:ring-4 focus:ring-red-50/50 outline-none transition-all shadow-inner" />
                        </div>
                        <button onClick={addHouse}
                            className="bg-red-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-100 flex items-center gap-2 shrink-0">
                            <Plus className="w-5 h-5" />
                            <span>추가</span>
                        </button>
                    </div>

                    {/* 목록 가로 스크롤 또는 그리드 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {loadingHouses ? (
                            <div className="col-span-full py-16 text-center text-gray-300 font-medium">Updating list...</div>
                        ) : (
                            houses.map((h) => (
                                <div key={h.id}
                                    className={`group flex flex-col items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all relative ${h.is_active ? 'bg-white border-red-50 shadow-md hover:shadow-red-100/50 hover:border-red-200' : 'bg-gray-50 border-transparent opacity-50 grayscale'}`}>

                                    <button onClick={() => deleteHouse(h.id)}
                                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-all p-1.5 opacity-0 group-hover:opacity-100 scale-75 hover:scale-100">
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    <div className="flex flex-col items-center gap-1 cursor-pointer select-none" onClick={() => toggleHouse(h.id, h.is_active)}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-colors ${h.is_active ? 'bg-red-50 text-red-600' : 'bg-gray-200 text-gray-400'}`}>
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <span className={`text-xl font-black ${h.is_active ? 'text-gray-900' : 'text-gray-400'}`}>{h.house_number}동</span>
                                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-tighter ${h.is_active ? 'bg-red-500 text-white shadow-sm shadow-red-200' : 'bg-gray-300 text-gray-500'}`}>
                                            {h.is_active ? 'Active' : 'Hidden'}
                                        </span>
                                    </div>
                                </div>
                            ))
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
