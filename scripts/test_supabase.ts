import { supabase } from './lib/supabase';

async function testConnection() {
    console.log("🔍 수파베이스 연결 테스트 시작...");
    try {
        const { data, error } = await supabase.from('farms').select('count', { count: 'exact', head: true });
        if (error) {
            console.error("❌ 연결 실패:", error.message);
            console.error("상세 정보:", error);
        } else {
            console.log("✅ 연결 성공! 농장 수:", data);
        }
    } catch (err) {
        console.error("💥 치명적 오류:", err);
    }
}

testConnection();
