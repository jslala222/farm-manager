
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim().replace(/"/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function migrate() {
    console.log("\n🚀 MIGRATION START: Admin Farm -> Heera Farm 🚀");

    // 1. Get Farm IDs
    const { data: farms } = await supabase.from('farms').select('*');

    // Find Heera Farm (Target)
    const heeraFarm = farms.find(f => f.farm_name.includes('희라'));

    // Find Admin Farm (Source)
    // Also include any 'active' farm that isn't Heera, just in case the name is different
    const adminFarm = farms.find(f => f.farm_name.includes('관리자') || (f.id !== heeraFarm?.id && f.is_active));

    if (!heeraFarm) { console.error("❌ 'Heera' farm not found!"); return; }
    if (!adminFarm) { console.error("❌ Source farm not found!"); return; }

    console.log(`From: [${adminFarm.farm_name}] (${adminFarm.id})`);
    console.log(`To:   [${heeraFarm.farm_name}] (${heeraFarm.id})`);

    if (heeraFarm.id === adminFarm.id) {
        console.log("⚠️ Source and Target are the same. Nothing to migrate.");
        return;
    }

    // 2. Migrate Clients
    const { data: movedClients, error: clientError } = await supabase
        .from('clients')
        .update({ farm_id: heeraFarm.id })
        .eq('farm_id', adminFarm.id)
        .select();

    if (clientError) console.error("Client Move Error:", clientError);
    else console.log(`✅ Moved ${movedClients ? movedClients.length : 0} clients.`);

    // 3. Migrate Sales Records
    const { data: movedSales, error: salesError } = await supabase
        .from('sales_records')
        .update({ farm_id: heeraFarm.id })
        .eq('farm_id', adminFarm.id)
        .select();

    if (salesError) console.error("Sales Move Error:", salesError);
    else console.log(`✅ Moved ${movedSales ? movedSales.length : 0} sales records.`);

    // 4. Migrate Expenditures
    const { data: movedExp, error: expError } = await supabase
        .from('expenditures')
        .update({ farm_id: heeraFarm.id })
        .eq('farm_id', adminFarm.id)
        .select();

    if (expError) console.error("Expenditure Move Error:", expError);
    else console.log(`✅ Moved ${movedExp ? movedExp.length : 0} expenditures.`);

    console.log("\n✨ MIGRATION COMPLETE ✨");
}

migrate();
