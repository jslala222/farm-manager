import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.findIndex((a) => a === `--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const farmId = getArg("farm");
const apply = args.includes("--apply");
const dryRun = args.includes("--dry-run") || !apply;

if (!farmId) {
  console.error("사용법: node --env-file=.env.local ./scripts/delete-processing-records.mjs --farm <FARM_ID> [--dry-run|--apply]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, (SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: rows, error: selErr } = await supabase
  .from("processing_records")
  .select("id, processed_date, output_crop_name, output_quantity, output_unit")
  .eq("farm_id", farmId)
  .order("processed_date", { ascending: false });

if (selErr) {
  console.error("조회 실패:", selErr.message);
  process.exit(1);
}

const ids = (rows ?? []).map((r) => r.id);
console.log(`farm_id=${farmId}`);
console.log(`processing_records 대상: ${ids.length}건`);

if (!ids.length) process.exit(0);

const backupDir = path.join(process.cwd(), "scripts", "_backup");
fs.mkdirSync(backupDir, { recursive: true });
const backupFile = path.join(
  backupDir,
  `processing_records_${farmId}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);
fs.writeFileSync(backupFile, JSON.stringify(rows, null, 2), "utf-8");
console.log("백업:", backupFile);

if (dryRun) {
  console.log("DRY-RUN 모드: 실제 삭제 안 함");
  process.exit(0);
}

const { error: delAdjErr } = await supabase
  .from("inventory_adjustments")
  .delete()
  .eq("farm_id", farmId)
  .in("processing_record_id", ids);

if (delAdjErr) {
  console.error("inventory_adjustments 삭제 실패:", delAdjErr.message);
  process.exit(1);
}

const { error: delProcErr } = await supabase
  .from("processing_records")
  .delete()
  .eq("farm_id", farmId)
  .in("id", ids);

if (delProcErr) {
  console.error("processing_records 삭제 실패:", delProcErr.message);
  process.exit(1);
}

console.log("삭제 완료");
