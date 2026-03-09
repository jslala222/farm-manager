# filepath: c:\Users\User\Desktop\제미나이 3\연습\claude\projects_001\farm-manager\scripts\patch_inventory_sales_record.py
from pathlib import Path

p = Path(r"app\inventory\page.tsx")
s = p.read_text(encoding="utf-8")

def replace_or_fail(src: str, dst: str):
    global s
    if src not in s:
        raise SystemExit("패치 실패: 대상 코드 블록을 찾지 못했습니다.")
    s = s.replace(src, dst, 1)

# 1) state 추가
replace_or_fail(
'''    // 등급별 재고 현황 (원물 전용)
    const [gradeStockMap, setGradeStockMap] = useState<GradeStockMap>({});
    const nowKSTTimestamp = () => formatKSTDate(getNowKST());
''',
'''    // 등급별 재고 현황 (원물 전용)
    const [gradeStockMap, setGradeStockMap] = useState<GradeStockMap>({});
    // 품목별 누적 판매기록(재고와 분리)
    const [salesRecordMap, setSalesRecordMap] = useState<Record<string, number>>({});
    const nowKSTTimestamp = () => formatKSTDate(getNowKST());
'''
)

# 2) loadAll 조회 확장 + 판매기록 맵 계산
replace_or_fail(
'''            const [stock, gradeStock, cropsRes, histRes, procRes] = await Promise.all([
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
''',
'''            const [stock, gradeStock, cropsRes, histRes, procRes, saleRes] = await Promise.all([
                fetchStockMap(farm.id),
                fetchGradeStockMap(farm.id),
                supabase.from("farm_crops").select("*").eq("farm_id", farm.id).order("sort_order"),
                supabase.from("inventory_adjustments").select("*").eq("farm_id", farm.id).order("adjusted_at", { ascending: false }).limit(30),
                supabase.from("processing_records").select("*").eq("farm_id", farm.id).order("processed_date", { ascending: false }).limit(20),
                supabase
                    .from("inventory_adjustments")
                    .select("crop_name, quantity, adjustment_type, reason")
                    .eq("farm_id", farm.id)
                    .lt("quantity", 0),
            ]);
            setStockMap(stock);
            setGradeStockMap(gradeStock);
            setFarmCrops(cropsRes.data ?? []);
            setAdjHistory(histRes.data ?? []);
            setProcessingHistory(procRes.data ?? []);

            const saleMap: Record<string, number> = {};
            for (const row of saleRes.data ?? []) {
                const t = String((row as any).adjustment_type ?? "");
                const reason = String((row as any).reason ?? "");
                const isSaleType = ["sale", "shipment", "delivery", "order_out"].includes(t);
                const isSaleReason = /판매|출고/.test(reason);
                if (!isSaleType && !isSaleReason) continue;

                const cropName = String((row as any).crop_name ?? "");
                const qty = Math.abs(Number((row as any).quantity ?? 0));
                if (!cropName || !Number.isFinite(qty) || qty <= 0) continue;
                saleMap[cropName] = (saleMap[cropName] ?? 0) + qty;
            }
            setSalesRecordMap(saleMap);
'''
)

# 3) 카드 표시 로직 변경 (순재고와 판매기록 분리)
replace_or_fail(
'''                            const soldRecord = isProcessedNonTemp ? Math.max(-stock, 0) : 0;
''',
'''                            const soldRecord = isProcessedNonTemp ? (salesRecordMap[crop.crop_name] ?? 0) : 0;
'''
)

p.write_text(s, encoding="utf-8")
print("patched:", p)
