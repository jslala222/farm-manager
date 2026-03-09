import { createClient } from "@supabase/supabase-js";

const farmId = "ba155f1e-a8fc-4ecf-9524-7d1c8e32b025";
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

const { error } = await supabase.from("inventory_adjustments").insert({
  farm_id: farmId,
  crop_name: "딸기주스",
  quantity: 126,
  adjustment_type: "correction",
  reason: "딸기주스 재고 목표값 보정(233→359)",
  adjusted_at: nowKST(),
  grade: null,
});

if (error) {
  console.error("실패:", error.message);
  process.exit(1);
}

console.log("완료: 딸기주스 +126 보정 (233→359)");
