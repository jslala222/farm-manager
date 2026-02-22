const https = require('https');
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';
const baseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co/rest/v1';

// 삭제 대상 가짜 데이터 키워드
const junkKeywords = ['박지성', '손흥민', '이영희', '김철수', '서울청과', '정지인', '단골', '혐동'];

async function deleteJunk(table, column) {
    console.log(`🧹 [bkit] ${table} 테이블에서 유령 데이터 소거 중...`);
    const orCondition = junkKeywords.map(k => `${column}.ilike.%${k}%`).join(',');
    const url = `${baseUrl}/${table}?or=(${orCondition})`;

    const options = {
        method: 'DELETE',
        headers: {
            'apikey': apikey,
            'Authorization': 'Bearer ' + apikey
        }
    };

    return new Promise((resolve) => {
        const req = https.request(url, options, (res) => {
            console.log(`📡 ${table} 결과: ${res.statusCode}`);
            resolve();
        });
        req.on('error', (e) => {
            console.error(`❌ ${table} 오류: ${e.message}`);
            resolve();
        });
        req.end();
    });
}

async function runFullPurge() {
    await deleteJunk('customers', 'name');
    await deleteJunk('partners', 'company_name');
    await deleteJunk('sales_records', 'customer_name');
    console.log("✅ 모든 유령 데이터가 소거되었습니다. 이제 사장님의 진짜 데이터만 남았습니다.");
}

runFullPurge();
