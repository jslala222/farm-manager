const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findFarm() {
    console.log('Finding farm by ID: e1c57114-6072-410d-b9d3-030978851312');
    const { data: farm, error } = await supabase.from('farms').select('*').eq('id', 'e1c57114-6072-410d-b9d3-030978851312');
    console.log('Result:', JSON.stringify(farm, null, 2));
    if (error) console.log('Error:', error);

    console.log('\n--- All Profiles ---');
    const { data: profiles } = await supabase.from('profiles').select('*');
    console.log(JSON.stringify(profiles, null, 2));
}

findFarm().catch(console.error);
