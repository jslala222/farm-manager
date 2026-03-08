import { supabase } from "@/lib/supabase";

export interface StockMap {
    [cropName: string]: number; // 현재 재고 수량
}

// 원물 등급별 재고 현황 (상/중/하)
export interface GradeStock {
    sang: number; // 상
    jung: number; // 중
    ha: number;   // 하
}

export interface GradeStockMap {
    [cropName: string]: GradeStock;
}

export interface ShortageRow {
    cropName: string;
    unit?: string;
    grade?: string; // 등급별 차감 시 해당 등급
    available: number;
    requested: number;
    shortage: number;
}

function formatQty(n: number): string {
    if (!Number.isFinite(n)) return "0";
    const isInt = Math.abs(n - Math.round(n)) < 1e-9;
    return isInt ? String(Math.round(n)) : n.toFixed(1);
}

/**
 * 특정 농장의 품목별 현재 재고를 계산하여 반환한다.
 * 재고 = 수확합계 - 판매합계 - 재고조정(감소분)
 */
export async function fetchStockMap(farmId: string): Promise<StockMap> {
    // 1. 수확 합계 (crop_name별)
    const { data: harvestData } = await supabase
        .from("harvest_records")
        .select("crop_name, quantity")
        .eq("farm_id", farmId);

    // 2. 판매 합계 (crop_name별, b2b + b2c)
    const { data: salesData } = await supabase
        .from("sales_records")
        .select("crop_name, quantity")
        .eq("farm_id", farmId);

    // 3. 재고조정 합계 (crop_name별 — +면 재고증가, -면 재고감소)
    const { data: adjustData } = await supabase
        .from("inventory_adjustments")
        .select("crop_name, quantity")
        .eq("farm_id", farmId);

    const stock: StockMap = {};

    // 수확 합산
    for (const r of harvestData ?? []) {
        if (!r.crop_name) continue;
        stock[r.crop_name] = (stock[r.crop_name] ?? 0) + Number(r.quantity ?? 0);
    }

    // 판매 차감
    for (const r of salesData ?? []) {
        if (!r.crop_name) continue;
        stock[r.crop_name] = (stock[r.crop_name] ?? 0) - Number(r.quantity ?? 0);
    }

    // 조정 반영 (quantity가 양수면 추가, 음수면 차감)
    for (const r of adjustData ?? []) {
        if (!r.crop_name) continue;
        stock[r.crop_name] = (stock[r.crop_name] ?? 0) + Number(r.quantity ?? 0);
    }

    return stock;
}

/**
 * 판매 전 재고를 확인한다.
 * - grade 없는 항목 → fetchStockMap(총재고) 기준
 * - grade 있는 원물 → fetchGradeStockMap(등급별 재고) 기준
 */
