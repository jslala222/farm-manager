import { createClient } from "@supabase/supabase-js";

const farmId = "ba155f1e-a8fc-4ecf-9524-7d1c8e32b025";
const PROCESSED = ["고구마 라떼","샤인머스캣 주스","딸기잼","딸기주스"];

// 딸기 원물 -> 딸기주스 가공 1건
const RAW_CROP = "딸기";
const RAW_INPUT_QTY = 151;   // 투입
const OUTPUT_CROP = "딸기주스";
const OUTPUT_QTY = 359;      // 산출
const OUTPUT_UNIT = "개";
const INPUT_UNIT = "kg";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("env 누락");
  process.exit(1);
}
const supabase = createClient(url, key);

// KST 문자열
const kstNow = () => {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
};
const kstDate = () => kstNow().slice(0, 10);

try {
  // 1) 4개 가공품 정식품목 보정
  const { data: crops } = await supabase
    .from("farm_crops")
    .select("id,crop_name,sort_order")
    .eq("farm_id", farmId);

  let maxSort = Math.max(0, ...(crops ?? []).map(c => Number(c.sort_order ?? 0)));

  for (const name of PROCESSED) {
    const ex = (crops ?? []).find(c => c.crop_name === name);
    if (ex) {
      const { error } = await supabase.from("farm_crops").update({
        category: "processed",
        is_temporary: false,
        is_active: true,
        default_unit: "개",
        available_units: ["개"],
      }).eq("id", ex.id);
      if (error) throw error;
    } else {
      maxSort += 1;
      const { error } = await supabase.from("farm_crops").insert({
        farm_id: farmId,
        crop_name: name,
        crop_icon: "📦",
        category: "processed",
        is_temporary: false,
        is_active: true,
        default_unit: "개",
        available_units: ["개"],
        sort_order: maxSort,
      });
      if (error) throw error;
    }
  }

  // 2) 4개 가공품 관련 기존 가공기록 삭제(꼬인 데이터 제거)
  const { data: procRows, error: procSelErr } = await supabase
    .from("processing_records")
    .select("id")
    .eq("farm_id", farmId)
    .in("output_crop_name", PROCESSED);
  if (procSelErr) throw procSelErr;

  const procIds = (procRows ?? []).map(r => r.id);
  if (procIds.length > 0) {
    const { error } = await supabase
      .from("inventory_adjustments")
      .delete()
      .eq("farm_id", farmId)
      .in("processing_record_id", procIds);
    if (error) throw error;

    const { error: delProcErr } = await supabase
      .from("processing_records")
      .delete()
      .eq("farm_id", farmId)
      .in("id", procIds);
    if (delProcErr) throw delProcErr;
  }

  // 3) 4개 가공품의 일반 조정(판매/수동조정 포함)도 제거 -> 0으로 초기화
  {
    const { error } = await supabase
      .from("inventory_adjustments")
      .delete()
      .eq("farm_id", farmId)
      .in("crop_name", PROCESSED);
    if (error) throw error;
  }

  // 4) "딸기 -> 딸기주스 359" 가공기록 1건 생성
  const { data: rec, error: insProcErr } = await supabase
    .from("processing_records")
    .insert({
      farm_id: farmId,
      processed_date: kstDate(),
      output_crop_name: OUTPUT_CROP,
      output_quantity: OUTPUT_QTY,
      output_unit: OUTPUT_UNIT,
      inputs: [{ crop_name: RAW_CROP, quantity: RAW_INPUT_QTY, unit: INPUT_UNIT }],
      memo: "데이터 정합성 복구: 4개 0 기준 후 딸기주스 가공 반영",
      is_cancelled: false,
    })
    .select("id")
    .single();
  if (insProcErr) throw insProcErr;

  // 5) 재고 반영(원물 -, 가공품 +)
  {
    const { error } = await supabase.from("inventory_adjustments").insert([
      {
        farm_id: farmId,
        crop_name: OUTPUT_CROP,
        quantity: OUTPUT_QTY,
        adjustment_type: "correction",
        reason: `가공 산출(${RAW_CROP} ${RAW_INPUT_QTY}${INPUT_UNIT})`,
        adjusted_at: kstNow(),
        processing_record_id: rec.id,
      },
      {
        farm_id: farmId,
        crop_name: RAW_CROP,
        quantity: -Math.abs(RAW_INPUT_QTY),
        adjustment_type: "correction",
        reason: `가공 투입→${OUTPUT_CROP}`,
        adjusted_at: kstNow(),
        processing_record_id: rec.id,
      }
    ]);
    if (error) throw error;
  }

  console.log("완료: 4개 가공품 0 기준 + 딸기주스 359 가공 반영");
} catch (e) {
  console.error("실패:", e?.message ?? e);
  process.exit(1);
}
