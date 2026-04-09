import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Tag → { access_level, unlocked_modules }
const TAG_TO_ACCESS: Record<string, { access_level: string; unlocked_modules: number[] }> = {
  'topis-student':  { access_level: 'enrolled', unlocked_modules: [1, 2] },
  'accel-enrolled': { access_level: 'enrolled', unlocked_modules: [1, 2] },
  'klaro-tier1':    { access_level: 'tier1',    unlocked_modules: [1] },
  'klaro-tier2':    { access_level: 'tier2',    unlocked_modules: [1, 2, 3] },
  'klaro-tier3':    { access_level: 'tier3',    unlocked_modules: [1, 2, 3, 4, 5, 6] },
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Verify webhook secret ─────────────────────────────────
    const secret = request.nextUrl.searchParams.get('secret')
    const expectedSecret = process.env.WEBHOOK_SECRET

    if (!expectedSecret) {
      console.error('[Webhook] WEBHOOK_SECRET env var not set')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    if (secret !== expectedSecret) {
      console.warn('[Webhook] Invalid secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Parse body ────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // ── 3. Extract email + tag (handles multiple Systeme.io formats)
    const email =
      (body.email as string) ||
      (body.contact_email as string) ||
      ((body.contact as Record<string, unknown>)?.email as string) ||
      ((body.data as Record<string, unknown>)?.contact as Record<string, unknown>)?.email as string

    const rawTag =
      (body.tag as string) ||
      (body.tag_name as string) ||
      ((body.data as Record<string, unknown>)?.tag as Record<string, unknown>)?.name as string ||
      ((body.data as Record<string, unknown>)?.tag as string)

    if (!email || !rawTag) {
      console.warn('[Webhook] Missing email or tag', { email, rawTag, body })
      return NextResponse.json({ error: 'Missing email or tag', received: body }, { status: 400 })
    }

    // ── 4. Map tag to access level ───────────────────────────────
    const tagMapping = TAG_TO_ACCESS[normalizeTag(rawTag)]

    if (!tagMapping) {
      // Not a KLARO tag — ignore silently (Systeme.io may fire for other tags)
      console.log('[Webhook] Ignoring non-KLARO tag:', rawTag)
      return NextResponse.json({ ignored: true, tag: rawTag }, { status: 200 })
    }

    const { access_level: accessLevel, unlocked_modules: unlockedModules } = tagMapping

    // ── 5. Find user by email ────────────────────────────────────
    const adminClient = createAdminClient()

    const { data: authUser, error: authError } = await adminClient.auth.admin.listUsers()
    if (authError) throw authError

    const matchedUser = authUser.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!matchedUser) {
      console.warn('[Webhook] No KLARO account found for email:', email)
      return NextResponse.json({
        status: 'no_account',
        message: 'No KLARO account found for this email. Access will apply once they sign up.',
        email,
        accessLevel,
      }, { status: 200 })
    }

    // ── 6. Update access_level + unlocked_modules ────────────────
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        access_level: accessLevel,
        unlocked_modules: unlockedModules,
        enrolled_at: new Date().toISOString(),
      })
      .eq('id', matchedUser.id)

    if (updateError) throw updateError

    console.log(`[Webhook] ✅ ${email} → ${accessLevel}, modules: ${unlockedModules}`)
    return NextResponse.json({
      success: true,
      email,
      tag: rawTag,
      accessLevel,
      unlockedModules,
    }, { status: 200 })

  } catch (err) {
    console.error('[Webhook] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Systeme.io may send a GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'KLARO webhook endpoint active' }, { status: 200 })
}
