import { supabase } from "@/lib/supabase";

export interface StockMap {
    [cropName: string]: number; // 현재 재고 수량
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
    items: { cropName: string; quantity: number }[],
    warnOnly: boolean
): Promise<{ ok: boolean; warning: boolean; message: string }> {
    const stock = await fetchStockMap(farmId);

    const shortage: string[] = [];

    for (const item of items) {
        const avail = stock[item.cropName] ?? 0;
        if (avail < item.quantity) {
            shortage.push(`${item.cropName}: 재고 ${avail.toFixed(1)} / 판매 ${item.quantity}`);
        }
    }

    if (shortage.length === 0) {
        return { ok: true, warning: false, message: "" };
    }

    const message = `재고 부족\n${shortage.join("\n")}`;

    if (warnOnly) {
        // 경고 모드: ok=true 이지만 warning=true로 알림
        return { ok: true, warning: true, message };
    } else {
        // 차단 모드: ok=false
        return { ok: false, warning: false, message };
    }
}
