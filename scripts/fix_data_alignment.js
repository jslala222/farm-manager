
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/"/g, '');
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log("=== Data Fix Start ===");

    // 1. Find the Target Farm (Priority: Name includes '희라')
    const { data: heeraFarms } = await supabase.from('farms').select('*').ilike('farm_name', '%희라%');
    let primaryFarm = heeraFarms && heeraFarms.length > 0 ? heeraFarms[0] : null;

    if (!primaryFarm) {
        console.log("No 'Heera' farm found. Checking for any active farm...");
        const { data: activeFarms } = await supabase.from('farms').select('*').eq('is_active', true);
        primaryFarm = activeFarms && activeFarms.length > 0 ? activeFarms[0] : null;
    }

    if (!primaryFarm) {
        // Fallback to ANY farm if strictly needed, or just stop.
        const { data: anyFarms } = await supabase.from('farms').select('*').limit(1);
        primaryFarm = anyFarms && anyFarms.length > 0 ? anyFarms[0] : null;
    }

    if (!primaryFarm) {
        console.error("No farms exist at all!");
        return;
    }

    console.log(`>>> TARGET FARM: [${primaryFarm.farm_name}] (ID: ${primaryFarm.id}) <<<`);

    // 2. Check total clients in the system
    const { count: totalClients } = await supabase.from('clients').select('*', { count: 'exact', head: true });
    console.log(`Total Clients in system: ${totalClients}`);

    // 3. Move ALL clients to this farm (Since this is a single-user scenario mostly)
    // To be safe, we only move clients that are NOT on this farm.
    const { error: updateError } = await supabase
        .from('clients')
        .update({ farm_id: primaryFarm.id })
        .neq('farm_id', primaryFarm.id);

    if (updateError) console.error("Client Update Error:", updateError);
    else console.log("Clients migrated to primary farm.");

    // 4. Move ALL sales_records to this farm
    const { error: salesUpdateError } = await supabase
        .from('sales_records')
        .update({ farm_id: primaryFarm.id })
        .neq('farm_id', primaryFarm.id);

    if (salesUpdateError) console.error("Sales Record Update Error:", salesUpdateError);
    else console.log("Sales records migrated to primary farm.");

    // 4.5 Move ALL expenditures to this farm
    const { error: expUpdateError } = await supabase
        .from('expenditures')
        .update({ farm_id: primaryFarm.id })
        .neq('farm_id', primaryFarm.id);

    if (expUpdateError) console.error("Expenditure Update Error:", expUpdateError);
    else console.log("Expenditures migrated to primary farm.");

    // 5. Verify
    const { count: finalCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('farm_id', primaryFarm.id);

    console.log(`Final Clients on [${primaryFarm.farm_name}]: ${finalCount}`);

    console.log("=== Fix Complete ===");
}

fix();
