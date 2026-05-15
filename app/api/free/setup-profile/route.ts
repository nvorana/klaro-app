import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/free/setup-profile
//
// Called by the /free signup page right after supabase.auth.signUp succeeds.
// Uses the admin client to atomically set the new user's profile to
// access_level = 'lite_workshop' (RLS often blocks clients from updating
// privileged columns like access_level, which would otherwise leave the
// user stuck on access_level = 'pending' and bounce them to /signup).
//
// This endpoint trusts the caller's auth session — it only modifies the
// row matching auth.uid().

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const firstName = (body.firstName ?? '').toString().trim()
    const lastName = (body.lastName ?? '').toString().trim()
    const fullName = `${firstName} ${lastName}`.trim()

    const admin = createAdminClient()

    // Look at the existing row first so we never DOWNGRADE someone who
    // already has paid access (e.g. they previously bought, now signed
    // up via /free with the same email).
    const { data: existing } = await admin
      .from('profiles')
      .select('access_level, role')
      .eq('id', user.id)
      .maybeSingle()

    const currentAccess = (existing as { access_level?: string } | null)?.access_level
    const paidLevels = ['enrolled', 'full_access', 'tier2', 'tier3', 'tier4']

    // If they're already on a paid tier, don't touch access_level — just
    // keep their name fields fresh and return success.
    if (currentAccess && paidLevels.includes(currentAccess)) {
      await admin.from('profiles').update({
        full_name: fullName || (existing as { full_name?: string }).full_name,
        first_name: firstName || null,
        last_name: lastName || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      return NextResponse.json({ ok: true, access_level: currentAccess, preserved: true })
    }

    // Otherwise upgrade them to lite_workshop. Using upsert with onConflict
    // so this works whether the row was auto-created by an auth trigger or
    // doesn't yet exist.
    const { error } = await admin.from('profiles').upsert({
      id: user.id,
      email: (user.email ?? '').toLowerCase(),
      full_name: fullName || null,
      first_name: firstName || null,
      last_name: lastName || null,
      role: 'student',
      access_level: 'lite_workshop',
      enrolled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (error) {
      console.error('[free/setup-profile] upsert failed:', error.message)
      return NextResponse.json({ error: 'setup_failed', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, access_level: 'lite_workshop' })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[free/setup-profile]', detail)
    return NextResponse.json({ error: 'setup_failed', detail }, { status: 500 })
  }
}
