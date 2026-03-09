import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("env 누락");
  process.exit(1);
}
const supabase = createClient(url, key);

const { data, error } = await supabase
  .from("processing_records")
  .select("farm_id");

if (error) {
  console.error(error.message);
  process.exit(1);
}

const count = new Map();
for (const r of data ?? []) {
  count.set(r.farm_id, (count.get(r.farm_id) ?? 0) + 1);
}
for (const [farmId, n] of count.entries()) {
  console.log(farmId, n);
}
