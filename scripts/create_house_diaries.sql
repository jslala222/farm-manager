-- 🍓 현장 일지(하우스 다이어리) 테이블 생성 SQL 🍓
-- ----------------------------------------------------------------
-- [1] house_diaries 테이블 생성
CREATE TABLE IF NOT EXISTS public.house_diaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    house_number INTEGER NOT NULL,
    date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(farm_id, house_number, date) -- 특정 날짜/동에는 오직 하나의 일지만 존재하도록 강제
);

-- [2] 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_house_diaries_farm_date ON public.house_diaries(farm_id, date);

-- [3] 컬럼 설명 추가
COMMENT ON TABLE public.house_diaries IS '하우스별/날짜별 현장 일지 (수확 기록과 분리된 독립 데이터)';
COMMENT ON COLUMN public.house_diaries.note IS '해당 동의 당일 특이사항 및 작업 메모';

-- [4] RLS 정책 설정 (기존 테이블 정책 참고하여 farm_id 기반 접근 제어)
ALTER TABLE public.house_diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow owners and admins to manage diaries" ON public.house_diaries
    FOR ALL USING (
        farm_id IN (
            SELECT id FROM farms WHERE owner_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );
