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

  // Force password change for coaches (or anyone) created with a temp password.
  // But allow the user to be on any password-related page so they're not trapped.
  const mustChangePassword = user?.user_metadata?.must_change_password === true
  const isOnPasswordFlow =
    request.nextUrl.pathname.startsWith('/change-password') ||
    request.nextUrl.pathname.startsWith('/reset-password') ||
    request.nextUrl.pathname.startsWith('/forgot-password')

  if (user && mustChangePassword && !isOnPasswordFlow) {
    return NextResponse.redirect(new URL('/change-password', request.url))
  }

  // ── 90-day access expiry check + orphan-tag claim (students only) ──────────
  const isOnExpiredPage = request.nextUrl.pathname.startsWith('/access-expired')

  if (user && isProtectedPage && !isOnExpiredPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, access_level, created_at, enrolled_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role === 'student') {
      // Orphan-tag claim: if a Systeme.io tag fired before this user signed
      // up, our handler logged a *_pending_signup_* row but couldn't update
      // a profile that didn't exist. Now that the profile exists and we see
      // it's still pending, retroactively apply the access. One-time per
      // user — the function records a claimed_by_signup audit row to skip
      // future calls.
      if (profile.access_level === 'pending' && user.email) {
        try {
          const { claimPendingTagsForUser } = await import('@/lib/claimPendingTags')
          await claimPendingTagsForUser(user.id, user.email)
        } catch (err) {
          console.error('[middleware] claim pending tags failed:', err)
        }
      }

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
