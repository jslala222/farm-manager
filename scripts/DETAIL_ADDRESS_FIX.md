# 🍓 [bkit] 수파베이스 상세 주소 필드 긴급 진단 및 복구

사장님! 수파베이스를 정밀 진단한 결과입니다.

## 1. 현재 상태 (진단 결과)
- **개인 고객 (B2C)**: `detail_address` (나머지 주소) 필드가 잘 있습니다! ✅
- **판매 기록 (Sales)**: `detail_address` (나머지 주소) 필드가 잘 있습니다! ✅
- **거래처 (B2B)**: 우편번호는 만들어져 있지만, **상세 주소(나머지 주소) 칸이 누락**되어 있습니다. ❌ (어제 작업 시 이 부분만 살짝 빠진 것 같습니다.)

## 2. 해결 방법 (복구 전용 SQL)
누락된 B2B 상세 주소 칸만 안전하게 추가해 드립니다. 아래 내용을 복사해서 **Supabase SQL Editor**에 붙여넣고 [Run]을 눌러주세요!

```sql
-- [bkit] B2B 거래처 전용 나머지 주소 필드 복구
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS hq_detail_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_detail_address TEXT;

-- 주석 추가
COMMENT ON COLUMN public.partners.hq_detail_address IS '본사 나머지 주소';
COMMENT ON COLUMN public.partners.delivery_detail_address IS '납품지 나머지 주소';
```

## 3. 코드 연동 상태
사장님이 말씀하신 대로 프로그램(코드) 내에서는 이미 이 필드들을 사용할 준비가 완벽히 끝났습니다. 위 SQL만 한번 실행해 주시면 즉시 주소 입력 시 나머지 주소까지 안전하게 저장됩니다!

사장님, 바로 적용해 보시고 안 되시면 말씀해 주세요. 제가 끝까지 책임지고 고쳐드리겠습니다! 🫡
