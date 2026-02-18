/* 
 * bkit Strawberry Farm Manager - DB 스키마 정비 스크립트
 * --------------------------------------------------
 * [목적]
 * 1. 기존 workers 테이블에서 누락되었던 'phone' 컬럼을 복구합니다.
 * 2. 신규 요구사항인 성별(gender), 주소(address), 메모(notes) 필드를 추가합니다.
 * 
 * [사용 방법]
 * 1. Supabase Dashboard (https://supabase.com/dashboard) 접속
 * 2. 해당 프로젝트 선택 -> 왼쪽 메뉴의 'SQL Editor' 클릭
 * 3. '+ New query' 클릭 후 아래 내용을 복사해서 붙여넣기
 * 4. 'Run' 버튼을 눌러 실행
 * 
 * [안전성]
 * - 'IF NOT EXISTS' 로직을 사용하여 이미 컬럼이 있는 경우 에러 없이 넘어갑니다.
 * - 기존 데이터는 그대로 유지됩니다.
 */

DO $$ 
BEGIN
    -- [1] 연락처 컬럼 복구
    -- 이름: phone (문자열)
    -- 용도: 근로자 및 사장의 연락처 정보 저장 (010-0000-0000 형식 대응)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'phone') THEN
        ALTER TABLE workers ADD COLUMN phone TEXT;
    END IF;

    -- [2] 성별 컬럼 추가
    -- 이름: gender (문자열)
    -- 기본값: 'male' (남성)
    -- 용도: 인력 구성 파악 및 통계용 (값: male / female)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'gender') THEN
        ALTER TABLE workers ADD COLUMN gender TEXT DEFAULT 'male';
    END IF;

    -- [3] 주소 컬럼 추가
    -- 이름: address (문자열)
    -- 용도: 근로자 거주지 확인 및 배송지 정보 관리
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'address') THEN
        ALTER TABLE workers ADD COLUMN address TEXT;
    END IF;

    -- [4] 메모 컬럼 추가
    -- 이름: notes (장문 텍스트)
    -- 용도: 업무 숙련도, 특이사항, 주의 사항 등 자유로운 기록 공간
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'notes') THEN
        ALTER TABLE workers ADD COLUMN notes TEXT;
    END IF;

END $$;

-- Supabase 관리 도구에서 각 컬럼에 대한 설명을 볼 수 있도록 주석(Comment) 등록
COMMENT ON COLUMN workers.phone IS '연락처 (010-0000-0000)';
COMMENT ON COLUMN workers.gender IS '성별 (male:남성, female:여성)';
COMMENT ON COLUMN workers.address IS '거주 주소 또는 연락 주소';
COMMENT ON COLUMN workers.notes IS '특이사항 및 관리자 메모';

-- 완료 메시지 (SQL Editor 결과창에 표시됨)
-- SUCCESS: Workers table schema has been successfully updated/fixed.
