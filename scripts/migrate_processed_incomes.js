const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://slguawnxxdmcscxkzwdo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI'
);

(async () => {
    // 1. farm_crops에 category 컬럼 추가
    const r1 = await s.rpc('exec_sql', { sql_query: "ALTER TABLE public.farm_crops ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'crop'" });
    console.log('1. category컬럼 추가:', r1.error ? r1.error.message : '성공');

    // 2. other_incomes 테이블 생성
    const r2 = await s.rpc('exec_sql', {
        sql_query: `CREATE TABLE IF NOT EXISTS public.other_incomes (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
            amount INTEGER NOT NULL DEFAULT 0,
            income_type TEXT NOT NULL DEFAULT '기타',
            description TEXT,
            income_date DATE NOT NULL DEFAULT CURRENT_DATE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`
    });
    console.log('2. other_incomes 테이블:', r2.error ? r2.error.message : '성공');

    // 3. RLS 활성화
    const r3 = await s.rpc('exec_sql', { sql_query: 'ALTER TABLE public.other_incomes ENABLE ROW LEVEL SECURITY' });
    console.log('3. RLS 활성화:', r3.error ? r3.error.message : '성공');

    // 4. RLS 정책들
    const policies = [
        `CREATE POLICY "other_incomes_select" ON public.other_incomes FOR SELECT USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))`,
        `CREATE POLICY "other_incomes_insert" ON public.other_incomes FOR INSERT WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))`,
        `CREATE POLICY "other_incomes_update" ON public.other_incomes FOR UPDATE USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))`,
        `CREATE POLICY "other_incomes_delete" ON public.other_incomes FOR DELETE USING (farm_id IN (SELECT id FROM public.farms WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))`
    ];
    for (let i = 0; i < policies.length; i++) {
        const r = await s.rpc('exec_sql', { sql_query: policies[i] });
        console.log(`4-${i + 1}. RLS 정책:`, r.error ? r.error.message : '성공');
    }

    // 5. 권한
    const r5 = await s.rpc('exec_sql', { sql_query: 'GRANT ALL ON TABLE public.other_incomes TO authenticated' });
    console.log('5. 권한 부여:', r5.error ? r5.error.message : '성공');

    // 6. 인덱스
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_other_incomes_farm_id ON public.other_incomes(farm_id)',
        'CREATE INDEX IF NOT EXISTS idx_other_incomes_date ON public.other_incomes(income_date)',
        'CREATE INDEX IF NOT EXISTS idx_farm_crops_category ON public.farm_crops(category)'
    ];
    for (let i = 0; i < indexes.length; i++) {
        const r = await s.rpc('exec_sql', { sql_query: indexes[i] });
        console.log(`6-${i + 1}. 인덱스:`, r.error ? r.error.message : '성공');
    }

    // 7. 테스트: 기존 farm_crops 확인
    const { data } = await s.from('farm_crops').select('crop_name, category').eq('farm_id', 'ba155f1e-a8fc-4ecf-9524-7d1c8e32b025');
    console.log('\n현재 등록된 작물:');
    data?.forEach(c => console.log(' -', c.crop_name, '| category:', c.category));

    console.log('\n=== 모든 마이그레이션 완료 ===');
})();
