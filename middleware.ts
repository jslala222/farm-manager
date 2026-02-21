import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const { pathname } = request.nextUrl;

    // 공개 경로 및 접근 허용 경로
    const publicPaths = ['/login', '/register', '/pending'];

    if (publicPaths.includes(pathname)) {
        // 이미 로그인된 유저가 로그인/회원가입 페이지에 접근하면 상황에 따라 리다이렉트
        if (user && pathname !== '/pending') {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return response;
    }

    // 로그인 안 된 경우 → 로그인 페이지로
    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // [강력한 보안 체크] 유저 프로필 및 농장 활성 상태 확인
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    // 관리자가 아닌 경우 농장 상태 체크
    if (profile?.role !== 'admin') {
        const { data: farm } = await supabase
            .from('farms')
            .select('is_active')
            .eq('owner_id', user.id)
            .maybeSingle();

        // 농장이 없거나 비활성 상태인 경우
        if (!farm || !farm.is_active) {
            // /pending 페이지가 아닌 다른 모든 곳에서 접근 시 차단
            if (pathname !== '/pending') {
                return NextResponse.redirect(new URL('/pending', request.url));
            }
        } else {
            // 승인된 유저가 /pending에 있으면 홈으로
            if (pathname === '/pending') {
                return NextResponse.redirect(new URL('/', request.url));
            }
        }
    }

    // 관리자 전용 경로 체크 (이미 위에서 admin 여부는 확인했으나 경로 보호)
    if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
