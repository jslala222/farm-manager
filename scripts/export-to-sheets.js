/**
 * Strawberry Farm Manager - Google Sheets 데이터 내보내기 스크립트
 * 
 * 사용 방법:
 * 1. Google Cloud Console에서 프로젝트 생성
 * 2. Google Sheets API 활성화
 * 3. 서비스 계정 생성 및 JSON 키 다운로드
 * 4. credentials.json 파일을 이 스크립트와 같은 폴더에 배치
 * 5. npm install googleapis 실행
 * 6. node export-to-sheets.js 실행
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// LocalStorage 데이터 추출 (브라우저에서 직접 실행 필요)
// 또는 아래 함수를 사용하여 수동으로 데이터 입력

async function exportToSheets() {
    console.log('📊 Google Sheets 내보내기 시작...\n');

    // 1. 인증 설정
    let auth;
    try {
        const credentials = require('./credentials.json');
        auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        console.log('✅ Google API 인증 완료');
    } catch (error) {
        console.error('❌ credentials.json 파일을 찾을 수 없습니다.');
        console.log('\n📝 Google Sheets API 설정 방법:');
        console.log('1. https://console.cloud.google.com 방문');
        console.log('2. 새 프로젝트 생성');
        console.log('3. Google Sheets API 활성화');
        console.log('4. 서비스 계정 생성 → JSON 키 다운로드');
        console.log('5. 다운로드한 파일을 scripts/credentials.json으로 저장\n');
        return;
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // 2. 새 스프레드시트 생성
    const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
            properties: {
                title: `딸기농장 데이터 백업 - ${new Date().toLocaleDateString('ko-KR')}`,
            },
            sheets: [
                { properties: { title: '농장 정보' } },
                { properties: { title: '수확 기록' } },
                { properties: { title: '판매 기록' } },
                { properties: { title: '출근 기록' } },
            ],
        },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    console.log(`✅ 스프레드시트 생성 완료: ${spreadsheet.data.spreadsheetUrl}\n`);

    // 3. LocalStorage에서 데이터 읽기 (예시)
    // 실제로는 브라우저에서 localStorage.getItem('farm-storage')로 가져온 데이터를 사용
    const farmData = {
        farmName: '행복 농장',
        houseCount: 12,
    };

    // 4. 농장 정보 시트에 데이터 쓰기
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: '농장 정보!A1:B10',
        valueInputOption: 'RAW',
        requestBody: {
            values: [
                ['항목', '값'],
                ['농장 이름', farmData.farmName],
                ['하우스 수', farmData.houseCount],
                ['백업 일시', new Date().toLocaleString('ko-KR')],
            ],
        },
    });

    // 5. 수확 기록 예시 템플릿
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: '수확 기록!A1:E1',
        valueInputOption: 'RAW',
        requestBody: {
            values: [
                ['날짜', '하우스', '등급', '수확량(kg)', '메모'],
                // 실제 데이터는 여기에 추가
            ],
        },
    });

    // 6. 판매 기록 예시 템플릿
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: '판매 기록!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
            values: [
                ['날짜', '판매처', '등급', '수량(kg)', '단가(원)', '총액(원)'],
                // 실제 데이터는 여기에 추가
            ],
        },
    });

    // 7. 출근 기록 예시 템플릿
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: '출근 기록!A1:D1',
        valueInputOption: 'RAW',
        requestBody: {
            values: [
                ['날짜', '직원명', '근무시간', '메모'],
                // 실제 데이터는 여기에 추가
            ],
        },
    });

    console.log('✅ 모든 데이터 내보내기 완료!');
    console.log(`\n📋 스프레드시트 링크: ${spreadsheet.data.spreadsheetUrl}`);
    console.log('\n💡 이제 브라우저에서 위 링크를 열어 데이터를 확인하세요.');
}

// 실행
if (require.main === module) {
    exportToSheets().catch(console.error);
}

module.exports = { exportToSheets };
