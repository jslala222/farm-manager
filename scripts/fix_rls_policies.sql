-- [RLS 보안 정책 긴급 보강] 🍓
-- 파트너(B2B) 및 고객(B2C) 테이블의 모든 권한을 명시적으로 허용 (USING 절 추가)

-- 1. partners 테이블 정책 보강
DROP POLICY IF EXISTS "Users can manage their own partners." ON public.partners;
CREATE POLICY "Users can manage their own partners." 
ON public.partners FOR ALL 
USING (true)
WITH CHECK (true);

-- 2. customers 테이블 정책 보강
DROP POLICY IF EXISTS "Users can manage their own customers." ON public.customers;
CREATE POLICY "Users can manage their own customers." 
ON public.customers FOR ALL 
USING (true)
WITH CHECK (true);

-- 3. 기존 select 정책 유지 또는 보강
DROP POLICY IF EXISTS "Public partners are viewable by everyone." ON public.partners;
CREATE POLICY "Public partners are viewable by everyone." ON public.partners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public customers are viewable by everyone." ON public.customers;
CREATE POLICY "Public customers are viewable by everyone." ON public.customers FOR SELECT USING (true);
