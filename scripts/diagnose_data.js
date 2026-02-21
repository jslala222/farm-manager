
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
        env[key.trim()] = value.trim().replace(/"/g, ''); // remove quotes
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log("=== DB Diagnosis Start ===");

    // 1. Check Farms
    const { data: farms, error: farmError } = await supabase.from('farms').select('id, farm_name, is_active');

    if (farmError) {
        console.error("Farm Error:", farmError);
    } else {
        if (!farms || farms.length === 0) {
            console.log("No farms found.");
        } else {
            console.log(`Found ${farms.length} farms:`);
            console.log(farms);

            // 2. Check Clients per Farm
            for (const farm of farms) {
                const { count, error } = await supabase
                    .from('clients')
                    .select('*', { count: 'exact', head: true })
                    .eq('farm_id', farm.id);

                console.log(`Farm [${farm.farm_name}] (ID: ${farm.id}): ${count} clients`);

                const { count: salesCount } = await supabase
                    .from('sales_records')
                    .select('*', { count: 'exact', head: true })
                    .eq('farm_id', farm.id);
                console.log(`  > Sales Records: ${salesCount}`);
            }
        }
    }

    // 3. Check Clients with NULL farm_id (Orphaned)
    const { count: unassignedCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .is('farm_id', null);
    console.log(`Clients with NO farm_id: ${unassignedCount}`);

    // 4. Check Expenses
    const { count: expendituresCount, error: expError } = await supabase
        .from('expenditures')
        .select('*', { count: 'exact', head: true });

    if (expError) {
        console.log("Error querying expenditures table:", expError.message);
    } else {
        console.log(`Total Expenditures count: ${expendituresCount}`);
    }

    console.log("=== Diagnosis End ===");
}

diagnose();
