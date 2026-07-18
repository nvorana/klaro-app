// ─── API Route Auth Guard ─────────────────────────────────────────────────────
//
// Every AI-generation route MUST call requireUser() before touching OpenAI.
// Without it the route accepts anonymous POSTs — anyone with the URL can burn
// OpenAI credits in a loop (this was the case for 15 of 17 generate routes
// until 2026-07-17).
//
// Usage in a route handler:
//
//   const auth = await requireUser()
//   if (!auth.ok) return auth.response
//   // auth.user is the authenticated Supabase user
//
// The guard checks, in order:
//   1. Valid session (401 if not)
//   2. Account not suspended (403) — access_suspended payment hold
//   3. Access not expired (403) — same window the middleware enforces on
//      pages; without this an expired student with a live session could keep
//      generating via direct API calls.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import { isAccessExpired } from '@/lib/accessExpiry'

export type RequireUserResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, access_suspended, access_expires_at, created_at, enrolled_at')
    .eq('id', user.id)
    .maybeSingle()

  // Coaches/admins are never suspended or expired.
  if (profile && profile.role !== 'coach' && profile.role !== 'admin') {
    if (profile.access_suspended) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Account on hold' }, { status: 403 }),
      }
    }
    if (isAccessExpired(profile)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Access expired' }, { status: 403 }),
      }
    }
  }

  return { ok: true, user }
}
