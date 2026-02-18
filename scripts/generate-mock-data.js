// scripts/generate-mock-data.js
// 수확 및 판매 기록 랜덤 데이터 100건 생성 스크립트

console.log('[Mock Data Generator] 데이터 생성을 시작합니다...');

try {
    const { createClient } = require('@supabase/supabase-js');

    // .env.local 값 (하드코딩 for convenience script execution)
    const supabaseUrl = 'https://slguawnxxdmcscxkzwdo.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZ3Vhd254eGRtY3NjeGt6d2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzIsImV4cCI6MjA4NjkyOTk3Mn0.gB1Sqiy247xyFD8gSBubCrWc_aJNV-v4hJArzDcw-JI';

    const supabase = createClient(supabaseUrl, supabaseKey);

    async function generateData() {
        // 1. 농장 ID 조회
        const { data: farms, error: farmError } = await supabase.from('farms').select('id').limit(1);
        if (farmError || !farms || farms.length === 0) {
            console.error('❌ 농장 정보를 찾을 수 없습니다.');
            return;
        }
        const farmId = farms[0].id;
        console.log(`✅ 농장 ID 확인: ${farmId}`);

        // 2. 하우스 정보 조회 (Active Houses)
        const { data: houses, error: houseError } = await supabase.from('farm_houses')
            .select('house_number')
            .eq('farm_id', farmId)
            .eq('is_active', true);

        if (houseError || !houses || houses.length === 0) {
            console.error('❌ 활성화된 하우스 정보를 찾을 수 없습니다.');
            return;
        }
        const houseNumbers = houses.map(h => h.house_number);
        console.log(`✅ 하우스 목록 확인: ${houseNumbers.join(', ')}`);

        // 3. 수확 기록 생성 (Harvest)
        console.log('🔄 수확 기록 100건 생성 중...');
        const harvestRecords = [];
        const grades = ['sang', 'jung', 'ha'];

        for (let i = 0; i < 100; i++) {
            const randomHouse = houseNumbers[Math.floor(Math.random() * houseNumbers.length)];
            const randomGrade = grades[Math.floor(Math.random() * grades.length)];
            const randomQuantity = Math.floor(Math.random() * 50) + 1; // 1~50
            const randomDaysAgo = Math.floor(Math.random() * 90); // 0~90일 전
            const recordedAt = new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000).toISOString();

            harvestRecords.push({
                farm_id: farmId,
                house_number: randomHouse,
                grade: randomGrade,
                quantity: randomQuantity,
                recorded_at: recordedAt
            });
        }

        const { error: hInsertError } = await supabase.from('harvest_records').insert(harvestRecords);
        if (hInsertError) console.error('❌ 수확 기록 생성 실패:', hInsertError.message);
        else console.log('✅ 수확 기록 100건 생성 완료!');


        // 4. 판매 기록 생성 (Sales)
        console.log('🔄 판매 기록 100건 생성 중...');
        const salesRecords = [];
        const saleTypes = ['nonghyup', 'jam', 'etc'];
        const customers = ['하나로마트', '서울청과', '김철수', '이영희', '박지성', '손흥민', '농협공판장'];
        const addresses = ['서울시 강남구', '경기도 성남시', '부산시 해운대구', '대구시 수성구', '광주시 서구'];

        for (let i = 0; i < 100; i++) {
            const randomType = saleTypes[Math.floor(Math.random() * saleTypes.length)];
            const randomQuantity = Math.floor(Math.random() * 100) + 1; // 1~100
            const randomPrice = (Math.floor(Math.random() * 50) + 1) * 1000; // 1000~50000
            const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
            const randomAddress = addresses[Math.floor(Math.random() * addresses.length)];
            const randomDaysAgo = Math.floor(Math.random() * 90);
            const recordedAt = new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000).toISOString();

            salesRecords.push({
                farm_id: farmId,
                sale_type: randomType,
                quantity: randomQuantity,
                price: randomPrice,
                customer_name: randomCustomer,
                address: randomAddress,
                recorded_at: recordedAt
            });
        }

        const { error: sInsertError } = await supabase.from('sales_records').insert(salesRecords);
        if (sInsertError) console.error('❌ 판매 기록 생성 실패:', sInsertError.message);
        else console.log('✅ 판매 기록 100건 생성 완료!');

    }

    generateData();

} catch (e) {
    console.error('스크립트 실행 중 오류 발생:', e);
}
