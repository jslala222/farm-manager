"use client";

import { useState, useEffect, useCallback } from "react";
import { PackageCheck, RefreshCcw, Plus, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Factory, X, RotateCcw, SmilePlus, ClipboardList } from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { useAuthStore } from "@/store/authStore";
import { supabase, FarmCrop, ProcessingRecord } from "@/lib/supabase";
import { fetchStockMap, StockMap, fetchGradeStockMap, GradeStockMap } from "@/hooks/useInventory";
import { formatKSTDate, getNowKST, toKSTDateString } from "@/lib/utils";
import { toast } from "sonner";

const ADJUSTMENT_TYPES = [
    { value: "waste", label: "🗑️ 폐기/손실", color: "red", desc: "부패·냉해·파손 등 — 자동 차감" },
    { value: "return", label: "🔄 반품 입고", color: "green", desc: "택배·납품 반품 재입고 — 자동 증가" },
    { value: "harvest_fix", label: "🌾 수확 누락 보정", color: "blue", desc: "수확 기록 누락/오입력 차이분 보정 (+/−)" },
    { value: "correction", label: "✏️ 실물 재고 맞추기", color: "gray", desc: "실물 확인 후 시스템 수량 일치 (+/−)" },
] as const;

// 가공품 아이콘 목록
const PROCESSED_ICONS = ["🎁", "📦", "🍯", "🥤", "💨", "🍂", "🍪", "🧁", "🛍️", "🎀"] as const;

type AdjType = typeof ADJUSTMENT_TYPES[number]["value"];
type InventoryAdjustment = {
    id: string;
    crop_name: string;
    quantity: number;
    adjustment_type: AdjType | string;
    reason?: string | null;
    adjusted_at?: string;
    processing_record_id?: string | null;
};
type ProcInput = { crop_name: string; quantity: string; unit: string };

