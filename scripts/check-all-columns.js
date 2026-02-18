const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllColumns() {
    const tables = ['farms', 'workers', 'harvest_records', 'sales_records', 'attendance_records', 'expenditures'];

    for (const table of tables) {
        console.log(`\n--- Checking ${table} ---`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error checking ${table}:`, error.message);
        } else if (data && data.length > 0) {
            console.log(`Columns in ${table}:`, Object.keys(data[0]));
        } else {
            console.log(`Table ${table} is empty, checking with remote query...`);
            // Fallback: try to insert and rollback or use RPC if available
            // For now, let's just note it's empty.
        }
    }
}

checkAllColumns().catch(console.error);
