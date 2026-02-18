const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIds() {
    console.log('--- Farms ---');
    const { data: farms } = await supabase.from('farms').select('id, farm_name');
    console.log(farms);

    console.log('\n--- Workers ---');
    const { data: workers } = await supabase.from('workers').select('id, name, farm_id, role');
    console.log(workers);
}

checkIds().catch(console.error);
