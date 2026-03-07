import { supabase } from "@/lib/supabase";

export interface StockMap {
    [cropName: string]: number; // 현재 재고 수량
}

export interface ShortageRow {
    cropName: string;
    unit?: string;
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
 * @returns { ok: boolean; message: string }
 *   ok=true  → 판매 진행 가능
 *   ok=false → 재고 부족 (warn_only=true면 경고만, false면 차단)
 */
export async function checkStockBeforeSale(
    farmId: string,
    items: { cropName: string; quantity: number; unit?: string }[],
    warnOnly: boolean
): Promise<{ ok: boolean; warning: boolean; message: string; rows: ShortageRow[] }> {
    const stock = await fetchStockMap(farmId);

    const rows: ShortageRow[] = [];

    for (const item of items) {
        const avail = stock[item.cropName] ?? 0;
        if (avail < item.quantity) {
            const requested = Number(item.quantity ?? 0);
            rows.push({
                cropName: item.cropName,
                unit: item.unit,
                available: Number(avail ?? 0),
                requested,
                shortage: Math.max(0, requested - Number(avail ?? 0)),
            });
        }
    }

    if (rows.length === 0) {
        return { ok: true, warning: false, message: "", rows: [] };
    }

    const messageLines = rows.map((r) => {
        const unit = r.unit ? ` ${r.unit}` : "";
        return `${r.cropName}: 재고 ${formatQty(r.available)}${unit} / 판매 ${formatQty(r.requested)}${unit}`;
    });
    const message = `재고 부족\n${messageLines.join("\n")}`;

    if (warnOnly) {
        // 경고 모드: ok=true 이지만 warning=true로 알림
        return { ok: true, warning: true, message, rows };
    } else {
        // 차단 모드: ok=false
        return { ok: false, warning: false, message, rows };
    }
}
