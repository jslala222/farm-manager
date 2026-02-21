
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

async function diagnose() {
    console.log("\n⬇️⬇️⬇️ DIAGNOSIS START ⬇️⬇️⬇️");

    // 1. List All Farms
    const { data: farms } = await supabase.from('farms').select('*');
    if (!farms) { console.log("No farms found."); return; }

    console.log(`Found ${farms.length} farms.`);

    for (const f of farms) {
        // Count Clients
        const { count: clientCount } = await supabase
            .from('clients').select('*', { count: 'exact', head: true }).eq('farm_id', f.id);

        // Count Sales
        const { count: salesCount } = await supabase
            .from('sales_records').select('*', { count: 'exact', head: true }).eq('farm_id', f.id);

        console.log(`[Farm: ${f.farm_name}]`);
        console.log(` - ID: ${f.id}`);
        console.log(` - Active: ${f.is_active}`);
        console.log(` - Clients: ${clientCount} | Sales: ${salesCount}`);
    }

    // 2. Count Orphans
    const { count: orphanClients } = await supabase
        .from('clients').select('*', { count: 'exact', head: true }).is('farm_id', null);
    console.log(`\nOrphan Clients (No ID): ${orphanClients}`);

    // 3. Track Mock Data
    console.log("\n🔍 Tracking Mock Data (Pattern: '단골손님%')...");
    const { data: mockClients } = await supabase
        .from('clients')
        .select('id, farm_id, name')
        .like('name', '단골손님%')
        .limit(5);

    if (mockClients && mockClients.length > 0) {
        console.log(`Found mock data sample (farm_id): ${mockClients[0].farm_id}`);
        const ownerFarm = farms.find(f => f.id === mockClients[0].farm_id);
        if (ownerFarm) console.log(` -> Belongs to: ${ownerFarm.farm_name}`);
        else console.log(" -> Belongs to UNKNOWN farm");
    } else {
        console.log("No mock data found.");
    }

    console.log("⬆️⬆️⬆️ DIAGNOSIS END ⬆️⬆️⬆️\n");
}

diagnose();
