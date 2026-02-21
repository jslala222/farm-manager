-- [1] 향후 가입되는 모든 계정의 이메일 인증을 SQL 차원에서 자동 완료 처리하는 트리거
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_email()
RETURNS TRIGGER AS $$
BEGIN
  -- 신규 가입 시 이메일 인증 절차를 건너뛸 수 있도록 원본 데이터를 업데이트합니다.
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 설정 (기존 트리거 삭제 후 재생성)
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auto_confirm_email();

-- [2] 관리자 화면에서 '승인' 버튼 클릭 시 자동으로 실행될 원클릭 인증 함수
CREATE OR REPLACE FUNCTION public.force_confirm_user(target_email TEXT)
RETURNS VOID AS $$
BEGIN
  -- 이메일로 찾거나, 이메일이 없으면 owner_id(ID)로 찾아서 인증 처리합니다.
  UPDATE auth.users 
  SET email_confirmed_at = NOW() 
  WHERE email = target_email OR id::text = target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [3] 윤희라님 계정 즉시 복구 (관리자 서비스)
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = 'heerayun0712@gmail.com';

-- [3] 트리거 설정 (기존에 있다면 삭제 후 재생성)
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auto_confirm_email();

-- [4] 농장 정보가 있는 경우 승인 완료 처리 (테스트 편의용)
UPDATE public.farms 
SET is_active = true 
WHERE owner_id IN (SELECT id FROM auth.users WHERE email = 'heerayun0712@gmail.com');
