// Supabase 테이블 생성 스크립트
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
    console.log('Supabase 연결 테스트 중...');

    // 연결 테스트
    const { data, error } = await supabase.from('harvest_records').select('count').limit(1);

    if (error && error.code === '42P01') {
        console.log('테이블이 없습니다. Supabase 대시보드에서 직접 SQL을 실행해야 합니다.');
        console.log('\n아래 SQL을 Supabase SQL Editor에 붙여넣고 실행하세요:');
        console.log('https://supabase.com/dashboard/project/slguawnxxdmcscxkzwdo/sql/new\n');
        console.log(`
CREATE TABLE IF NOT EXISTS harvest_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  house_number int NOT NULL,
  grade text NOT NULL,
  quantity int NOT NULL,
  recorded_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_type text NOT NULL,
  quantity numeric NOT NULL,
  price int,
  customer_name text,
  address text,
  recorded_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  worker_name text NOT NULL,
  role text NOT NULL,
  is_present boolean NOT NULL DEFAULT true,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE harvest_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records DISABLE ROW LEVEL SECURITY;
    `);
    } else if (error) {
        console.log('연결 오류:', error.message);
    } else {
        console.log('✅ harvest_records 테이블 이미 존재합니다!');
    }

    // sales_records 확인
    const { error: e2 } = await supabase.from('sales_records').select('count').limit(1);
    if (!e2) console.log('✅ sales_records 테이블 이미 존재합니다!');

    // attendance_records 확인
    const { error: e3 } = await supabase.from('attendance_records').select('count').limit(1);
    if (!e3) console.log('✅ attendance_records 테이블 이미 존재합니다!');
}

createTables().catch(console.error);
