import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Skip auth check for webhook endpoint
  if (request.nextUrl.pathname.startsWith('/api/webhooks')) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtectedPage = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/module') ||
    request.nextUrl.pathname.startsWith('/coach') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/progress') ||
    request.nextUrl.pathname.startsWith('/my-work') ||
    request.nextUrl.pathname.startsWith('/admin')

  // Redirect unauthenticated users to login
  if (!user && isProtectedPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Force password change for coaches (or anyone) created with a temp password
  const mustChangePassword = user?.user_metadata?.must_change_password === true
  const isOnChangePassword = request.nextUrl.pathname.startsWith('/change-password')

  if (user && mustChangePassword && !isOnChangePassword) {
    return NextResponse.redirect(new URL('/change-password', request.url))
  }

  // ── 90-day access expiry check (students only) ──────────────
  const isOnExpiredPage = request.nextUrl.pathname.startsWith('/access-expired')

  if (user && isProtectedPage && !isOnExpiredPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, created_at, enrolled_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role === 'student') {
      const startDate = profile.created_at ?? profile.enrolled_at
      if (startDate) {
        const expiryMs = new Date(startDate).getTime() + 90 * 24 * 60 * 60 * 1000
        if (Date.now() > expiryMs) {
          return NextResponse.redirect(new URL('/access-expired', request.url))
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
