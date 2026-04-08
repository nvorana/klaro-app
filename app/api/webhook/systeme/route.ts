import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Tag → access_level mapping
const TAG_TO_ACCESS: Record<string, string> = {
  'klaro-tier1': 'tier1',
  'klaro-tier2': 'tier2',
  'klaro-tier3': 'tier3',
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
    const accessLevel = TAG_TO_ACCESS[normalizeTag(rawTag)]

    if (!accessLevel) {
      // Not a KLARO tag — ignore silently (Systeme.io may fire for other tags)
      console.log('[Webhook] Ignoring non-KLARO tag:', rawTag)
      return NextResponse.json({ ignored: true, tag: rawTag }, { status: 200 })
    }

    // ── 5. Find user by email ────────────────────────────────────
    const adminClient = createAdminClient()

    const { data: authUser, error: authError } = await adminClient.auth.admin.listUsers()
    if (authError) throw authError

    const matchedUser = authUser.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!matchedUser) {
      // Student hasn't signed up yet — store the tag for when they do
      console.warn('[Webhook] No KLARO account found for email:', email)
      return NextResponse.json({
        status: 'no_account',
        message: 'No KLARO account found for this email. Access will apply once they sign up.',
        email,
        accessLevel,
      }, { status: 200 })
    }

    // ── 6. Update access_level ───────────────────────────────────
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        access_level: accessLevel,
        enrolled_at: new Date().toISOString(),
      })
      .eq('id', matchedUser.id)

    if (updateError) throw updateError

    console.log(`[Webhook] ✅ ${email} → ${accessLevel}`)
    return NextResponse.json({
      success: true,
      email,
      tag: rawTag,
      accessLevel,
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
