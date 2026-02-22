-- [농장 관리 권한 보강] 🍓
-- 관리자(admin)가 모든 농장 정보를 수정할 수 있도록 정책 업데이트

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "Users can manage their own farms" ON public.farms;
DROP POLICY IF EXISTS "Farms are viewable by everyone" ON public.farms;
DROP POLICY IF EXISTS "Individual users can manage their own farms." ON public.farms;
DROP POLICY IF EXISTS "Public farms are viewable by everyone." ON public.farms;

-- 2. 조회 정책: 모든 인증된 사용자는 농장 목록을 볼 수 있음 (또는 전체 공개)
CREATE POLICY "Anyone can view farms."
ON public.farms FOR SELECT
USING (true);

-- 3. 관리/수정 정책: 소유자 또는 관리자(admin)만 가능
CREATE POLICY "Owners and admins can manage farms."
ON public.farms FOR ALL
USING (
    auth.uid() = owner_id OR 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    auth.uid() = owner_id OR 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

RAISE NOTICE '성공: 농장 테이블의 보안 정책이 관리자 권한을 포함하도록 업데이트되었습니다.';
