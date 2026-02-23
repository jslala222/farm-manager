# 하이브리드 다품종 작물 시스템 설계서

## 목표
1,000개 농장이 자유롭게 자기 작물을 등록/관리할 수 있는 확장형 아키텍처 구축.
하드코딩된 `CROPS` 배열을 완전 제거하고, DB에서 동적으로 작물 목록을 불러온다.

## 현재 상태 (AS-IS)
- `app/sales/page.tsx` 77~82줄에 `CROPS` 배열이 하드코딩됨 (bkit 규칙 12번 위반)
- `farm_houses` 테이블에 `current_crop` 필드 존재 (설정 페이지에서 직접 입력 가능)
- 사장님 농장: 1~3동 = 딸기, 6~8동 = 다른 작물

## 설계 (TO-BE)

### 핵심 원칙
1. **하드코딩 제로**: 모든 작물은 DB(`farm_houses.current_crop`)에서 가져온다
2. **자동 집계**: 동에 입력된 작물명을 기준으로 중복 제거 → 작물 버튼 자동 생성
3. **단위 자유 설정**: 각 작물의 기본 단위도 DB에서 관리 (`farm_crops` 테이블 신설)
4. **프리셋 제공**: 신규 가입 시 농장 유형별 추천 작물 자동 세팅

### DB 변경 (SQL)
1. `farm_crops` 테이블 신설
   - `id` UUID PK
   - `farm_id` UUID FK → farms
   - `crop_name` TEXT NOT NULL (작물명)
   - `crop_icon` TEXT (이모지 아이콘)
   - `default_unit` TEXT DEFAULT 'kg' (기본 단위)
   - `available_units` TEXT[] (사용 가능한 단위 목록)
   - `sort_order` INTEGER DEFAULT 0 (표시 순서)
   - `is_active` BOOLEAN DEFAULT TRUE
   - `created_at` TIMESTAMPTZ
   - UNIQUE(farm_id, crop_name)

### 코드 변경
1. `lib/supabase.ts` - `FarmCrop` 인터페이스 추가
2. `app/sales/page.tsx` - `CROPS` 하드코딩 삭제 → DB에서 useQuery로 동적 로드
3. `app/harvest/page.tsx` - 수확 시 해당 동의 작물명 자동 채움
4. `app/settings/page.tsx` - 작물 관리 섹션 추가 (CRUD)
5. 자동 동기화: `farm_houses.current_crop` 변경 시 `farm_crops`에 없는 작물이면 자동 추가

### 프리셋 전략
- 신규 농장 생성 시, 기본 작물 '딸기'를 자동 등록
- 설정 페이지에서 "추천 작물 추가" 버튼으로 한국 주요 작물 빠르게 추가 가능

## 영향 범위
- sales/page.tsx (CROPS 제거 및 DB 연동)
- harvest/page.tsx (동별 작물명 자동 연동)
- settings/page.tsx (작물 CRUD UI 추가)
- lib/supabase.ts (타입 추가)
- SQL 마이그레이션 스크립트

## 리스크
- 기존 `crop_name` 필드에 이미 저장된 데이터와의 호환성 → 기존 데이터 유지, 새 시스템과 병행
