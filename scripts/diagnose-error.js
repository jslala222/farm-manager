const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- Fetching all workers to see what we have ---');
    const { data: workers, error: workerError } = await supabase.from('workers').select('*');
    if (workerError) console.error('Worker Fetch Error:', workerError);
    else console.log('Workers found:', workers.length, workers.map(w => ({ name: w.name, farm_id: w.farm_id })));

    console.log('\n--- Fetching all farms ---');
    const { data: farms, error: farmError } = await supabase.from('farms').select('*');
    if (farmError) console.error('Farm Fetch Error:', farmError);
    else console.log('Farms found:', farms.map(f => ({ id: f.id, name: f.farm_name })));

    console.log('\n--- Checking Workers Table Columns ---');
    // We can't easily check columns without an RPC or raw PG query, but we can look at a sample row
    if (workers && workers.length > 0) {
        console.log('Sample row keys:', Object.keys(workers[0]));
    }
}

diagnose().catch(console.error);
