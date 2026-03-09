import { createClient } from "@supabase/supabase-js";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const farmId = "ba155f1e-a8fc-4ecf-9524-7d1c8e32b025";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("env 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);

const rl = readline.createInterface({ input, output });
const items = ["고구마 라떼", "샤인머스캣 주스", "딸기잼", "딸기주스"];

const toKST = () => {
  const d = new Date();
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = k.getUTCFullYear();
  const m = String(k.getUTCMonth() + 1).padStart(2, "0");
  const day = String(k.getUTCDate()).padStart(2, "0");
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const mm = String(k.getUTCMinutes()).padStart(2, "0");
  const ss = String(k.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
};

const rows = [];
for (const name of items) {
  const ans = await rl.question(`[${name}] 원래 판매량 입력(숫자, 없으면 0): `);
  const n = Number(ans);
  if (Number.isFinite(n) && n > 0) {
    rows.push({
      farm_id: farmId,
      crop_name: name,
      quantity: -Math.abs(n),
      adjustment_type: "correction",
      reason: "판매 데이터 복구(수동)",
      adjusted_at: toKST(),
      grade: null,
    });
  }
}
await rl.close();

if (rows.length === 0) {
  console.log("입력된 판매량이 없어 종료.");
  process.exit(0);
}

// 같은 복구 reason 기존값 제거 후 재삽입(중복 방지)
const cropNames = rows.map(r => r.crop_name);
const { error: delErr } = await supabase
  .from("inventory_adjustments")
  .delete()
  .eq("farm_id", farmId)
  .eq("reason", "판매 데이터 복구(수동)")
  .in("crop_name", cropNames);
if (delErr) {
  console.error("기존 복구값 삭제 실패:", delErr.message);
  process.exit(1);
}

const { error: insErr } = await supabase.from("inventory_adjustments").insert(rows);
if (insErr) {
  console.error("복구 insert 실패:", insErr.message);
  process.exit(1);
}

console.log("복구 완료:", rows.length, "건");

