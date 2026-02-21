
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

async function checkSchema() {
    console.log("--- SALES_RECORDS COLUMNS ---");
    const { data: sData, error: sError } = await supabase.from('sales_records').select('*').limit(1);
    if (!sError && sData && sData.length > 0) {
        Object.keys(sData[0]).forEach(k => console.log(`[sales_records] ${k}`));
    } else {
        console.log("No data in sales_records. Checking test columns...");
        const testCols = ['detail_address', 'delivery_note', 'recipient_name', 'recipient_phone', 'is_settled', 'postal_code'];
        for (const col of testCols) {
            const { error } = await supabase.from('sales_records').select(col).limit(1);
            console.log(`[sales_records] ${col}: ${error ? '❌ MISSING' : '✅ EXISTS'}`);
        }
    }

    console.log("\n--- CUSTOMERS COLUMNS ---");
    const { data: cData, error: cError } = await supabase.from('customers').select('*').limit(1);
    if (!cError && cData && cData.length > 0) {
        Object.keys(cData[0]).forEach(k => console.log(`[customers] ${k}`));
    } else {
        console.log("No data in customers. Checking test columns...");
        const testCols = ['detail_address', 'postal_code'];
        for (const col of testCols) {
            const { error } = await supabase.from('customers').select(col).limit(1);
            console.log(`[customers] ${col}: ${error ? '❌ MISSING' : '✅ EXISTS'}`);
        }
    }
}

checkSchema();
