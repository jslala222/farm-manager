import { createClient } from "@supabase/supabase-js";

const farmId = "ba155f1e-a8fc-4ecf-9524-7d1c8e32b025";
const processed4 = ["고구마 라떼", "샤인머스캣 주스", "딸기잼", "딸기주스"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("env 누락");
  process.exit(1);
}
const supabase = createClient(url, key);

const nowKST = () => {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
};

try {
  // 1) 가공품 4개의 판매성 음수 제거
  const { data: negRows, error: negErr } = await supabase
    .from("inventory_adjustments")
    .select("id,crop_name,quantity,reason,adjustment_type")
    .eq("farm_id", farmId)
    .in("crop_name", processed4)
    .lt("quantity", 0);
  if (negErr) throw negErr;

  const saleLikeIds = (negRows ?? [])
    .filter(r => /판매|출고|shipment|delivery|order/i.test(String(r.reason ?? "")) || ["sale","shipment","delivery","order_out"].includes(String(r.adjustment_type ?? "")))
    .map(r => r.id);

  if (saleLikeIds.length > 0) {
    const { error } = await supabase.from("inventory_adjustments").delete().in("id", saleLikeIds);
    if (error) throw error;
    console.log("판매성 음수 삭제:", saleLikeIds.length, "건");
  } else {
    console.log("판매성 음수 삭제: 0건");
  }

  // 2) 딸기 원물 이중차감 원복 +151 (중복삽입 방지)
  const restoreReason = "딸기 이중차감 원복(+151)";
  const { data: alreadyRows, error: alreadyErr } = await supabase
    .from("inventory_adjustments")
    .select("id")
    .eq("farm_id", farmId)
    .eq("crop_name", "딸기")
    .eq("quantity", 151)
    .eq("reason", restoreReason)
    .limit(1);
  if (alreadyErr) throw alreadyErr;

  if (!alreadyRows || alreadyRows.length === 0) {
    const { error } = await supabase.from("inventory_adjustments").insert({
      farm_id: farmId,
      crop_name: "딸기",
      quantity: 151,
      adjustment_type: "correction",
      reason: restoreReason,
      adjusted_at: nowKST(),
      grade: null,
    });
    if (error) throw error;
    console.log("딸기 +151 원복 완료");
  } else {
    console.log("딸기 +151 원복: 이미 적용됨");
  }

  // 3) 딸기주스 재고를 359로 맞춤
  const { data: juiceRows, error: juiceErr } = await supabase
    .from("inventory_adjustments")
    .select("quantity")
    .eq("farm_id", farmId)
    .eq("crop_name", "딸기주스");
  if (juiceErr) throw juiceErr;

  const current = (juiceRows ?? []).reduce((s, r) => s + Number(r.quantity ?? 0), 0);
  const target = 359;
  const diff = target - current;

  if (diff !== 0) {
    const { error } = await supabase.from("inventory_adjustments").insert({
      farm_id: farmId,
      crop_name: "딸기주스",
      quantity: diff,
      adjustment_type: "correction",
      reason: `딸기주스 목표재고 보정(${current}→${target})`,
      adjusted_at: nowKST(),
      grade: null,
    });
    if (error) throw error;
    console.log(`딸기주스 보정 완료: ${diff > 0 ? "+" : ""}${diff}`);
  } else {
    console.log("딸기주스 보정 불필요: 이미 359");
  }

  console.log("완료");
} catch (e) {
  console.error("실패:", e?.message ?? e);
  process.exit(1);
}
