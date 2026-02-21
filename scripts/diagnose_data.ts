
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log("=== DB Diagnosis Start ===");

    // 1. Check Farms
    const { data: farms, error: farmError } = await supabase.from('farms').select('id, farm_name, is_active');
    if (farmError) console.error("Farm Error:", farmError);
    console.log("Farms:", farms);

    if (!farms || farms.length === 0) {
        console.log("No farms found.");
        return;
    }

    // 2. Check Clients per Farm
    for (const farm of farms) {
        const { count, error } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('farm_id', farm.id);

        console.log(`Farm [${farm.farm_name}] (ID: ${farm.id}): ${count} clients`);
    }

    // 3. Check Unassigned Clients
    const { count: unassignedCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .is('farm_id', null);
    console.log(`Unassigned Clients: ${unassignedCount}`);

    // 4. Check Expenses
    const { count: expenseCount } = await supabase
        .from('expenses') // Table name might be 'expenditures' based on previous context, checking both
        .select('*', { count: 'exact', head: true });

    // Check if table is 'expenditures' or 'expenses'
    const { count: expenditureCount } = await supabase
        .from('expenditures')
        .select('*', { count: 'exact', head: true });

    console.log(`Expenses table count: ${expenseCount}`);
    console.log(`Expenditures table count: ${expenditureCount}`);

    console.log("=== Diagnosis End ===");
}

diagnose();
