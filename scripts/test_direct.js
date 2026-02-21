const https = require('https');

const url = 'https://slguawnxxdmcscxkzwdo.supabase.co/rest/v1/farms?select=count';
const options = {
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI'
    }
};

console.log("🚀 수파베이스 직접 통신 테스트 중...");

https.get(url, options, (res) => {
    console.log(`📡 상태 코드: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log("✅ 연결 성공!");
            console.log("데이터:", data);
        } else {
            console.error("❌ 연결 실패!");
            console.error("오류 내용:", data);
        }
    });
}).on('error', (err) => {
    console.error("💥 통신 오류 발생:", err.message);
});