export async function checkStockBeforeSale(
    farmId: string,
    items: { cropName: string; quantity: number; unit?: string; grade?: string }[],
    warnOnly: boolean
): Promise<{ ok: boolean; warning: boolean; message: string; rows: ShortageRow[] }> {
    // 등급 있는 항목이 하나라도 있으면 gradeStockMap도 조회
    const hasGraded = items.some(i => i.grade && i.grade !== '');
    const [stock, gradeStock] = await Promise.all([
        fetchStockMap(farmId),
        hasGraded ? fetchGradeStockMap(farmId) : Promise.resolve({} as GradeStockMap),
    ]);

    const normGrade = (g: string): "sang" | "jung" | "ha" | null => {
        switch (g) {
            case "sang": case "상": case "특/상": return "sang";
            case "jung": case "중": return "jung";
            case "ha": case "하": return "ha";
            default: return null;
        }
    };

    const rows: ShortageRow[] = [];

    for (const item of items) {
        const requested = Number(item.quantity ?? 0);
        const g = item.grade ? normGrade(item.grade) : null;

        let avail: number;
        if (g && gradeStock[item.cropName]) {
            // 등급 지정 → 해당 등급 재고 체크
            avail = gradeStock[item.cropName][g] ?? 0;
        } else {
            // 등급 미지정 → 총재고 체크
            avail = stock[item.cropName] ?? 0;
        }

        if (avail < requested) {
            rows.push({
                cropName: item.cropName,
                unit: item.unit,
                grade: g ?? undefined,
                available: Number(avail ?? 0),
                requested,
                shortage: Math.max(0, requested - Number(avail ?? 0)),
            });
        }
    }

    if (rows.length === 0) {
        return { ok: true, warning: false, message: "", rows: [] };
    }

    const gradeLabel: Record<string, string> = { sang: '특/상', jung: '중', ha: '하' };
    const messageLines = rows.map((r) => {
        const unit = r.unit ? ` ${r.unit}` : "";
        const gl = r.grade ? ` [${gradeLabel[r.grade] ?? r.grade}]` : "";
        return `${r.cropName}${gl}: 재고 ${formatQty(r.available)}${unit} / 판매 ${formatQty(r.requested)}${unit}`;
    });
    const message = `재고 부족\n${messageLines.join("\n")}`;

    if (warnOnly) {
        return { ok: true, warning: true, message, rows };
    } else {
        return { ok: false, warning: false, message, rows };
    }
}

/**
 * 원물 등급별(상/중/하) 재고를 계산한다.
 * = harvest_records(grade별 수확)
 * + inventory_adjustments(grade있는 초기재고/조정)
 * - sales_records(grade있는 판매만 — B2B 거래처 납품)
 *
 * 택배/무등급 판매는 등급에서 차감하지 않음 (총재고 stockMap에서만 차감).
 * 따라서 sang+jung+ha 합계와 stockMap 총합이 다를 수 있음 — 정상동작.
 */
export async function fetchGradeStockMap(farmId: string): Promise<GradeStockMap> {
    const [harvestRes, salesRes, adjRes] = await Promise.all([
        supabase.from("harvest_records").select("crop_name, quantity, grade").eq("farm_id", farmId),
        supabase.from("sales_records").select("crop_name, quantity, grade").eq("farm_id", farmId).not("grade", "is", null),
        supabase.from("inventory_adjustments").select("crop_name, quantity, grade").eq("farm_id", farmId).not("grade", "is", null),
    ]);

    // 등급 정규화: 'sang'|'상'|'특/상' → sang, 'jung'|'중' → jung, 'ha'|'하' → ha
    const normGrade = (g: string): "sang" | "jung" | "ha" | null => {
        switch (g) {
            case "sang": case "상": case "특/상": return "sang";
            case "jung": case "중": return "jung";
            case "ha": case "하": return "ha";
            default: return null;
        }
    };

    const map: GradeStockMap = {};
    const ensure = (crop: string) => { if (!map[crop]) map[crop] = { sang: 0, jung: 0, ha: 0 }; };

    // 1. 수확 합산 (harvest_records는 항상 sang/jung/ha 등급 보유)
    for (const r of harvestRes.data ?? []) {
        if (!r.crop_name || !r.grade) continue;
        const g = normGrade(r.grade); if (!g) continue;
        ensure(r.crop_name);
        map[r.crop_name][g] += Number(r.quantity ?? 0);
    }

    // 2. 등급 지정 판매 차감 (B2B 거래처 납품 등 grade가 있는 판매만)
    for (const r of salesRes.data ?? []) {
        if (!r.crop_name || !r.grade) continue;
        const g = normGrade(r.grade); if (!g) continue;
        ensure(r.crop_name);
        map[r.crop_name][g] -= Number(r.quantity ?? 0);
    }

    // 3. 재고 조정 반영 (초기재고 입력, 폐기 등 grade있는 항목)
    for (const r of adjRes.data ?? []) {
        if (!r.crop_name || !r.grade) continue;
        const g = normGrade(r.grade); if (!g) continue;
        ensure(r.crop_name);
        map[r.crop_name][g] += Number(r.quantity ?? 0);
    }

    return map;
}
