# 🍯 가공 처리 기능 완벽 가이드 (Processing Records System)

**최종 구현**: 가공 레코드 신설형 (🅒 3안)  
**작성일**: 2026-03-08  
**상태**: ✅ 완성

---

## 목차
1. [기능 개요](#기능-개요)
2. [변경사항](#변경사항-beforeafter)
3. [DB 스키마](#db-스키마-변경)
4. [UI 변경](#ui-변경-헤더-버튼--모달--이력)
5. [사용 방법](#사용-방법)
6. [시나리오별 예시](#시나리오별-예시)
7. [코드 구조](#코드-구조)
8. [주의사항](#주의사항)

---

## 기능 개요

### 핵심 목표
**원물 → 가공품 전환 전체 흐름을 자동으로 추적하고, 재고를 실시간 반영**

### 무엇이 달라졌나?

| 구분 | 이전 | 이후 |
|------|------|------|
| **가공품 등록** | 수동만 가능 (품목명, 단위, 초기량 입력) | 자동 + 원물 차감 동시 처리 |
| **원물 차감** | ❌ 수동으로만 "폐기" 조정 입력 | ✅ 가공 처리 시 자동 차감 |
| **이력 추적** | 조정 이력에만 흩어져 기록 | 한눈에 보는 "가공 처리 이력" 섹션 |
| **롤백** | ❌ 불가능 (삭제 가능) | ✅ "[취소]" 버튼 → 재고 원복 |
| **투입 원물 명시** | 메모로만 기록 | JSONB 배열로 정확히 저장 |

---

## 변경사항 (Before/After)

### Before (기존 방식)
```
사용자: 딸기 50kg를 가공용으로 사용하고 싶음
   ↓
[재고 조정] 버튼 클릭
   ↓
모달: 품목=딸기, 조정유형="폐기" 또는 "가공전환", 수량=50kg, 사유="딸기잼 제조"
   ↓
저장 → inventory_adjustments에 단순 음수 기록
   ↓
재고: 딸기 -50kg만 반영, 가공품은 수동으로 따로 "가공품 추가" 필요
   ↓
결과: 원물과 가공품이 분리되어 추적 불가능
```

### After (신규 방식)
```
사용자: [⚙️ 가공 처리] 버튼 클릭 (새 버튼)
   ↓
모달 오픈: 가공 날짜, 산출 가공품, 투입 원물 × N개 입력
   ↓
저장 → 다음 3가지 동시 처리:
  1. processing_records 테이블에 가공 이력 기록
  2. 투입 원물마다 inventory_adjustments INSERT (음수, process_out)
  3. 산출 가공품 inventory_adjustments INSERT (양수, process_in)
   ↓
재고: 딸기 -50kg + 딸기잼 +30병 자동 반영
   ↓
이력: "가공 처리 이력" 섹션에 카드 표시 + [취소] 버튼
   ↓
결과: 원물→가공품 전체 흐름 추적 + 언제든 롤백 가능
```

---

## DB 스키마 변경

### ✅ 신설 테이블: `processing_records`

```sql
CREATE TABLE public.processing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL,                    -- 농장 ID
    processed_date DATE NOT NULL,             -- ⭐ 가공 날짜 ('2026-03-08')
    output_crop_name TEXT NOT NULL,           -- ⭐ 산출 가공품명 ('딸기잼')
    output_quantity NUMERIC(10,2) NOT NULL,  -- ⭐ 산출 수량 (30)
    output_unit TEXT NOT NULL,                -- ⭐ 산출 단위 ('병')
    inputs JSONB NOT NULL DEFAULT '[]',      -- ⭐ 투입 원물 배열
    memo TEXT,                                -- 메모 (선택)
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- inputs 컬럼 예시 (JSONB):
[
  { "crop_name": "딸기", "quantity": 50, "unit": "kg" },
  { "crop_name": "설탕", "quantity": 10, "unit": "kg" }
]
```

### ✅ 수정 테이블: `inventory_adjustments`

```sql
-- 신규 컬럼 추가:
ALTER TABLE public.inventory_adjustments
ADD COLUMN IF NOT EXISTS processing_record_id UUID 
  REFERENCES public.processing_records(id);

-- 예: 딸기잼 가공 시 생성되는 조정 레코드들
{
  adjustment_type: "process_in",            -- 신규 타입
  crop_name: "딸기잼",
  quantity: 30,
  processing_record_id: "uuid-123...",      -- 연결!
  reason: "가공 처리 산출 (딸기, 설탕)"
}

{
  adjustment_type: "process_out",           -- 기존 타입 재사용
  crop_name: "딸기",
  quantity: -50,
  processing_record_id: "uuid-123...",      -- 같은 연결
  reason: "가공 처리 투입 → 딸기잼"
}
```

### 재고 계산 공식 (변경 없음)
```
현재 재고 = 수확 + 초기 + 반품 - 판매 - 폐기 - 가공전환 + 가공산출
         = SUM(수확) - SUM(판매) + SUM(조정)
         
예) 딸기잼 생성 후:
  딸기: 1000 (수확) - 50 (가공전환) = 950
  딸기잼: 0 (신규) + 30 (가공산출) = 30
```

---

## UI 변경 (헤더 버튼 + 모달 + 이력)

### 1️⃣ 헤더 버튼 (app/inventory/page.tsx 상단)

**Before:**
```
[+ 가공품 추가] [새로고침] [+ 재고 조정]
```

**After:**
```
[⚙️ 가공 처리] [+ 가공품 추가] [새로고침] [+ 재고 조정]
                ↑ 신규 버튼          (기존 유지)    (기존 유지)
```

### 2️⃣ 신규 모달: "가공 처리 기록"

**외형**
```
┌─────────────────────────────────────┐
│ ⚙️ 가공 처리 기록              [✕]  │
│ 원물 → 가공품 전환 내역을 기록합니다 │
│                                     │
│ [가공 날짜] 📅 2026-03-08          │
│                                     │
│ 산출 가공품                         │
│ ├─ 품목명: [딸기잼 ▼]              │
│ ├─ 수량: [30]                      │
│ └─ 단위: [병 ▼]                    │
│                                     │
│ 투입 원물 (최소 1개 필수)           │
│ ├─ [딸기 ▼] [50] [kg ▼] [×]       │
│ ├─ [설탕 ▼] [10] [kg ▼] [×]       │
│ └─ [+ 원물 추가]                    │
│                                     │
│ 메모 (선택)                         │
│ [예: 1차 가공...              ]     │
│                                     │
│ [가공 처리 저장]                    │
└─────────────────────────────────────┘
```

### 3️⃣ 신규 섹션: "가공 처리 이력" (재고 조정 이력 위에 추가)

```
가공 처리 이력

┌─────────────────────────────────────┐
│ 2026-03-08                          │
│ 🍯 딸기잼 +30병 ────────── [취소] │
│ 투입: 🍓 딸기 50kg, 당 설탕 10kg    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 2026-03-05  ~~취소됨~~              │
│ 🍯 딸기청 +5병                      │
│ 투입: 🍓 딸기 20kg                  │
└─────────────────────────────────────┘
```

---

## 사용 방법

### 🔧 Step 1: 가공 처리 기록하기

**상황**: 딸기 50kg + 설탕 10kg으로 딸기잼 30병을 만들 때

1. [⚙️ 가공 처리] 버튼 클릭
2. 모달 오픈
3. **가공 날짜**: `2026-03-08` (자동 오늘 날짜)
4. **산출 가공품**:
   - 품목명: `딸기잼` (기존 목록 또는 새로 입력)
   - 수량: `30`
   - 단위: `병` (드롭다운 선택)
5. **투입 원물**:
   - 1행: 품목=`딸기`, 수량=`50`, 단위=`kg`
   - 2행: 품목=`설탕`, 수량=`10`, 단위=`kg`
   - ([+ 원물 추가] 버튼으로 행 추가 가능)
6. **메모** (선택): `1차 가공, 딸기잼 300g 30병`
7. [가공 처리 저장] 클릭

### ✅ 자동으로 일어나는 일

**1. 산출 가공품이 farm_crops에 없으면 자동 등록**
- `딸기잼` 품목 INSERT (is_temporary: true, category: "processed")

**2. processing_records 저장**
- 날짜, 산출품, 투입 원물 배열 저장

**3. 재고 자동 조정**
- ✅ `딸기잼`: +30병 (process_in) → 재고에 +30 반영
- ✅ `딸기`: -50kg (process_out) → 재고에서 -50 반영
- ✅ `설탕`: -10kg (process_out) → 재고에서 -10 반영

**결과**: 재고 현황에서 즉시 변경됨
```
변경 전:
- 딸기: 1000kg (정상)
- 설탕: 100kg (정상)
- 딸기잼: (등록 안 됨)

변경 후:
- 딸기: 950kg (정상)
- 설탕: 90kg (정상)
- 딸기잼: 30병 (정상)
```

### 🔄 Step 2: 가공 처리 취소하기 (롤백)

**상황**: 위에서 기록한 가공 처리를 취소하고 싶을 때

1. **가공 처리 이력** 섹션에서 해당 카드 찾기
2. [취소] 버튼 클릭
3. "가공 처리를 취소하면 재고가 원복됩니다. 계속할까요?" 확인창
4. [OK] 선택

### ⏮️ 자동으로 일어나는 일

**1. processing_records 상태 변경**
- `is_cancelled: true`
- `cancelled_at: 2026-03-08T14:30:45Z` (현재 한국 시간)

**2. 역방향 inventory_adjustments 생성** (부호 반전)
- ✅ `딸기잼`: -30병 (원복) → 재고에서 -30 반영
- ✅ `딸기`: +50kg (원복) → 재고에 +50 반영
- ✅ `설탕`: +10kg (원복) → 재고에 +10 반영

**3. 이력 섹션**
- 취소된 항목: 취소선 표시, "취소됨" 배지 표시
- [취소] 버튼 사라짐

**결과**: 재고가 원래대로 돌아옴
```
원복 후:
- 딸기: 1000kg (정상) — 다시 증가!
- 설탕: 100kg (정상) — 다시 증가!
- 딸기잼: (또는 0 → 30에서 0으로 감소)
```

---

## 시나리오별 예시

### 📌 Scenario 1: 첫 가공 처리

**상황**: 딸기 100kg를 딸기잼(30병) + 딸기청(5병)으로 나누어 가공

**Step**:

1. **첫 번째 가공 (딸기잼)**
   ```
   가공 날짜: 2026-03-08
   산출: 🍯 딸기잼 30병
   투입: 🍓 딸기 60kg
   메모: 1차 - 딸기잼 300g/병
   ```
   결과: 딸기 100 - 60 = 40kg 남음

2. **두 번째 가공 (딸기청)**
   ```
   가공 날짜: 2026-03-08
   산출: 🍯 딸기청 5병
   투입: 🍓 딸기 40kg
   메모: 1차 - 딸기청 1L/병
   ```
   결과: 딸기 40 - 40 = 0kg (모두 사용)

**재고 현황**:
```
[가공 처리 이력]
- 2026-03-08: 🍯 딸기청 +5병 ← 🍓 딸기 40kg
- 2026-03-08: 🍯 딸기잼 +30병 ← 🍓 딸기 60kg

[재고 현황]
- 딸기: 0kg ✓ (모두 사용됨)
- 딸기잼: 30병 ✓
- 딸기청: 5병 ✓
```

---

### 📌 Scenario 2: 실수로 잘못 기록 → 취소

**상황**: 위 첫 번째 가공에서 딸기량을 실수로 "50kg"이라고 입력함

**Step**:

1. 가공 처리 이력에서 "2026-03-08: 🍯 딸기잼" 카드 찾기
2. [취소] 버튼 클릭
3. 확인 → OK

**결과**:
```
[가공 처리 이력]
- 2026-03-08: 🍯 딸기청 +5병 ← 🍓 딸기 40kg
- 2026-03-08: ~~🍯 딸기잼 +30병~~ [취소됨]

[재고 현황]
- 딸기: 60kg ← 다시 원복!
- 딸기잼: 0병 ← 제거되거나 유지됨
- 딸기청: 5병 (유지)

[최근 조정 이력]
- correction: 딸기 +30kg (가공 취소 원복)
- correction: 딸기잼 -30병 (가공 취소 원복)
```

---

### 📌 Scenario 3: 여러 원물 사용

**상황**: 딸기(60kg) + 설탕(10kg) + 젤라틴(2kg)으로 특별 잼(50병) 제조

**가공 처리 입력**:
```
가공 날짜: 2026-03-05
산출: 🍯 딸기 프리미엄 잼 50병

투입 원물:
  행1: 🍓 딸기 60kg
  행2: 당 설탕 10kg
  행3: 🧪 젤라틴 2kg
  ([+ 원물 추가]로 행 추가)

메모: 프리미엄 라인, 각 500g
```

**결과**:
```
[재고 변화]
- 딸기: 1000 - 60 = 940kg
- 설탕: 100 - 10 = 90kg
- 젤라틴: 10 - 2 = 8kg
- 딸기 프리미엄 잼: 0 + 50 = 50병

[가공 처리 이력에 표시]
2026-03-05: 🍯 딸기 프리미엄 잼 +50병
투입: 🍓 딸기 60kg, 당 설탕 10kg, 🧪 젤라틴 2kg
메모: 프리미엄 라인, 각 500g
```

---

## 코드 구조

### 📁 파일 변경 요약

| 파일 | 변경 내용 |
|------|---------|
| `supabase/migrations/20260308000000_add_processing_records.sql` | ✅ 신설 마이그레이션 |
| `lib/supabase.ts` | ➕ ProcessingRecord 인터페이스 추가 |
| `app/inventory/page.tsx` | ➕ 가공 모달, 함수, 상태, UI 대폭 추가 |
| `hooks/useInventory.ts` | ✓ 변경 없음 (stockMap은 inventory_adjustments 기반이라 자동 반영) |

### 🔑 State 변수 (inventory/page.tsx)

```typescript
// 가공 처리 모달 상태
const [showProcessForm, setShowProcessForm] = useState(false);
const [procDate, setProcDate] = useState(toKSTDateString());  // 오늘 날짜 기본값
const [procOutputCrop, setProcOutputCrop] = useState("");      // 산출 가공품명
const [procOutputQty, setProcOutputQty] = useState("");        // 산출 수량
const [procOutputUnit, setProcOutputUnit] = useState("개");    // 산출 단위
const [procMemo, setProcMemo] = useState("");                  // 메모
const [procInputs, setProcInputs] = useState<ProcInput[]>([
    { crop_name: "", quantity: "", unit: "kg" }               // 투입 원물 배열
]);
const [procSaving, setProcSaving] = useState(false);           // 저장 중 플래그
const [procCancelId, setProcCancelId] = useState<string | null>(null); // 취소 진행 중

// 가공 이력
const [processingHistory, setProcessingHistory] = useState<ProcessingRecord[]>([]);
```

### 🔑 핵심 함수 (inventory/page.tsx)

#### 1. `handleProcessSave()` — 가공 처리 저장

```typescript
const handleProcessSave = async () => {
    // 검증
    // 1️⃣ 산출 가공품이 없으면 farm_crops에 INSERT
    // 2️⃣ processing_records INSERT
    // 3️⃣ inventory_adjustments 일괄 INSERT (투입원물 × + 산출품 1)
    //    - 각각 processing_record_id 연결
    // 4️⃣ 성공 메시지 + loadAll() 호출
};
```

**Key Logic**:
```typescript
// 산출 가공품 auto-register
if (!exists) {
    await supabase.from("farm_crops").insert({
        crop_name: procOutputCrop,
        is_temporary: true,
        category: "processed"
    });
}

// processing_records 생성
const { data: procData } = await supabase.from("processing_records").insert({
    farm_id, processed_date: procDate,
    output_crop_name: procOutputCrop,
    output_quantity: outQty, output_unit: procOutputUnit,
    inputs: procInputs  // JSONB 배열
}).select().single();

// inventory_adjustments 일괄 INSERT
const adjRows = [
    // 산출 (+)
    { crop_name: procOutputCrop, quantity: outQty, 
      adjustment_type: "process_in", processing_record_id: procData.id },
    // 투입 (-)
    ...procInputs.map(i => ({
        crop_name: i.crop_name, quantity: -Number(i.quantity),
        adjustment_type: "process_out", processing_record_id: procData.id
    }))
];

await supabase.from("inventory_adjustments").insert(adjRows);
```

#### 2. `handleProcessCancel()` — 가공 처리 취소

```typescript
const handleProcessCancel = async (rec: ProcessingRecord) => {
    // 1️⃣ processing_records.is_cancelled = true
    // 2️⃣ 역방향 조정 레코드들 INSERT (부호 반전)
    //    - reason: "가공 취소 원복"
    // 3️⃣ loadAll() 호출 → UI 업데이트
};
```

**Key Logic**:
```typescript
// 취소 처리
await supabase.from("processing_records")
    .update({ is_cancelled: true, cancelled_at: getNowKST().toISOString() })
    .eq("id", rec.id);

// 역방향 조정 생성
const reverseRows = [
    // 산출 (-) → 차감
    { crop_name: rec.output_crop_name, quantity: -rec.output_quantity, ... },
    // 투입 (+) → 복구
    ...inputs.map(i => ({
        crop_name: i.crop_name, quantity: i.quantity,  // 부호 반전 없음 (양수)
        adjustment_type: "correction",  // correction 타입 사용
        processing_record_id: rec.id
    }))
];

await supabase.from("inventory_adjustments").insert(reverseRows);
```

#### 3. `loadAll()` — 전체 데이터 리로드

```typescript
const loadAll = useCallback(async () => {
    const [stock, cropsRes, histRes, procRes] = await Promise.all([
        fetchStockMap(farm.id),                    // 재고 계산
        supabase.from("farm_crops").select(...),   // 품목 목록
        supabase.from("inventory_adjustments")..., // 조정 이력
        supabase.from("processing_records")...     // 가공 이력 ⭐
    ]);
    
    setStockMap(stock);
    setFarmCrops(cropsRes.data ?? []);
    setAdjHistory(histRes.data ?? []);
    setProcessingHistory(procRes.data ?? []);     // 가공 이력 업데이트
}, [farm?.id]);
```

### 🔑 Type 정의

```typescript
// processing_records 전체 유형
export interface ProcessingRecord {
    id: string;
    farm_id: string;
    processed_date: string;     // DATE (YYYY-MM-DD)
    output_crop_name: string;
    output_quantity: number;
    output_unit: string;
    inputs: { crop_name: string; quantity: number; unit: string }[];
    memo?: string | null;
    is_cancelled: boolean;
    cancelled_at?: string | null;
    created_at: string;
}

// 투입 원물 로컬 타입
type ProcInput = { crop_name: string; quantity: string; unit: string };
```

---

## 주의사항

### ⚠️ 재고 마이너스 제한 없음

**문제**: 가공품을 저장할 때 원물 재고가 음수가 될 수 있음

**예**:
```
딸기 현재 재고: 30kg
가공 처리: 딸기 50kg 투입
→ 결과: 딸기 -20kg (음수!) ❌
```

**권장사항**: 
- 가공 처리 전에 재고 현황 확인 필수
- B2B 판매처럼 "재고 체크" 기능을 나중에 추가할 수 있음

### ⚠️ 취소 후에도 조정 이력 남음

**특징**: 삭제가 아닌 "역방향 입력" 방식이므로 감사 추적 가능

```
[최근 조정 이력]
- 2026-03-08 14:32 correction: 딸기 +50kg (가공 취소 원복)
- 2026-03-08 14:32 correction: 딸기잼 -30병 (가공 취소 원복)
- 2026-03-08 14:30 process_out: 딸기 -50kg (투입)
- 2026-03-08 14:30 process_in: 딸기잼 +30병 (산출)
```

**의미**: 누가, 언제, 뭘 했는지 완전히 추적 가능 ✅

### ⚠️ 산출 가공품이 자동 등록됨

**동작**: 
```
만약 "딸기잼"이 farm_crops에 없으면
→ 자동으로 INSERT (is_temporary: true, category: "processed")
```

**확인**: 이후 재고 현황에서 "임시" 배지로 표시됨

**주의**: 실수로 오타 입력하면 임시 품목이 만들어질 수 있으니 주의

### ⚠️ KST (한국 시간대) 사용

**모든 시간 저장**:
```typescript
adjusted_at: getNowKST().toISOString()  // UTC→KST 변환
processed_date: procDate                // 사용자가 선택한 날짜 (문자열)
```

**주의**: UTC 시간으로 저장되면 안됨 (기존 CLAUDE.md 규칙)

---

## 향후 기능 확장 아이디어

| 기능 | 우선순위 | 설명 |
|------|---------|------|
| **재고 하한선 체크** | 🔴 높음 | 가공 처리 전 원물 충분 여부 확인 |
| **가공 이력 보고서** | 🟡 중간 | 월별 가공 처리 통계 |
| **가공 템플릿** | 🟡 중간 | 반복되는 가공 패턴 저장 후 재사용 |
| **대량 일괄 취소** | 🟠 낮음 | 여러 기록 한번에 취소 |
| **가공품 수율률 추적** | 🟠 낮음 | 원물 투입 vs 산출량 비율 분석 |

---

## Q&A

### Q1: 기존 "폐기/손실" 조정과의 차이?

**폐기/손실**:
- 용도: 부패, 파손 등 실제 손실만 기록
- 모달: [품목 선택] → [조정유형=폐기] → [수량] → [사유]

**가공 처리**:
- 용도: 원물 → 가공품 으로 전환 (손실 아님)
- 모달: [산출 가공품] + [투입 원물 × N]
- 자동: 산출품도 증가시킴

### Q2: 여러 기록을 한번에 취소할 수 있나?

**현재**: 단일 [취소] 버튼만 지원 (하나씩 취소)

**추가 기능 필요** 시 요청

### Q3: 가공품이 없는데 입력해도 되나?

**네, 자동 등록됨**:
```
입력한 이름이 farm_crops에 없으면
→ 가공처리 저장 시 자동 INSERT
→ is_temporary: true로 표시
→ 나중에 설정에서 정식품목으로 변경 가능
```

### Q4: 투입 원물을 잘못 입력했으면?

**해결 방법**:
1. [취소] 버튼으로 전체 기록 취소
2. 다시 정확히 입력 후 저장

**또는** (향후):
- 부분 수정 기능 추가 가능

### Q5: 같은 날짜에 여러 가공을 할 수 있나?

**네, 가능**:
```
2026-03-08:
  - 14:30 가공처리 1: 딸기→잼
  - 14:45 가공처리 2: 딸기→청
  - 15:00 가공처리 3: 고구마→칩
```

모두 동시에 재고에 반영됨

---

## 체크리스트

### ✅ 구현됨
- [x] `processing_records` 테이블 신설
- [x] DB 마이그레이션 적용 (`npx supabase db push`)
- [x] ProcessingRecord 타입 추가
- [x] 가공 처리 모달 UI
- [x] handleProcessSave() 함수
- [x] handleProcessCancel() 함수
- [x] 가공 처리 이력 섹션
- [x] ⚙️ 가공 처리 버튼 추가
- [x] 취소 버튼 + 롤백 로직

### ❓ 테스트 필요
- [ ] 가공 처리 저장 → 재고 변화 확인
- [ ] 가공 취소 → 재고 원복 확인
- [ ] 산출품 자동 등록 확인
- [ ] JSONB inputs 저장 확인
- [ ] 여러 원물 투입 확인
- [ ] KST 시간 저장 확인

### 🚀 차기 기능
- [ ] 재고 하한선 체크
- [ ] 가공 이력 보고서
- [ ] 가공 템플릿
- [ ] 수율 추적

---

**문서 작성일**: 2026-03-08  
**마지막 수정**: 2026-03-08  
**작업 상태**: ✅ 완성
