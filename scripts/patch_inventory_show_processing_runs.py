# filepath: c:\Users\User\Desktop\제미나이 3\연습\claude\projects_001\farm-manager\scripts\patch_inventory_show_processing_runs.py
from pathlib import Path

p = Path(r"app\inventory\page.tsx")
s = p.read_text(encoding="utf-8")

def rep(old: str, new: str):
    global s
    if old not in s:
        raise SystemExit("패치 실패: 대상 코드 블록을 찾지 못했습니다.")
    s = s.replace(old, new, 1)

# 1) loadAll Promise.all에 processing_runs 조회 추가
rep(
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
            ]);''',
'''            const [stock, gradeStock, cropsRes, histRes, procRes, runRes, saleRes] = await Promise.all([
                fetchStockMap(farm.id),
                fetchGradeStockMap(farm.id),
                supabase.from("farm_crops").select("*").eq("farm_id", farm.id).order("sort_order"),
                supabase.from("inventory_adjustments").select("*").eq("farm_id", farm.id).order("adjusted_at", { ascending: false }).limit(30),
                supabase.from("processing_records").select("*").eq("farm_id", farm.id).order("processed_date", { ascending: false }).limit(20),
                supabase.from("processing_runs").select("*").eq("farm_id", farm.id).order("run_date", { ascending: false }).limit(20),
                supabase
                    .from("inventory_adjustments")
                    .select("crop_name, quantity, adjustment_type, reason")
                    .eq("farm_id", farm.id)
                    .lt("quantity", 0),
            ]);'''
)

# 2) processingHistory 세팅을 병합 로직으로 변경
rep(
'''            setStockMap(stock);
            setGradeStockMap(gradeStock);
            setFarmCrops(cropsRes.data ?? []);
            setAdjHistory(histRes.data ?? []);
            setProcessingHistory(procRes.data ?? []);

            const saleMap: Record<string, number> = {};''',
'''            setStockMap(stock);
            setGradeStockMap(gradeStock);
            setFarmCrops(cropsRes.data ?? []);
            setAdjHistory(histRes.data ?? []);

            const manualList = (procRes.data ?? []) as any[];
            const runList = (runRes.data ?? []).map((r: any) => ({
                id: `run:${r.id}`,
                processed_date: r.run_date ?? r.processed_date ?? toKSTDateString(),
                output_crop_name: r.output_crop_name ?? r.product_name ?? r.recipe_output_crop_name ?? "가공품",
                output_quantity: Number(r.actual_output_quantity ?? r.output_quantity ?? r.final_output_qty ?? 0),
                output_unit: r.output_unit ?? r.unit ?? "개",
                inputs: Array.isArray(r.inputs) ? r.inputs : (Array.isArray(r.input_items) ? r.input_items : []),
                memo: r.memo ?? null,
                is_cancelled: Boolean(r.is_cancelled ?? r.cancelled_at),
                _source: "run",
            }));

            const mergedProcessing = [...manualList, ...runList].sort((a: any, b: any) => {
                const ad = new Date(a?.processed_date ?? 0).getTime();
                const bd = new Date(b?.processed_date ?? 0).getTime();
                return bd - ad;
            });

            setProcessingHistory(mergedProcessing as ProcessingRecord[]);

            const saleMap: Record<string, number> = {};'''
)

# 3) 렌더링 시 run 항목은 취소 버튼 숨김
rep(
'''                        {processingHistory.map(rec => {
                            const isCancelled = rec.is_cancelled;
                            const outIcon = cropIconMap[rec.output_crop_name] || "🍯";
                            const inputs = rec.inputs as { crop_name: string; quantity: number; unit: string }[];
                            return (''',
'''                        {processingHistory.map(rec => {
                            const isCancelled = rec.is_cancelled;
                            const isRunRecord = String((rec as any).id ?? "").startsWith("run:") || (rec as any)._source === "run";
                            const outIcon = cropIconMap[rec.output_crop_name] || "🍯";
                            const inputs = rec.inputs as { crop_name: string; quantity: number; unit: string }[];
                            return ('''
)

rep(
'''                                        {!isCancelled && (
                                            <button
                                                onClick={() => handleProcessCancel(rec)}
                                                disabled={procCancelId === rec.id}
                                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50">
                                                <RotateCcw className="w-3 h-3" />
                                                취소
                                            </button>
                                        )}''',
'''                                        {!isCancelled && !isRunRecord && (
                                            <button
                                                onClick={() => handleProcessCancel(rec)}
                                                disabled={procCancelId === rec.id}
                                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50">
                                                <RotateCcw className="w-3 h-3" />
                                                취소
                                            </button>
                                        )}'''
)

p.write_text(s, encoding="utf-8")
print("patched:", p)