export default function InventoryPage() {
    const { farm, initialized, initialize, cropIconMap, refreshCropIconMap } = useAuthStore();
    const [stockMap, setStockMap] = useState<StockMap>({});
    const [farmCrops, setFarmCrops] = useState<FarmCrop[]>([]);
    const [loading, setLoading] = useState(false);
    const [inventoryFilter, setInventoryFilter] = useState<"all" | "crop" | "processed" | "low">("all");
    const [showDisabledItems, setShowDisabledItems] = useState(false);
    const [showQuickAddForm, setShowQuickAddForm] = useState(false);
    const [quickName, setQuickName] = useState("");
    const [quickIcon, setQuickIcon] = useState("🎁");
    const [quickUnit, setQuickUnit] = useState("개");
    const [quickQty, setQuickQty] = useState("");
    const [quickSaving, setQuickSaving] = useState(false);
    const [showQuickIconPicker, setShowQuickIconPicker] = useState(false);

    // 조정 입력 상태
    const [showAdjForm, setShowAdjForm] = useState(false);
    const [adjCrop, setAdjCrop] = useState("");
    const [adjType, setAdjType] = useState<AdjType>("waste");
    const [adjQty, setAdjQty] = useState("");
    const [adjGrade, setAdjGrade] = useState(""); // 원물 등급 (sang/jung/ha)
    const [adjReason, setAdjReason] = useState("");
    const [adjSaving, setAdjSaving] = useState(false);

    // 조정 이력
    const [adjHistory, setAdjHistory] = useState<InventoryAdjustment[]>([]);

    // 가공 처리 모달
    const [showProcessForm, setShowProcessForm] = useState(false);
    const [procDate, setProcDate] = useState(toKSTDateString());
    const [procOutputCrop, setProcOutputCrop] = useState("");
    const [procOutputIcon, setProcOutputIcon] = useState("🎁");
    const [procOutputQty, setProcOutputQty] = useState("");
    const [procOutputUnit, setProcOutputUnit] = useState("개");
    const [procMemo, setProcMemo] = useState("");
    const [procInputs, setProcInputs] = useState<ProcInput[]>([
        { crop_name: "", quantity: "", unit: "kg" }
    ]);
    const [procSaving, setProcSaving] = useState(false);
    const [procCancelId, setProcCancelId] = useState<string | null>(null);
    const [showProcIconPicker, setShowProcIconPicker] = useState(false);

    // 가공품 수정 상태
    const [showEditCropForm, setShowEditCropForm] = useState(false);
    const [editingCrop, setEditingCrop] = useState<FarmCrop | null>(null);
    const [editingCropName, setEditingCropName] = useState("");
    const [editingCropIcon, setEditingCropIcon] = useState("🎁");
    const [editingUnit, setEditingUnit] = useState("개");
    const [editingSaving, setEditingSaving] = useState(false);
    const [showEditIconPicker, setShowEditIconPicker] = useState(false);
    const [editingCropDeleting, setEditingCropDeleting] = useState(false);
    const [editingCropRecordCount, setEditingCropRecordCount] = useState(0);

    // 가공 이력
    const [processingHistory, setProcessingHistory] = useState<ProcessingRecord[]>([]);

    // 초기재고 설정 모달
    const [showInitStockForm, setShowInitStockForm] = useState(false);
    // 원물 등급별 초기재고 입력값: { [cropName]: { sang, jung, ha } }
    const [initRawEntries, setInitRawEntries] = useState<Record<string, { sang: string; jung: string; ha: string }>>({});
    // 가공품 초기재고 입력값: { [cropName]: qty }
    const [initProcEntries, setInitProcEntries] = useState<Record<string, string>>({});
    const [initSaving, setInitSaving] = useState(false);

    // 등급별 재고 현황 (원물 전용)
    const [gradeStockMap, setGradeStockMap] = useState<GradeStockMap>({});
    const nowKSTTimestamp = () => formatKSTDate(getNowKST());

    useEffect(() => {
        if (!initialized) initialize();
    }, [initialize, initialized]);

    const loadAll = useCallback(async () => {
        if (!farm?.id) return;
        setLoading(true);
        try {
            const [stock, gradeStock, cropsRes, histRes, procRes] = await Promise.all([
                fetchStockMap(farm.id),
                fetchGradeStockMap(farm.id),
                supabase.from("farm_crops").select("*").eq("farm_id", farm.id).order("sort_order"),
                supabase.from("inventory_adjustments").select("*").eq("farm_id", farm.id).order("adjusted_at", { ascending: false }).limit(30),
                supabase.from("processing_records").select("*").eq("farm_id", farm.id).order("processed_date", { ascending: false }).limit(20),
            ]);
            setStockMap(stock);
            setGradeStockMap(gradeStock);
            setFarmCrops(cropsRes.data ?? []);
            setAdjHistory(histRes.data ?? []);
            setProcessingHistory(procRes.data ?? []);
        } finally {
            setLoading(false);
        }
    }, [farm?.id]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handleQuickAddProcessed = async () => {
        if (!farm?.id || !quickName.trim()) {
            toast.error("가공품명은 필수입니다.");
            return;
        }

        const trimmedName = quickName.trim();
        const trimmedUnit = quickUnit.trim() || "개";
        const initialQty = quickQty.trim() ? Number(quickQty) : 0;

        if (quickQty.trim() && (!Number.isFinite(initialQty) || initialQty < 0)) {
            toast.error("초기 수량은 0 이상의 숫자로 입력해주세요.");
            return;
        }

        const exists = farmCrops.some((crop) => crop.crop_name === trimmedName);
        if (exists) {
            toast.error("이미 등록된 품목입니다.");
            return;
        }

        setQuickSaving(true);
        try {
            const { error: cropError } = await supabase.from("farm_crops").insert({
                farm_id: farm.id,
                crop_name: trimmedName,
                crop_icon: quickIcon,
                default_unit: trimmedUnit,
                available_units: [trimmedUnit],
                sort_order: farmCrops.length,
                is_temporary: true,
                category: "processed",
            });
            if (cropError) throw cropError;

            if (initialQty > 0) {
                const { error: adjustError } = await supabase.from("inventory_adjustments").insert({
                    farm_id: farm.id,
                    crop_name: trimmedName,
                    quantity: initialQty,
                    adjustment_type: "initial",
                    reason: "가공품 빠른 추가 초기재고",
                    adjusted_at: nowKSTTimestamp(),
                });
                if (adjustError) throw adjustError;
            }

            toast.success("가공품이 추가되었습니다.");
            setQuickName("");
            setQuickIcon("🎁");
            setQuickUnit("개");
            setQuickQty("");
            setShowQuickAddForm(false);
            loadAll();
            refreshCropIconMap();
        } catch (e) {
            toast.error("가공품 추가 실패: " + ((e as Error).message || "알 수 없는 오류"));
        } finally {
            setQuickSaving(false);
        }
    };

    // ── 가공 처리 저장 ──────────────────────────────────
    const handleProcessSave = async () => {
        if (!farm?.id) return;
        if (!procOutputCrop.trim()) { toast.error("산출 가공품명을 입력해주세요."); return; }
        const outQty = Number(procOutputQty);
        if (!procOutputQty || isNaN(outQty) || outQty <= 0) { toast.error("산출 수량을 입력해주세요."); return; }
        const validInputs = procInputs.filter(i => i.crop_name && i.quantity && Number(i.quantity) > 0);
        if (validInputs.length === 0) { toast.error("투입 원물을 최소 1개 입력해주세요."); return; }

        setProcSaving(true);
        try {
            // 1. 산출 가공품 확인/등록 + ID 획득 (FK 참조용)
            const existing = farmCrops.find(c => c.crop_name === procOutputCrop.trim());
            let outputCropId: string;
            if (existing) {
                outputCropId = existing.id;
            } else {
                const { data: cropData, error: cropErr } = await supabase.from("farm_crops").insert({
                    farm_id: farm.id,
                    crop_name: procOutputCrop.trim(),
                    crop_icon: procOutputIcon,
                    default_unit: procOutputUnit,
                    available_units: [procOutputUnit],
                    sort_order: farmCrops.length,
                    is_temporary: true,
                    category: "processed",
                }).select("id").single();
                if (cropErr) throw cropErr;
                outputCropId = cropData!.id;
            }

            // 2. processing_records INSERT (output_crop_id FK 포함)
            const { data: procData, error: procErr } = await supabase
                .from("processing_records")
                .insert({
                    farm_id: farm.id,
                    processed_date: procDate,
                    output_crop_id: outputCropId,
                    output_crop_name: procOutputCrop.trim(),
                    output_quantity: outQty,
                    output_unit: procOutputUnit,
                    inputs: validInputs.map(i => ({ crop_name: i.crop_name, quantity: Number(i.quantity), unit: i.unit })),
                    memo: procMemo.trim() || null,
                    is_cancelled: false,
                })
                .select()
                .single();
            if (procErr) throw procErr;
            const procId = procData.id;

            // 3. inventory_adjustments 일괄 INSERT (투입 원물 차감 + 산출품 증가)
            const adjRows = [
                // 산출 가공품 증가
                {
                    farm_id: farm.id,
                    crop_name: procOutputCrop.trim(),
                    quantity: outQty,
                    adjustment_type: "process_in",
                    reason: `가공 처리 산출 (${validInputs.map(i => i.crop_name).join(', ')})`,
                    adjusted_at: nowKSTTimestamp(),
                    processing_record_id: procId,
                },
                // 투입 원물 차감
                ...validInputs.map(i => ({
                    farm_id: farm.id,
                    crop_name: i.crop_name,
                    quantity: -Math.abs(Number(i.quantity)),
                    adjustment_type: "process_out",
                    reason: `가공 처리 투입 → ${procOutputCrop.trim()}`,
                    adjusted_at: nowKSTTimestamp(),
                    processing_record_id: procId,
                })),
            ];
            const { error: adjErr } = await supabase.from("inventory_adjustments").insert(adjRows);
            if (adjErr) throw adjErr;

            toast.success("가공 처리가 기록되었습니다.");
            setProcOutputCrop(""); setProcOutputIcon("🎁"); setProcOutputQty(""); setProcOutputUnit("개");
            setProcMemo(""); setProcDate(toKSTDateString());
            setProcInputs([{ crop_name: "", quantity: "", unit: "kg" }]);
            setShowProcessForm(false);
            loadAll();
        } catch (e) {
            toast.error("저장 실패: " + ((e as Error).message || "알 수 없는 오류"));
        } finally {
            setProcSaving(false);
        }
    };

    // ── 가공 처리 취소(롤백) ─────────────────────────────
    const handleProcessCancel = async (rec: ProcessingRecord) => {
        if (!farm?.id || procCancelId === rec.id) return;
        if (!confirm(`"${rec.output_crop_name}" 가공 처리를 취소하면 재고가 원복됩니다. 계속할까요?`)) return;
        setProcCancelId(rec.id);
        try {
            // 1. processing_records 취소 처리
            const { error: cancelErr } = await supabase
                .from("processing_records")
                .update({ is_cancelled: true, cancelled_at: nowKSTTimestamp() })
                .eq("id", rec.id);
            if (cancelErr) throw cancelErr;

            // 2. 역방향 inventory_adjustments INSERT (부호 반전)
            const inputs = rec.inputs as { crop_name: string; quantity: number; unit: string }[];
            const reverseRows = [
                // 산출 가공품 원복 차감
                {
                    farm_id: farm.id,
                    crop_name: rec.output_crop_name,
                    quantity: -Math.abs(rec.output_quantity),
                    adjustment_type: "correction",
                    reason: `가공 취소 원복 (${rec.processed_date})`,
                    adjusted_at: nowKSTTimestamp(),
                    processing_record_id: rec.id,
                },
                // 투입 원물 원복 증가
                ...inputs.map(i => ({
                    farm_id: farm.id,
                    crop_name: i.crop_name,
                    quantity: Math.abs(i.quantity),
                    adjustment_type: "correction",
                    reason: `가공 취소 원복 → ${rec.output_crop_name} (${rec.processed_date})`,
                    adjusted_at: nowKSTTimestamp(),
                    processing_record_id: rec.id,
                })),
            ];
            const { error: revErr } = await supabase.from("inventory_adjustments").insert(reverseRows);
            if (revErr) throw revErr;

            toast.success("가공 처리가 취소되어 재고가 원복되었습니다.");
            loadAll();
        } catch (e) {
            toast.error("취소 실패: " + ((e as Error).message || "알 수 없는 오류"));
        } finally {
            setProcCancelId(null);
        }
    };

    // ── 가공품 수정 ──────────────────────────────────
    const handleOpenEditCrop = async (crop: FarmCrop) => {
        setEditingCrop(crop);
        setEditingCropName(crop.crop_name);
        setEditingCropIcon(crop.crop_icon);
        setEditingUnit(crop.default_unit || "개");
        setShowEditCropForm(true);

        // 거래 기록 개수 미리 계산
        if (farm?.id) {
            const [adjRes, procRes] = await Promise.all([
                supabase
                    .from("inventory_adjustments")
                    .select("id", { count: "exact" })
                    .eq("farm_id", farm.id)
                    .eq("crop_name", crop.crop_name),
                supabase
                    .from("processing_records")
                    .select("id", { count: "exact" })
                    .eq("farm_id", farm.id)
                    .eq("output_crop_name", crop.crop_name),
            ]);
            const totalCount = (adjRes.count ?? 0) + (procRes.count ?? 0);
            setEditingCropRecordCount(totalCount);
        }
    };

    const handleSaveEditCrop = async () => {
        if (!farm?.id || !editingCrop) return;
        if (!editingCropName.trim()) {
            toast.error("가공품명은 필수입니다.");
            return;
        }

        setEditingSaving(true);
        try {
            const { error } = await supabase
                .from("farm_crops")
                .update({
                    crop_name: editingCropName.trim(),
                    crop_icon: editingCropIcon,
                    default_unit: editingUnit,
                    available_units: [editingUnit],
                })
                .eq("id", editingCrop.id);

            if (error) throw error;

            toast.success("가공품이 수정되었습니다.");
            setShowEditCropForm(false);
            setEditingCrop(null);
            loadAll();
            refreshCropIconMap();
        } catch (e) {
            toast.error("수정 실패: " + ((e as Error).message || "알 수 없는 오류"));
        } finally {
            setEditingSaving(false);
        }
    };

    // ── 가공품 삭제/비활성화 ──────────────────────────────────
    const handleDeleteCrop = async () => {
        if (!farm?.id || !editingCrop) return;

        // 비활성화된 상품을 다시 활성화하는 경우
        if (editingCrop.is_active === false) {
            setEditingCropDeleting(true);
            try {
                const { error } = await supabase
                    .from("farm_crops")
                    .update({ is_active: true })
                    .eq("id", editingCrop.id);
                if (error) throw error;
                toast.success(`[${editingCrop.crop_name}]이(가) 다시 활성화되었습니다.`);
                setShowEditCropForm(false);
                setEditingCrop(null);
                loadAll();
                refreshCropIconMap();
            } catch (e) {
                toast.error("복구 실패: " + ((e as Error).message || "알 수 없는 오류"));
            } finally {
                setEditingCropDeleting(false);
            }
            return;
        }

        // 참조 무결성 확인: 이 품목을 사용하는 기록들
        const [adjRes, procRes] = await Promise.all([
            supabase
                .from("inventory_adjustments")
                .select("id", { count: "exact" })
                .eq("farm_id", farm.id)
                .eq("crop_name", editingCrop.crop_name),
            supabase
                .from("processing_records")
                .select("id", { count: "exact" })
                .eq("farm_id", farm.id)
                .eq("output_crop_name", editingCrop.crop_name),
        ]);

        const adjCount = adjRes.count ?? 0;
        const procCount = procRes.count ?? 0;
        const totalCount = adjCount + procCount;

        setEditingCropDeleting(true);
        try {
            if (totalCount > 0) {
                // 거래 기록이 있으면: 비활성화 (is_active = false)
                const { error } = await supabase
                    .from("farm_crops")
                    .update({ is_active: false })
                    .eq("id", editingCrop.id);

                if (error) throw error;

                toast.success(
                    `[${editingCrop.crop_name}]이(가) 판매 중지 상태로 변경되었습니다.\n` +
                    `(${totalCount}개의 거래 기록이 있어 완전 삭제되지 않았습니다)`
                );
            } else {
                // 거래 기록이 없으면: 완전 삭제
                if (!confirm(`[${editingCrop.crop_name}]을(를) 정말 삭제하시겠습니까?\n거래 기록이 없으므로 완전히 삭제됩니다.`)) {
                    setEditingCropDeleting(false);
                    return;
                }

                const { error } = await supabase
                    .from("farm_crops")
                    .delete()
                    .eq("id", editingCrop.id);

                if (error) throw error;

                toast.success(`[${editingCrop.crop_name}]이(가) 완전히 삭제되었습니다.`);
            }

            setShowEditCropForm(false);
            setEditingCrop(null);
            loadAll();
            refreshCropIconMap();
        } catch (e) {
            toast.error("처리 실패: " + ((e as Error).message || "알 수 없는 오류"));
        } finally {
            setEditingCropDeleting(false);
        }
    };

    // ── 초기재고 설정 저장 ─────────────────────────────
    const handleInitStockSave = async () => {
        if (!farm?.id) return;

        // 저장할 항목 수집
        const rows: object[] = [];

        // 원물: 等급별 저장
        const rawCrops = farmCrops.filter(c => (c.category ?? "crop") !== "processed");
        for (const crop of rawCrops) {
            const entry = initRawEntries[crop.crop_name];
            if (!entry) continue;
            const grades: ["sang" | "jung" | "ha", string][] = [
                ["sang", entry.sang ?? ""],
                ["jung", entry.jung ?? ""],
                ["ha", entry.ha ?? ""],
            ];
            for (const [grade, val] of grades) {
                const qty = Number(val);
                if (!val || !Number.isFinite(qty)) continue;
                rows.push({
                    farm_id: farm.id,
                    crop_name: crop.crop_name,
                    quantity: qty,
                    grade,
                    adjustment_type: "initial",
                    reason: `초기재고 직접입력 (${grade === "sang" ? "상" : grade === "jung" ? "중" : "하"})`,
                    adjusted_at: nowKSTTimestamp(),
                });
            }
        }

        // 가공품: 수량만 저장
        const procCrops = farmCrops.filter(c => c.category === "processed");
        for (const crop of procCrops) {
            const val = initProcEntries[crop.crop_name] ?? "";
            const qty = Number(val);
            if (!val || !Number.isFinite(qty)) continue;
            rows.push({
                farm_id: farm.id,
                crop_name: crop.crop_name,
                quantity: qty,
                grade: null,
                adjustment_type: "initial",
                reason: "초기재고 직접입력 (가공품)",
                adjusted_at: nowKSTTimestamp(),
            });
        }

        if (rows.length === 0) {
            toast.error("입력된 수량이 없습니다. 최소 1개 이상 입력해주세요.");
            return;
        }

        setInitSaving(true);
        try {
            // 입력된 항목과 같은 crop/grade의 기존 initial 레코드는 먼저 삭제해 중복 누적을 막는다.
            const { data: prevInitialRows, error: prevInitialError } = await supabase
                .from("inventory_adjustments")
                .select("id, crop_name, grade")
                .eq("farm_id", farm.id)
                .eq("adjustment_type", "initial");
            if (prevInitialError) throw prevInitialError;

            const nextKeySet = new Set(
                rows.map((r: any) => `${r.crop_name}::${r.grade ?? "__NULL__"}`)
            );
            const deleteIds = (prevInitialRows ?? [])
                .filter((r) => nextKeySet.has(`${r.crop_name}::${r.grade ?? "__NULL__"}`))
                .map((r) => r.id);

            if (deleteIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from("inventory_adjustments")
                    .delete()
                    .in("id", deleteIds);
                if (deleteError) throw deleteError;
            }

            const { error } = await supabase.from("inventory_adjustments").insert(rows);
            if (error) throw error;
            toast.success(`초기재고 ${rows.length}건이 저장되었습니다.`);
            setInitRawEntries({});
            setInitProcEntries({});
            setShowInitStockForm(false);
            loadAll();
        } catch (e) {
            toast.error("저장 실패: " + ((e as Error).message || "알 수 없는 오류"));
        } finally {
            setInitSaving(false);
        }
    };

    const handleAdjSave = async () => {
        if (!farm?.id || !adjCrop || !adjQty) {
            toast.error("품목과 수량을 입력해주세요.");
            return;
        }
        const rawQty = Number(adjQty);
        if (isNaN(rawQty) || rawQty === 0) {
            toast.error("수량은 0이 아닌 숫자로 입력해주세요.");
            return;
        }
        // waste는 자동 차감, 나머지는 사용자가 입력한 부호 그대로
        const finalQty = adjType === "waste" ? -Math.abs(rawQty) : rawQty;

        // 원물인 경우 등급 필수
        const adjCropObj = farmCrops.find(c => c.crop_name === adjCrop);
        const isRawCrop = adjCropObj?.category !== 'processed';
        if (isRawCrop && !adjGrade) {
            toast.error("원물은 등급을 선택해주세요.");
            return;
        }

        setAdjSaving(true);
        try {
            const { error } = await supabase.from("inventory_adjustments").insert({
                farm_id: farm.id,
                crop_name: adjCrop,
                quantity: finalQty,
                grade: isRawCrop ? adjGrade : null,
                adjustment_type: adjType,
                reason: adjReason || null,
                adjusted_at: nowKSTTimestamp(),
            });
            if (error) throw error;
            toast.success("재고 조정이 저장되었습니다.");
            setAdjQty("");
            setAdjGrade("");
            setAdjReason("");
            setShowAdjForm(false);
            loadAll();
        } catch (e) {
            toast.error("저장 실패: " + ((e as Error).message || "알 수 없는 오류"));
        } finally {
            setAdjSaving(false);
        }
    };

    if (!initialized) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!farm?.inventory_enabled) {
        return (
            <div className="p-6 max-w-lg mx-auto mt-10 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <PackageCheck className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-black text-gray-800">재고관리 비활성화 상태</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                    설정 → 재고관리 설정에서 ON으로 켜야<br />재고 현황을 사용할 수 있습니다.
                </p>
                <a href="/settings" className="inline-block mt-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all">
                    설정으로 이동
                </a>
            </div>
        );
    }

    const cropList = farmCrops.filter((crop) => {
        const stock = stockMap[crop.crop_name] ?? 0;
        
        // 비활성화 항목 필터링
        if (crop.is_active === false && !showDisabledItems) return false;
        
        if (inventoryFilter === "crop") return (crop.category ?? "crop") === "crop";
        if (inventoryFilter === "processed") return crop.category === "processed";
        if (inventoryFilter === "low") return stock <= 0;
        return true;
    });

    return (
        <div className="p-4 md:p-6 pb-32 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                        <PackageCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900">재고 현황</h1>
                        <p className="text-xs text-gray-500 font-medium">수확 기준 실시간 재고</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                    <button onClick={() => {
                            setInitRawEntries({});
                            setInitProcEntries({});
                            setShowInitStockForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-100">
                        <ClipboardList className="w-4 h-4" />
                        초기재고 설정
                    </button>
                    <button onClick={() => setShowProcessForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-100">
                        <Factory className="w-4 h-4" />
                        가공 처리
                    </button>
                    <button onClick={() => setShowQuickAddForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 active:scale-95 transition-all shadow-lg shadow-amber-100">
                        <Plus className="w-4 h-4" />
                        가공품 추가
                    </button>
                    <button onClick={loadAll} disabled={loading}
                        className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50">
                        <RefreshCcw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setShowAdjForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100">
                        <Plus className="w-4 h-4" />
                        재고 조정
                    </button>
                </div>
            </div>

            {/* 재고 현황 카드 */}
            <section className="space-y-3">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">품목별 현재 재고</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: "all", label: "전체" },
                        { key: "crop", label: "원물" },
                        { key: "processed", label: "가공품" },
                        { key: "low", label: "부족만" },
                    ].map((filter) => (
                        <button
                            key={filter.key}
                            onClick={() => setInventoryFilter(filter.key as "all" | "crop" | "processed" | "low")}
                            className={`px-3 py-2 rounded-full text-xs font-black transition-all ${inventoryFilter === filter.key
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
                
                {/* 판매중지 항목 토글 */}
                <div className="flex items-center gap-2 px-3 py-2">
                    <button
                        onClick={() => setShowDisabledItems(!showDisabledItems)}
                        className={`px-4 py-2 rounded-full text-xs font-black transition-all flex items-center gap-2 ${
                            showDisabledItems
                                ? "bg-gray-300 text-gray-700 shadow-lg shadow-gray-200"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        {showDisabledItems ? "✅ 판매중지 표시" : "⏸️ 판매중지 숨김"}
                    </button>
                </div>
                {farmCrops.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium text-sm">등록된 작물이 없습니다.<br />설정에서 작물을 먼저 추가해주세요.</p>
                    </div>
                ) : cropList.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-200">
                        <p className="text-gray-500 font-medium text-sm">현재 필터에 해당하는 품목이 없습니다.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {cropList.map(crop => {
                            const stock = stockMap[crop.crop_name] ?? 0;
                            const isLow = stock <= 0;
                            const icon = cropIconMap[crop.crop_name] || crop.crop_icon || "🌱";
                            const categoryLabel = crop.category === "processed" ? "가공품" : "원물";
                            const isTemporary = !!crop.is_temporary;
                            const isDisabled = crop.is_active === false;
                            const isRaw = (crop.category ?? "crop") !== "processed";
                            const gs = gradeStockMap[crop.crop_name];
                            const hasGradeData = isRaw && gs !== undefined;
                            const fmtN = (n: number) => n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
                            return (
                                <div key={crop.id}
                                    className={`p-4 rounded-2xl border-2 transition-all ${
                                        isDisabled 
                                            ? 'border-gray-200 bg-gray-50 opacity-50' 
                                            : isLow ? 'border-red-200 bg-white' : hasGradeData ? 'border-green-100 bg-white' : 'border-gray-100 bg-white'
                                    }`}>
                                    {/* 헤더: 아이콘 + 상태 뱃지 */}
                                    <div className="flex items-start justify-between mb-1.5">
                                        <span className="text-2xl">{icon}</span>
                                        {isDisabled ? (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                                ⏸️ 비활성화
                                            </span>
                                        ) : isLow ? (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                                                <AlertTriangle className="w-3 h-3" /> 부족
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                                <CheckCircle className="w-3 h-3" /> 정상
                                            </span>
                                        )}
                                    </div>

                                    {/* 라벨 */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{categoryLabel}</p>
                                        {isTemporary && (
                                            <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">임시</span>
                                        )}
                                        {isDisabled && (
                                            <span className="text-[10px] font-black text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">판매중지</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-gray-600 mt-0.5 mb-2">{crop.crop_name}</p>

                                    {/* ── 원물 + 등급 데이터 있음: 등급 박스 표시 ── */}
                                    {hasGradeData ? (
                                        <>
                                            <div className="grid grid-cols-3 gap-1">
                                                <div className="bg-red-50 border border-red-100 rounded-xl py-2 text-center">
                                                    <p className="text-[9px] font-black text-red-400 mb-0.5">상</p>
                                                    <p className={`text-sm font-black leading-none ${gs.sang <= 0 ? 'text-red-300' : 'text-red-700'}`}>
                                                        {fmtN(gs.sang)}
                                                    </p>
                                                </div>
                                                <div className="bg-amber-50 border border-amber-100 rounded-xl py-2 text-center">
                                                    <p className="text-[9px] font-black text-amber-400 mb-0.5">중</p>
                                                    <p className={`text-sm font-black leading-none ${gs.jung <= 0 ? 'text-amber-300' : 'text-amber-700'}`}>
                                                        {fmtN(gs.jung)}
                                                    </p>
                                                </div>
                                                <div className="bg-gray-50 border border-gray-100 rounded-xl py-2 text-center">
                                                    <p className="text-[9px] font-black text-gray-400 mb-0.5">하</p>
                                                    <p className={`text-sm font-black leading-none ${gs.ha <= 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {fmtN(gs.ha)}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* 실재고 총합 (택배 포함 전체 차감) */}
                                            <div className="mt-1.5 flex items-center justify-between">
                                                <span className="text-[9px] text-gray-400">실재고</span>
                                                <span className={`text-sm font-black ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                                                    {fmtN(stock)}
                                                    <span className="text-[10px] font-bold text-gray-400 ml-1">{crop.default_unit}</span>
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        /* ── 기본 레이아웃 (등급없는 원물 or 가공품) ── */
                                        <p className={`text-2xl font-black ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                                            {fmtN(stock)}
                                            <span className="text-xs font-bold text-gray-400 ml-1">{crop.default_unit}</span>
                                        </p>
                                    )}

                                    {/* 임시 가공품만 수정/복구 버튼 표시 */}
                                    {crop.category === "processed" && crop.is_temporary && (
                                        <button 
                                            onClick={() => handleOpenEditCrop(crop)}
                                            className={`mt-3 w-full py-1.5 text-xs font-bold rounded-lg transition-all border ${
                                                isDisabled 
                                                    ? 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200'
                                                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                                            }`}
                                        >
                                            {isDisabled ? '✅ 복구' : '✏️ 수정'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* 가공 처리 이력 */}
            {processingHistory.length > 0 && (
                <section className="space-y-3">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">가공 처리 이력</p>
                    <div className="space-y-2">
                        {processingHistory.map(rec => {
                            const isCancelled = rec.is_cancelled;
                            const outIcon = cropIconMap[rec.output_crop_name] || "🍯";
                            const inputs = rec.inputs as { crop_name: string; quantity: number; unit: string }[];
                            return (
                                <div key={rec.id}
                                    className={`p-3.5 bg-white rounded-2xl border shadow-sm transition-all ${isCancelled ? 'opacity-50 border-gray-100' : 'border-purple-100'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black text-gray-400">{rec.processed_date}</span>
                                                {isCancelled && (
                                                    <span className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full">취소됨</span>
                                                )}
                                            </div>
                                            {/* 산출품 */}
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-lg">{outIcon}</span>
                                                <span className={`text-sm font-black text-purple-700 ${isCancelled ? 'line-through' : ''}`}>
                                                    {rec.output_crop_name} +{rec.output_quantity}{rec.output_unit}
                                                </span>
                                            </div>
                                            {/* 투입 원물 */}
                                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                <span className="text-[10px] text-gray-400 font-bold">투입:</span>
                                                {inputs.map((inp, i) => (
                                                    <span key={i} className={`text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full ${isCancelled ? 'line-through' : ''}`}>
                                                        {cropIconMap[inp.crop_name] || '🌱'} {inp.crop_name} {inp.quantity}{inp.unit}
                                                    </span>
                                                ))}
                                            </div>
                                            {rec.memo && (
                                                <p className="text-[10px] text-gray-400 mt-1">{rec.memo}</p>
                                            )}
                                        </div>
                                        {!isCancelled && (
                                            <button
                                                onClick={() => handleProcessCancel(rec)}
                                                disabled={procCancelId === rec.id}
                                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50">
                                                <RotateCcw className="w-3 h-3" />
                                                취소
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* 재고 조정 이력 */}
            {adjHistory.length > 0 && (
                <section className="space-y-3">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">최근 조정 이력</p>
                    <div className="space-y-2">
                        {adjHistory.map(adj => {
                            const isPlus = adj.quantity > 0;
                            const typeInfo = ADJUSTMENT_TYPES.find(t => t.value === adj.adjustment_type);
                            const icon = cropIconMap[adj.crop_name] || "🌱";
                            const matchedCrop = farmCrops.find(c => c.crop_name === adj.crop_name);
                            const categoryLabel = matchedCrop?.category === "processed" ? "가공품" : "원물";
                            return (
                                <div key={adj.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <span className="text-xl">{icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{adj.crop_name}</p>
                                        <p className="text-[11px] text-gray-500">{categoryLabel} · {typeInfo?.label ?? adj.adjustment_type} {adj.reason ? `· ${adj.reason}` : ''}</p>
                                        {adj.adjusted_at && (
                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                {new Date(adj.adjusted_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </p>
                                        )}
                                    </div>
                                    <div className={`flex items-center gap-1 font-black text-sm ${isPlus ? 'text-blue-600' : 'text-red-500'}`}>
                                        {isPlus ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                        {isPlus ? '+' : ''}{adj.quantity}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* 가공 처리 모달 */}
            {showProcessForm && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowProcessForm(false)} />
                    <div className="relative bg-white rounded-[2rem] w-full max-w-sm shadow-2xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-300 max-h-[85vh] overflow-y-auto">
                        <div className="sticky top-0 -mx-6 px-6 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                                    <Factory className="w-5 h-5 text-purple-600" /> 가공 처리 기록
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-1">원물 → 가공품 전환 내역을 기록합니다.</p>
                            </div>
                            <button onClick={() => setShowProcessForm(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 산출 아이콘 선택 - 최상단 */}
                        <div className="sticky top-20 bg-white py-2 space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase">🎨 산출 아이콘</label>
                            
                            {/* 선택된 아이콘 미리보기 */}
                            <div className="flex items-center justify-center h-14 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                                <span className="text-4xl">{procOutputIcon}</span>
                            </div>

                            <div className="grid grid-cols-5 gap-2">
                                {PROCESSED_ICONS.map((icon) => (
                                    <button
                                        key={icon}
                                        onClick={() => setProcOutputIcon(icon)}
                                        className={`p-2 rounded-lg border-2 text-lg transition-all ${
                                            procOutputIcon === icon 
                                                ? 'border-purple-400 bg-purple-100' 
                                                : 'border-purple-200 bg-white hover:border-purple-300'
                                        }`}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>

                            {/* 이모지 더보기 버튼 */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowProcIconPicker(!showProcIconPicker)}
                                    className="w-full p-2 bg-purple-50 border border-purple-200 rounded-lg text-xs font-bold text-purple-700 hover:bg-purple-100 transition-all flex items-center justify-center gap-1"
                                >
                                    <SmilePlus className="w-4 h-4" /> 이모지 더보기
                                </button>
                                {showProcIconPicker && (
                                    <div className="absolute top-10 left-0 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 space-y-2">
                                        {/* 선택된 이모지 큰 표시 */}
                                        <div className="text-center pb-2 border-b border-gray-200">
                                            <div className="text-4xl mb-1">{procOutputIcon}</div>
                                            <p className="text-xs text-gray-500 font-bold">선택됨</p>
                                        </div>
                                        <EmojiPicker
                                            onEmojiClick={(data: EmojiClickData) => {
                                                setProcOutputIcon(data.emoji);
                                                setShowProcIconPicker(false);
                                            }}
                                            width={300}
                                            height={380}
                                            searchDisabled
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 가공 날짜 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">가공 날짜</label>
                            <input type="date" value={procDate} onChange={e => setProcDate(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-purple-400 focus:bg-white transition-all" />
                        </div>

                        {/* 산출 가공품 */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase">📝 산출 가공품명</label>
                            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 space-y-2">
                                <input type="text" value={procOutputCrop} onChange={e => setProcOutputCrop(e.target.value)}
                                    placeholder="예: 딸기잼, 딸기청, 선물세트"
                                    list="proc-output-crops"
                                    className="w-full p-3 bg-white border border-purple-200 rounded-xl text-sm font-bold outline-none focus:border-purple-500 transition-all" />
                                <datalist id="proc-output-crops">
                                    {farmCrops.filter(c => c.category === "processed").map(c => (
                                        <option key={c.id} value={c.crop_name} />
                                    ))}
                                </datalist>
                                
                                <div className="flex gap-2">
                                    <input type="number" value={procOutputQty} onChange={e => setProcOutputQty(e.target.value)}
                                        placeholder="산출 수량"
                                        className="flex-1 p-3 bg-white border border-purple-200 rounded-xl text-sm font-bold outline-none focus:border-purple-500 transition-all" />
                                    <select value={procOutputUnit} onChange={e => setProcOutputUnit(e.target.value)}
                                        className="w-20 p-3 bg-white border border-purple-200 rounded-xl text-sm font-bold outline-none focus:border-purple-500 transition-all">
                                        {["개", "병", "박스", "세트", "kg", "g"].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 투입 원물 */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase">투입 원물</label>
                            <div className="space-y-2">
                                {procInputs.map((inp, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-3 bg-orange-50 rounded-2xl border border-orange-100">
                                        <select value={inp.crop_name}
                                            onChange={e => setProcInputs(prev => prev.map((r, i) => i === idx ? { ...r, crop_name: e.target.value } : r))}
                                            className="flex-1 p-2 bg-white border border-orange-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400">
                                            <option value="">품목 선택</option>
                                            {farmCrops.map(c => (
                                                <option key={c.id} value={c.crop_name}>
                                                    {cropIconMap[c.crop_name] || c.crop_icon} {c.crop_name}
                                                </option>
                                            ))}
                                        </select>
                                        <input type="number" value={inp.quantity}
                                            onChange={e => setProcInputs(prev => prev.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))}
                                            placeholder="수량"
                                            className="w-16 p-2 bg-white border border-orange-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400 text-center" />
                                        <select value={inp.unit}
                                            onChange={e => setProcInputs(prev => prev.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r))}
                                            className="w-14 p-2 bg-white border border-orange-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400">
                                            {["kg", "g", "개", "박스", "병"].map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                        {procInputs.length > 1 && (
                                            <button onClick={() => setProcInputs(prev => prev.filter((_, i) => i !== idx))}
                                                className="text-gray-400 hover:text-red-500 transition-all">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setProcInputs(prev => [...prev, { crop_name: "", quantity: "", unit: "kg" }])}
                                    className="w-full py-2.5 border-2 border-dashed border-orange-200 rounded-2xl text-xs font-black text-orange-400 hover:border-orange-400 hover:bg-orange-50 transition-all">
                                    + 원물 추가
                                </button>
                            </div>
                        </div>

                        {/* 메모 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">메모 (선택)</label>
                            <input type="text" value={procMemo} onChange={e => setProcMemo(e.target.value)}
                                placeholder="예: 1차 가공, 딸기청 300g 30병 제조"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-purple-400 focus:bg-white transition-all" />
                        </div>

                        <button onClick={handleProcessSave} disabled={procSaving || !procOutputCrop.trim() || !procOutputQty}
                            className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold text-sm hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-100 disabled:opacity-50">
                            {procSaving ? "저장 중..." : "가공 처리 저장"}
                        </button>
                    </div>
                </div>
            )}

            {showQuickAddForm && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowQuickAddForm(false)} />
                    <div className="relative bg-white rounded-[2rem] w-full max-w-sm shadow-2xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-300 max-h-[85vh] overflow-y-auto">
                        <div className="sticky top-0 -mx-6 px-6 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-gray-900">가공품 빠른 추가</h3>
                                <p className="text-[11px] text-gray-500 mt-1">이번에만 파는 상품도 바로 등록할 수 있습니다.</p>
                            </div>
                            <button onClick={() => setShowQuickAddForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        {/* 아이콘 선택 - 최상단 */}
                        <div className="sticky top-20 bg-white py-2 space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">🎨 아이콘 선택</label>
                            
                            {/* 선택된 아이콘 미리보기 */}
                            <div className="flex items-center justify-center h-14 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                                <span className="text-4xl">{quickIcon}</span>
                            </div>

                            <div className="grid grid-cols-5 gap-2">
                                {PROCESSED_ICONS.map((icon) => (
                                    <button
                                        key={icon}
                                        onClick={() => setQuickIcon(icon)}
                                        className={`p-3 rounded-xl border-2 text-xl transition-all ${
                                            quickIcon === icon 
                                                ? 'border-amber-400 bg-amber-50' 
                                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                        }`}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                            {/* 이모지 더보기 버튼 */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowQuickIconPicker(!showQuickIconPicker)}
                                    className="w-full p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-100 transition-all flex items-center justify-center gap-1"
                                >
                                    <SmilePlus className="w-4 h-4" /> 이모지 더보기
                                </button>
                                {showQuickIconPicker && (
                                    <div className="absolute top-10 left-0 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 space-y-2">
                                        {/* 선택된 이모지 큰 표시 */}
                                        <div className="text-center pb-2 border-b border-gray-200">
                                            <div className="text-4xl mb-1">{quickIcon}</div>
                                            <p className="text-xs text-gray-500 font-bold">선택됨</p>
                                        </div>
                                        <EmojiPicker
                                            onEmojiClick={(data: EmojiClickData) => {
                                                setQuickIcon(data.emoji);
                                                setShowQuickIconPicker(false);
                                            }}
                                            width={300}
                                            height={380}
                                            searchDisabled
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 가공품명 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">📝 가공품명</label>
                            <input
                                type="text"
                                value={quickName}
                                onChange={(e) => setQuickName(e.target.value)}
                                placeholder="예: 설 선물세트, 딸기청"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-amber-400 focus:bg-white transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-500 uppercase">단위</label>
                                <select
                                    value={quickUnit}
                                    onChange={(e) => setQuickUnit(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-amber-400 focus:bg-white transition-all"
                                >
                                    {[
                                        "개",
                                        "병",
                                        "박스",
                                        "세트",
                                        "kg",
                                    ].map((unit) => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-500 uppercase">초기 수량</label>
                                <input
                                    type="number"
                                    value={quickQty}
                                    onChange={(e) => setQuickQty(e.target.value)}
                                    placeholder="없으면 비워두기"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-amber-400 focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                임시 가공품으로 바로 추가됩니다. 계속 사용하는 상품이면 나중에 설정에서 정식 품목처럼 관리해도 됩니다.
                            </p>
                        </div>

                        <button
                            onClick={handleQuickAddProcessed}
                            disabled={quickSaving || !quickName.trim()}
                            className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-sm hover:bg-amber-600 active:scale-95 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
                        >
                            {quickSaving ? "추가 중..." : "가공품 추가"}
                        </button>
                    </div>
                </div>
            )}

            {/* 가공품 수정 모달 */}
            {showEditCropForm && editingCrop && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditCropForm(false)} />
                    <div className="relative bg-white rounded-[2rem] w-full max-w-sm shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-300 max-h-[85vh] overflow-y-auto flex flex-col">
                        {/* 헤더 - sticky 상단 고정 */}
                        <div className="sticky top-0 z-10 -m-6 px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-gray-900">가공품 수정</h3>
                                <p className="text-[11px] text-gray-500 mt-1">아이콘, 이름, 단위를 수정하거나 삭제합니다.</p>
                            </div>
                            <button onClick={() => setShowEditCropForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        {/* 스크롤 가능한 내용 */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* 아이콘 선택 - 최상단 */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase">🎨 아이콘 선택</label>
                                
                                {/* 선택된 아이콘 미리보기 */}
                                <div className="flex items-center justify-center h-16 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-300">
                                    <span className="text-6xl">{editingCropIcon}</span>
                                </div>

                                <div className="grid grid-cols-5 gap-2">
                                    {PROCESSED_ICONS.map((icon) => (
                                        <button
                                            key={icon}
                                            onClick={() => setEditingCropIcon(icon)}
                                            className={`p-3 rounded-xl border-2 text-2xl transition-all ${
                                                editingCropIcon === icon 
                                                    ? 'border-amber-400 bg-amber-50' 
                                                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                            }`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>

                                {/* 이모지 더보기 버튼 */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowEditIconPicker(!showEditIconPicker)}
                                        className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-100 transition-all flex items-center justify-center gap-1"
                                    >
                                        <SmilePlus className="w-4 h-4" /> 이모지 더보기
                                    </button>
                                    {showEditIconPicker && (
                                        <div className="absolute top-12 left-0 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 space-y-2">
                                            {/* 선택된 이모지 큰 표시 */}
                                            <div className="text-center pb-2 border-b border-gray-200">
                                                <div className="text-5xl mb-1">{editingCropIcon}</div>
                                                <p className="text-xs text-gray-500 font-bold">선택됨</p>
                                            </div>
                                            <EmojiPicker
                                                onEmojiClick={(data: EmojiClickData) => {
                                                    setEditingCropIcon(data.emoji);
                                                    setShowEditIconPicker(false);
                                                }}
                                                width={300}
                                                height={380}
                                                searchDisabled
                                                previewConfig={{ showPreview: false }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 가공품명 */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-500 uppercase">📝 가공품명</label>
                                <input
                                    type="text"
                                    value={editingCropName}
                                    onChange={(e) => setEditingCropName(e.target.value)}
                                    placeholder="가공품명"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-amber-400 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-500 uppercase">기본 단위</label>
                                <select
                                    value={editingUnit}
                                    onChange={(e) => setEditingUnit(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-amber-400 focus:bg-white transition-all"
                                >
                                    {["개", "병", "박스", "세트", "kg", "g", "L", "ml"].map((unit) => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 버튼 영역 - sticky 하단 고정 */}
                        <div className="sticky bottom-0 -m-6 px-6 py-4 bg-white border-t border-gray-100 space-y-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowEditCropForm(false)}
                                    disabled={editingSaving || editingCropDeleting}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all disabled:opacity-50"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSaveEditCrop}
                                    disabled={editingSaving || editingCropDeleting || !editingCropName.trim()}
                                    className="flex-1 py-3 bg-amber-500 text-white rounded-2xl font-bold text-sm hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {editingSaving ? "수정 중..." : "수정 저장"}
                                </button>
                            </div>
                            <button
                                onClick={handleDeleteCrop}
                                disabled={editingSaving || editingCropDeleting}
                                className={`w-full py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-1 ${
                                    editingCrop.is_active === false
                                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50'
                                        : editingCropRecordCount > 0
                                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 disabled:opacity-50'
                                            : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50'
                                }`}
                            >
                                {editingCrop.is_active === false ? (
                                    <>✅ {editingCropDeleting ? "복구 중..." : "다시 활성화"}</>
                                ) : editingCropRecordCount > 0 ? (
                                    <>⏸️ {editingCropDeleting ? "비활성화 중..." : `비활성화 (${editingCropRecordCount}개 기록)`}</>
                                ) : (
                                    <>🗑️ {editingCropDeleting ? "삭제 중..." : "완전 삭제"}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 재고 조정 모달 */}
            {showAdjForm && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdjForm(false)} />
                    <div className="relative bg-white rounded-[2rem] w-full max-w-sm shadow-2xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-black text-gray-900">재고 수동 조정</h3>
                            <button onClick={() => setShowAdjForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        {/* 품목 선택 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">품목</label>
                            <select value={adjCrop} onChange={e => { setAdjCrop(e.target.value); setAdjGrade(""); }}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400 focus:bg-white transition-all">
                                <option value="">-- 품목 선택 --</option>
                                {farmCrops.map(c => (
                                    <option key={c.id} value={c.crop_name}>
                                        {cropIconMap[c.crop_name] || c.crop_icon} {c.crop_name} ({c.category === "processed" ? "가공품" : "원물"}{c.is_temporary ? ", 임시" : ""})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 원물 등급 선택 */}
                        {adjCrop && farmCrops.find(c => c.crop_name === adjCrop)?.category !== 'processed' && (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">등급 <span className="text-red-400">*필수</span></label>
                            <div className="flex gap-2">
                                {[{v:'sang',l:'특/상'},{v:'jung',l:'중'},{v:'ha',l:'하'}].map(g => (
                                    <button key={g.v} onClick={() => setAdjGrade(g.v)}
                                        className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-all border-2 ${
                                            adjGrade === g.v
                                                ? g.v === 'sang' ? 'bg-red-500 text-white border-red-500'
                                                : g.v === 'jung' ? 'bg-orange-400 text-white border-orange-400'
                                                : 'bg-yellow-400 text-white border-yellow-400'
                                                : 'bg-gray-50 text-gray-400 border-gray-100'
                                        }`}>{g.l}</button>
                                ))}
                            </div>
                        </div>
                        )}

                        {/* 조정 유형 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">조정 유형</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {ADJUSTMENT_TYPES.map(t => (
                                    <button key={t.value} onClick={() => setAdjType(t.value)}
                                        className={`p-3 rounded-2xl border-2 text-left transition-all ${adjType === t.value ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                                        <p className="text-xs font-black text-gray-800">{t.label}</p>
                                        <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 수량 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">
                                수량{adjType === "waste" ? " (자동 차감)" : adjType === "return" ? " (자동 증가)" : " (+증가 / −감소)"}
                            </label>
                            <div className="flex items-center gap-2">
                                {adjType === "waste" && <Minus className="w-4 h-4 text-red-500 shrink-0" />}
                                {adjType === "return" && <span className="text-green-500 font-black shrink-0">+</span>}
                                <input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)}
                                    placeholder={adjType === "correction" || adjType === "harvest_fix" ? "예: 10 또는 -5" : "수량 입력"}
                                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-400 focus:bg-white transition-all" />
                            </div>
                        </div>

                        {/* 사유 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase">사유 (선택)</label>
                            <input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)}
                                placeholder="예: 서리 피해, 초기 창고 재고..."
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-blue-400 focus:bg-white transition-all" />
                        </div>

                        <button onClick={handleAdjSave} disabled={adjSaving || !adjCrop || !adjQty}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 disabled:opacity-50">
                            {adjSaving ? "저장 중..." : "저장"}
                        </button>
                    </div>
                </div>
            )}

            {/* 초기재고 설정 모달 */}
            {showInitStockForm && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInitStockForm(false)} />
                    <div className="relative bg-white rounded-[2rem] w-full max-w-sm shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-300 max-h-[90vh] flex flex-col">
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-green-600" /> 초기재고 설정
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">현재 창고에 있는 수량을 직접 입력하세요.</p>
                            </div>
                            <button onClick={() => setShowInitStockForm(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 스크롤 영역 */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                            {/* 원물 섹션 */}
                            {farmCrops.filter(c => (c.category ?? "crop") !== "processed").length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black text-green-700 bg-green-100 px-2.5 py-1 rounded-full">🌱 원물</span>
                                        <span className="text-[10px] text-gray-400">상/중/하 등급별 입력</span>
                                    </div>
                                    {farmCrops.filter(c => (c.category ?? "crop") !== "processed").map(crop => {
                                        const entry = initRawEntries[crop.crop_name] ?? { sang: "", jung: "", ha: "" };
                                        const icon = cropIconMap[crop.crop_name] || crop.crop_icon || "🌱";
                                        return (
                                            <div key={crop.id} className="p-3 bg-gray-50 rounded-2xl space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{icon}</span>
                                                    <span className="text-sm font-black text-gray-800">{crop.crop_name}</span>
                                                    <span className="text-[10px] text-gray-400 ml-auto">{crop.default_unit}</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {(["sang", "jung", "ha"] as const).map(grade => (
                                                        <div key={grade} className="space-y-1">
                                                            <label className={`block text-[10px] font-black text-center ${grade === "sang" ? "text-red-600" : grade === "jung" ? "text-amber-600" : "text-gray-500"}`}>
                                                                {grade === "sang" ? "상" : grade === "jung" ? "중" : "하"}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder="0"
                                                                value={entry[grade]}
                                                                onChange={e => setInitRawEntries(prev => ({
                                                                    ...prev,
                                                                    [crop.crop_name]: {
                                                                        ...prev[crop.crop_name] ?? { sang: "", jung: "", ha: "" },
                                                                        [grade]: e.target.value,
                                                                    }
                                                                }))}
                                                                className={`w-full p-2 text-sm font-bold text-center bg-white border-2 rounded-xl outline-none transition-all ${grade === "sang" ? "border-red-100 focus:border-red-400" : grade === "jung" ? "border-amber-100 focus:border-amber-400" : "border-gray-100 focus:border-gray-400"}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 가공품 섹션 */}
                            {farmCrops.filter(c => c.category === "processed" && c.is_active !== false).length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">📦 가공품</span>
                                        <span className="text-[10px] text-gray-400">수량 입력</span>
                                    </div>
                                    {farmCrops.filter(c => c.category === "processed" && c.is_active !== false).map(crop => {
                                        const icon = cropIconMap[crop.crop_name] || crop.crop_icon || "🎁";
                                        return (
                                            <div key={crop.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                                <span className="text-lg">{icon}</span>
                                                <span className="flex-1 text-sm font-bold text-gray-800">{crop.crop_name}</span>
                                                <span className="text-[10px] text-gray-400 shrink-0">{crop.default_unit}</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={initProcEntries[crop.crop_name] ?? ""}
                                                    onChange={e => setInitProcEntries(prev => ({
                                                        ...prev,
                                                        [crop.crop_name]: e.target.value,
                                                    }))}
                                                    className="w-20 p-2 text-sm font-bold text-center bg-white border-2 border-amber-100 rounded-xl outline-none focus:border-amber-400 transition-all"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {farmCrops.length === 0 && (
                                <p className="text-center text-sm text-gray-400 py-8">등록된 품목이 없습니다.</p>
                            )}
                        </div>

                        {/* 하단 버튼 */}
                        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowInitStockForm(false)}
                                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all">
                                취소
                            </button>
                            <button
                                onClick={handleInitStockSave}
                                disabled={initSaving}
                                className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-bold text-sm hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-100 disabled:opacity-50">
                                {initSaving ? "저장 중..." : "초기재고 저장"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
