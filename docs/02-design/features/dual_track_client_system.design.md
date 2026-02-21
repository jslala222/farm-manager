# 디자인 설계: B2B 파트너 및 B2C 고객 이원화 시스템

bkit의 전문 개발 방법론을 적용하여, 농장 경영의 확장성과 데이터 무결성을 보장하는 이원화된 관리 체계를 설계합니다.

## 1. 데이터 모델 (Schema)

### 1.1 `partners` (B2B 전문 거래처)
> 사업자 기반의 대규모 납품처 관리용

| 필드명 | 타입 | 설명 | bkit 포맷 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | 기본 키 | - |
| `business_number` | TEXT | 사업자등록번호 | `000-00-00000` |
| `company_name` | TEXT | 상호/법인명 | 필수 |
| `ceo_name` | TEXT | 대표자명 | - |
| `manager_name` | TEXT | 담당자 성함 | - |
| `manager_contact` | TEXT | 담당자 연락처 | `000-0000-0000` |
| `manager_email` | TEXT | 세금계산서/로그용 이메일 | - |
| `fax_number` | TEXT | 팩스 번호 | `000-0000-0000` |
| `hq_address` | TEXT | 본사 주소 (계산서 발행지) | - |
| `delivery_address` | TEXT | 기본 납품지 주소 | - |
| `settlement_type` | TEXT | 정산 방식 (선입금/후결제/월마감) | - |
| `special_notes` | TEXT | **거래처 특이사항 (메모)** | - |

### 1.2 `customers` (B2C 개인 고객)
> 택배 및 직거래 중심의 개인 고객 관리용

| 필드명 | 타입 | 설명 | bkit 포맷 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | 기본 키 | - |
| `name` | TEXT | 고객 성함 | 필수 |
| `contact` | TEXT | 연락처 | `000-0000-0000` |
| `address` | TEXT | 기본 배송지 주소 | - |
| `is_vip` | BOOLEAN | 단골 관리 여부 | - |
| `special_notes` | TEXT | **고객 특이사항 (메모)** | - |

## 2. 시뮬레이션 시나리오 (Simulation)

### 시나리오 A: 거래처 정보 수정 시 내역 보존
- `sales_records`는 `partner_id`를 참조합니다.
- 거래처의 상호명이 바뀌더라도 `partner_id` 고유값은 유지되므로, 과거 모든 납품 기록은 안전하게 보존되며 조회 시 현재의 상호명으로 자동 갱신되어 표시됩니다.

### 시나리오 B: B2B 전용 UI 최적화
- 납품 입력 시 사업자번호와 팩스번호를 즉시 확인 가능합니다.
- 정산 방식이 '월마감'인 거래처는 미수금 관리 대상으로 자동 분류됩니다.

## 3. 마이그레이션 전략 (PDCA - Do)
1. 신규 테이블 생성 (`partners`, `customers`)
2. 기존 `clients` 데이터 분류: 
   - `nonghyup`, `factory`, `market` -> `partners`
   - `individual` -> `customers`
3. `sales_records` 테이블에 `partner_id`, `customer_id` 컬럼 추가 및 데이터 매핑
4. 검증 후 기존 `client_id` 컬럼 제거 (Cleanup)
