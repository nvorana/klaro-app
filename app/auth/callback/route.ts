import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Auth Callback ────────────────────────────────────────────────────────────
//
// Supabase sends email links (password reset, email confirm, magic link) using
// the PKCE flow — they include a `?code=ABC123` parameter that has to be
// exchanged server-side for a real session before we can do anything with it.
//
// Without this route, every recovery email link silently breaks: the user
// lands on /reset-password but no session is established, so the page shows
// "Link invalid or expired" after a 3-second timeout. (Reported in production
// as "problem loading".)
//
// Flow:
//   1. User clicks email link  → /auth/callback?code=ABC&next=/reset-password
//   2. We exchange the code   → session is established (cookies set)
//   3. Redirect to `next`     → /reset-password
//   4. The page sees a valid session and shows the form

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'
  const errorDescription = url.searchParams.get('error_description')

  // Forward Supabase-side errors (e.g. expired link) to the destination page
  // as a hash fragment so the existing reset-password handler can pick them up.
  if (errorDescription) {
    const dest = new URL(next, request.url)
    dest.hash = `error_description=${encodeURIComponent(errorDescription)}`
    return NextResponse.redirect(dest)
  }

  if (!code) {
    // No code present — link is malformed. Send to the destination anyway
    // so the page can show its own error state.
    return NextResponse.redirect(new URL(next, request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] code exchange failed:', error.message)
    const dest = new URL(next, request.url)
    dest.hash = `error_description=${encodeURIComponent(error.message)}`
    return NextResponse.redirect(dest)
  }

  return NextResponse.redirect(new URL(next, request.url))
}
