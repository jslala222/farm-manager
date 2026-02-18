const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
    console.log('--- Table: workers ---');
    // Using RPC or raw query if possible, but let's just try to insert 'staff' and see error
    const { error } = await supabase.from('workers').insert({
        farm_id: 'e1c57114-6072-410d-b9d3-030978851312',
        name: 'Constraint Test',
        role: 'staff'
    });

    if (error) {
        console.log('Error inserting staff:', error.message);
    } else {
        console.log('Successfully inserted staff. No constraint issue.');
        // Clean up
        await supabase.from('workers').delete().eq('name', 'Constraint Test');
    }
}

checkConstraints().catch(console.error);
