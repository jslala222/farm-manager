// workers 데이터 확인 스크립트
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uvnvkfqcjyaqvfqfqfbx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bnZrZnFjanlhcXZmcWZxZmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMzAwMDAwMH0.fake_key_for_example';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkWorkerRoles() {
    try {
        const { data, error } = await supabase
            .from('workers')
            .select('id, name, role')
            .in('name', ['나타부리', '박현정', '김경준'])
            .order('name');

        if (error) {
            console.error('❌ 데이터 조회 오류:', error);
            return;
        }

        console.log('📋 근로자 역할 정보:');
        console.log('═'.repeat(60));
        
        const roleMap = {
            'family': '가족/식구',
            'staff': '직원(내국인)',
            'foreign': '직원(외국인)',
            'part_time': '개별인력'
        };

        data?.forEach(worker => {
            console.log(`👤 이름: ${worker.name}`);
            console.log(`   역할(DB): ${worker.role}`);
            console.log(`   역할(표시): ${roleMap[worker.role] || '알 수 없음'}`);
            console.log('─'.repeat(60));
        });

        if (!data || data.length === 0) {
            console.log('⚠️  해당 근로자를 찾을 수 없습니다.');
        }

    } catch (err) {
        console.error('💥 시스템 오류:', err);
    }
}

checkWorkerRoles();
