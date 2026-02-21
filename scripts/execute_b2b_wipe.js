const https = require('https');
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';
const baseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co/rest/v1/sales_records';

// 대량거래처(B2B) 데이터 전면 삭제 조건
// 1. partner_id가 있는 건
// 2. sale_type이 'nonghyup'인 건
// 3. delivery_method가 'nonghyup'인 건
const url = `${baseUrl}?or=(partner_id.not.is.null,sale_type.eq.nonghyup,delivery_method.eq.nonghyup)`;

const options = {
    method: 'DELETE',
    headers: {
        'apikey': apikey,
        'Authorization': 'Bearer ' + apikey
    }
};

async function deleteAllB2B() {
    console.log("🔥 [bkit] 대량거래처(B2B) 데이터 전면 삭제 시작...");

    return new Promise((resolve) => {
        const req = https.request(url, options, (res) => {
            console.log(`📡 삭제 결과 상태 코드: ${res.statusCode}`);
            if (res.statusCode === 204 || res.statusCode === 200) {
                console.log("✅ 모든 대량거래처(B2B) 데이터가 성공적으로 소거되었습니다.");
            } else {
                console.log("❌ 데이터 삭제에 실패했습니다. (상태 코드 확인 필요)");
            }
            resolve();
        });

        req.on('error', (e) => {
            console.error(`❌ 오류 발생: ${e.message}`);
            resolve();
        });

        req.end();
    });
}

deleteAllB2B();
