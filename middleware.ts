import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = [
    '/harvest', '/finance', '/labor', '/attendance',
    '/bulk', '/sales', '/courier', '/clients',
    '/workers', '/expenses', '/other-income',
    '/settled', '/b2c-settled', '/crops', '/settings',
    '/admin',
]

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const isProtected = protectedRoutes.some(r => pathname.startsWith(r))
    if (!isProtected) return NextResponse.next()

    const response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    return response
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)',
    ],
}
