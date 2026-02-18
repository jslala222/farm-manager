-- ============================================
-- 딸기농장 관리 SaaS - 전체 DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 사용자 프로필 (Auth 연동)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role text DEFAULT 'owner' CHECK (role IN ('admin', 'owner')),
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- 2. 농장 기본 정보
CREATE TABLE IF NOT EXISTS farms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_name text NOT NULL,
  business_number text,          -- 사업자번호 (선택)
  phone text,                    -- 핸드폰 또는 대표번호
  fax text,                      -- 팩스번호 (선택)
  email text,                    -- 이메일
  address text,                  -- 농장 주소
  notes text,                    -- 특이사항
  is_active boolean DEFAULT false, -- 관리자 승인 여부 (기본: 미승인)
  created_at timestamptz DEFAULT now()
);

-- 3. 하우스 동 관리 (동적 추가/수정/삭제)
CREATE TABLE IF NOT EXISTS farm_houses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id uuid REFERENCES farms(id) ON DELETE CASCADE,
  house_number int NOT NULL,
  house_name text,               -- 동 별칭 (예: "신축동")
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(farm_id, house_number)
);

-- 4. 수확 기록
CREATE TABLE IF NOT EXISTS harvest_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id uuid REFERENCES farms(id) ON DELETE CASCADE NOT NULL,
  house_number int NOT NULL,
  grade text NOT NULL CHECK (grade IN ('sang', 'jung', 'ha')),
  quantity int NOT NULL CHECK (quantity > 0),
  recorded_at timestamptz DEFAULT now()
);

-- 5. 판매 기록
CREATE TABLE IF NOT EXISTS sales_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id uuid REFERENCES farms(id) ON DELETE CASCADE NOT NULL,
  sale_type text NOT NULL CHECK (sale_type IN ('nonghyup', 'jam', 'etc')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  price int,
  customer_name text,
  address text,
  recorded_at timestamptz DEFAULT now()
);

-- 6. 출근 기록
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id uuid REFERENCES farms(id) ON DELETE CASCADE NOT NULL,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  worker_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('family', 'foreign', 'part_time')),
  is_present boolean DEFAULT true,
  recorded_at timestamptz DEFAULT now()
);

-- 7. 근로자 테이블 (관리용)
CREATE TABLE IF NOT EXISTS workers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id uuid REFERENCES farms(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('family', 'foreign', 'part_time')),
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(farm_id, name)
);

-- 8. 지출 기록 테이블
CREATE TABLE IF NOT EXISTS expenditures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id uuid REFERENCES farms(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL, -- 비료, 인건비, 자재, 전기세 등
  amount numeric NOT NULL CHECK (amount >= 0),
  notes text,
  expense_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- 기존 출근 기록 테이블에 근로자 ID 연결 (추후 확장용)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES workers(id) ON DELETE SET NULL;

-- ============================================
-- RLS (Row Level Security) 설정
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 조회/수정
CREATE POLICY "본인 프로필 조회" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "본인 프로필 수정" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "프로필 생성" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- farms: 농장주는 자기 농장만, 관리자는 전체
CREATE POLICY "농장주 본인 농장 조회" ON farms FOR SELECT
  USING (owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));
CREATE POLICY "농장주 본인 농장 수정" ON farms FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "농장 등록" ON farms FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "관리자 농장 수정" ON farms FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- farm_houses: 본인 농장 동만
CREATE POLICY "본인 농장 동 접근" ON farm_houses FOR ALL
  USING (farm_id IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- harvest_records: 본인 농장 데이터만
CREATE POLICY "본인 수확 기록" ON harvest_records FOR ALL
  USING (farm_id IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- sales_records: 본인 농장 데이터만
CREATE POLICY "본인 판매 기록" ON sales_records FOR ALL
  USING (farm_id IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- attendance_records: 본인 농장 데이터만
CREATE POLICY "본인 출근 기록" ON attendance_records FOR ALL
  USING (farm_id IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- workers: 본인 농장 데이터만
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 근로자 관리" ON workers FOR ALL
  USING (farm_id IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- expenditures: 본인 농장 데이터만
ALTER TABLE expenditures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 지출 기록" ON expenditures FOR ALL
  USING (farm_id IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ============================================
-- 자동 프로필 생성 트리거 (회원가입 시 자동 실행)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
