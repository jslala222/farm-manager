-- 🍓 [긴급] 대량거래처(B2B) 데이터 전면 초기화 SQL --
-- 수령인: 희라딸기 사장님
-- 목적: 개발/테스트용 지저분한 데이터를 모두 지우고 진짜 장부로 새로 시작하기 위함

-- ⚠️ 주의: 이 명령은 대량거래처(B2B/공판장)와 관련된 모든 판매 기록을 영구 삭제합니다.
-- 실행 전 한 번 더 확인 부탁드립니다.

BEGIN;

-- 1. 대량거래처(B2B) 관련 판매 기록 삭제
-- 기준: 거래처 ID가 있거나, 판매 유형이 '농협'이거나, 배송 방식이 '농협'인 모든 건
DELETE FROM sales_records 
WHERE partner_id IS NOT NULL 
   OR sale_type = 'nonghyup'
   OR delivery_method = 'nonghyup';

-- 2. 만약 이름이 '박지성', '서울청과' 등 가짜 이름으로 들어간 미지정 데이터가 있다면 추가 삭제
DELETE FROM sales_records
WHERE customer_name IN ('박지성', '서울청과', '이영희', '김철수', '손흥민');

-- 3. (옵션) 파트너(거래처) 목록 자체는 유지하되 기록만 지웁니다.
-- 만약 거래처 목록(partners 테이블)까지 초기화하고 싶으시면 아래 주석을 풀고 실행하세요.
-- DELETE FROM partners;

COMMIT;

-- [bkit 완료 보고]
-- "사장님, 이제 대량거래처 장부가 완전히 깨끗해졌습니다. 새로 시작하셔도 좋습니다."
