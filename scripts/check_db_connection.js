const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase URL or Key is missing from environment.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
    console.log('🔍 Connecting to Supabase at:', supabaseUrl);
    try {
        // Attempt to select from farms table which is likely to exist and be accessible
        const { data, error } = await supabase.from('farms').select('*').limit(1);

        if (error) {
            console.error('❌ DB Connection Failed:', error.message);
            if (error.code === 'PGRST301') {
                console.error('💡 Tip: RLS might be blocking the request or the JWT is invalid.');
            }
            process.exit(1);
        }

        console.log('✅ DB Connection Successful!');
        if (data && data.length > 0) {
            console.log('📊 Farm Info found. Farm ID:', data[0].id);
        } else {
            console.log('📊 No records found in farms table, but connection is OK.');
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Unexpected Error during DB check:', err.message);
        process.exit(1);
    }
}

checkConnection();
