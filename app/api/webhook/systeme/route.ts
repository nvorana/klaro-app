import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Systeme.io Webhook Handler (LIVE endpoint) ─────────────────────────────
//
// URL: /api/webhook/systeme?secret=klaro-webhook-2025
//
// Handles both Systeme.io payload formats:
//   Format A: { contact: { email }, tag: { name }, event_type }
//   Format B: { email, tag, data: { tag: { name }, contact: { email } } }
//
// Supported tags:
//   TOPIS-Student              → enroll as TOPIS, assign to Edgar
//   TOPIS-[N]-UNSETTLED        → suspend access
//   TOPIS-[N]-2nd-Pay-Settled  → restore access
//   TOPIS-[N]-Full-Payment     → full access
//   Accel-Enrolled             → enroll in Accelerator Program
//   Klaro-tier1/tier2/tier3    → set tier access
//   KLARO-FULLPAY              → full_access (legacy)
//   KLARO-ENROLLED             → enrolled (legacy)
// ─────────────────────────────────────────────────────────────────────────────

const EDGAR_COACH_ID = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442'

function extractBatchNumber(tagName: string): number | null {
  const match = tagName.match(/^TOPIS-(\d+)-/i)
  return match ? parseInt(match[1]) : null
}

function detectTopisTag(tagName: string) {
  return {
    isStudent:   /^TOPIS-Student$/i.test(tagName),
    isUnsettled: /^TOPIS-\d+-UNSETTLED$/i.test(tagName),
    is2ndPay:    /^TOPIS-\d+-2nd-Pay-Settled$/i.test(tagName),
    isFullPay:   /^TOPIS-\d+-Full-Payment$/i.test(tagName),
    batchNumber: extractBatchNumber(tagName),
  }
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
    let payload: Record<string, unknown>
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // ── 3. Extract email + tag (handles multiple Systeme.io formats) ──
    const email = (
      (payload.contact as Record<string, unknown>)?.email ??
      payload.email ??
      payload.contact_email ??
      ((payload.data as Record<string, unknown>)?.contact as Record<string, unknown>)?.email
    ) as string | undefined

    const tagName = (
      (payload.tag as Record<string, unknown>)?.name ??
      payload.tag_name ??
      payload.tag ??
      ((payload.data as Record<string, unknown>)?.tag as Record<string, unknown>)?.name ??
      (payload.data as Record<string, unknown>)?.tag
    ) as string | undefined

    const eventType = (
      payload.event_type ??
      payload.event ??
      'contact.tag_added'  // Default to tag_added if not specified
    ) as string

    // Always log every incoming webhook
    await supabase.from('webhook_logs').insert({
      payload,
      tag_name:      tagName ?? null,
      contact_email: email ?? null,
      action:        'received',
    })

    if (!email || !tagName) {
      console.warn('[Webhook] Missing email or tag', { email, tagName, payload })
      return NextResponse.json({ error: 'Missing email or tag' }, { status: 400 })
    }

    // ── Helpers ──────────────────────────────────────────────────
    async function getProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('id, enrolled_at, access_level')
        .eq('email', email as string)
        .maybeSingle()
      return data
    }

    async function logAction(action: string) {
      await supabase.from('webhook_logs').insert({
        payload,
        tag_name:      tagName,
        contact_email: email,
        action,
      })
    }

    const topis = detectTopisTag(tagName)
    const isAdded   = eventType.includes('added') || eventType === 'contact.tag_added'
    const isRemoved = eventType.includes('removed') || eventType === 'contact.tag_removed'

    // ── TOPIS-Student ────────────────────────────────────────────
    if (topis.isStudent && isAdded) {
      const profile = await getProfile()
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            program_type:     'topis',
            access_level:     'enrolled',
            enrolled_at:      profile.enrolled_at || new Date().toISOString(),
            access_suspended: false,
            updated_at:       new Date().toISOString(),
          })
          .eq('id', profile.id)
        await logAction('topis_enrolled')
        console.log(`[Webhook] TOPIS enrolled: ${email}`)
      } else {
        await logAction('topis_enrolled_pending_signup')
        console.log(`[Webhook] TOPIS tag received but no account yet: ${email}`)
      }
      return NextResponse.json({ success: true, action: 'topis_enrolled' })
    }

    // ── Accel-Enrolled ───────────────────────────────────────────
    if (/^Accel-Enrolled$/i.test(tagName) && isAdded) {
      const profile = await getProfile()
      if (profile) {
        const updates: Record<string, unknown> = {
          program_type:     'accelerator',
          coach_id:         EDGAR_COACH_ID,
          enrolled_at:      profile.enrolled_at || new Date().toISOString(),
          access_suspended: false,
          updated_at:       new Date().toISOString(),
        }
        if (!profile.access_level || profile.access_level === 'pending') {
          updates.access_level = 'enrolled'
        }
        await supabase.from('profiles').update(updates).eq('id', profile.id)
        await logAction('accelerator_enrolled')
        console.log(`[Webhook] Accelerator enrolled: ${email}`)
      } else {
        await logAction('accelerator_enrolled_pending_signup')
      }
      return NextResponse.json({ success: true, action: 'accelerator_enrolled' })
    }

    // ── TOPIS-[N]-UNSETTLED ──────────────────────────────────────
    if (topis.isUnsettled) {
      const profile = await getProfile()
      if (profile) {
        const updates: Record<string, unknown> = {
          access_suspended: isAdded,
          updated_at:       new Date().toISOString(),
        }
        if (topis.batchNumber) updates.cohort_batch = topis.batchNumber
        await supabase.from('profiles').update(updates).eq('id', profile.id)
        await logAction(isAdded ? 'access_suspended_unsettled' : 'access_restored_unsettled_removed')
      } else {
        await logAction(isAdded ? 'suspend_pending_signup' : 'restore_pending_signup')
      }
      return NextResponse.json({ success: true })
    }

    // ── TOPIS-[N]-2nd-Pay-Settled ────────────────────────────────
    if (topis.is2ndPay && isAdded) {
      const profile = await getProfile()
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            access_suspended: false,
            cohort_batch:     topis.batchNumber ?? undefined,
            updated_at:       new Date().toISOString(),
          })
          .eq('id', profile.id)
        await logAction('access_restored_2nd_pay_settled')
      } else {
        await logAction('2nd_pay_settled_pending_signup')
      }
      return NextResponse.json({ success: true })
    }

    // ── TOPIS-[N]-Full-Payment ───────────────────────────────────
    if (topis.isFullPay && isAdded) {
      const profile = await getProfile()
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            access_level:           'full_access',
            access_suspended:       false,
            cohort_batch:           topis.batchNumber ?? undefined,
            full_access_granted_at: new Date().toISOString(),
            updated_at:             new Date().toISOString(),
          })
          .eq('id', profile.id)
        await logAction('access_restored_full_payment')
      } else {
        await logAction('full_payment_pending_signup')
      }
      return NextResponse.json({ success: true })
    }

    // ── Klaro Tier Tags ──────────────────────────────────────────
    const TIER_MAP: Record<string, string> = {
      'klaro-tier1': 'tier1',
      'klaro-tier2': 'tier2',
      'klaro-tier3': 'tier3',
    }
    const tierLevel = TIER_MAP[tagName.toLowerCase()]
    if (tierLevel && isAdded) {
      const profile = await getProfile()
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            access_level:     tierLevel,
            enrolled_at:      profile.enrolled_at || new Date().toISOString(),
            access_suspended: false,
            updated_at:       new Date().toISOString(),
          })
          .eq('id', profile.id)
        await logAction(`tier_access_granted_${tierLevel}`)
      } else {
        await logAction(`tier_access_pending_signup_${tierLevel}`)
      }
      return NextResponse.json({ success: true })
    }

    // ── Legacy: KLARO-FULLPAY ────────────────────────────────────
    const ACCESS_TAG   = process.env.SYSTEME_ACCESS_TAG   || 'KLARO-FULLPAY'
    const ENROLLED_TAG = process.env.SYSTEME_ENROLLED_TAG || 'KLARO-ENROLLED'

    if (tagName === ACCESS_TAG) {
      if (isAdded) {
        const profile = await getProfile()
        if (profile) {
          await supabase
            .from('profiles')
            .update({
              access_level:           'full_access',
              full_access_granted_at: new Date().toISOString(),
              enrolled_at:            profile.enrolled_at || new Date().toISOString(),
              access_suspended:       false,
              updated_at:             new Date().toISOString(),
            })
            .eq('id', profile.id)
          await logAction('access_granted')
        } else {
          await logAction('access_granted_pending_signup')
        }
      }
      if (isRemoved) {
        await supabase
          .from('profiles')
          .update({ access_level: 'pending', updated_at: new Date().toISOString() })
          .eq('email', email)
        await logAction('access_revoked')
      }
      return NextResponse.json({ success: true })
    }

    // ── Legacy: KLARO-ENROLLED ───────────────────────────────────
    if (tagName === ENROLLED_TAG && isAdded) {
      const profile = await getProfile()
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            access_level: 'enrolled',
            enrolled_at:  new Date().toISOString(),
            updated_at:   new Date().toISOString(),
          })
          .eq('id', profile.id)
        await logAction('enrolled')
      }
      return NextResponse.json({ success: true })
    }

    // ── Unrecognized tag — log and ignore ─────────────────────────
    console.log('[Webhook] Ignoring unrecognized tag:', tagName)
    await logAction('ignored_unknown_tag')
    return NextResponse.json({ success: true, ignored: true, tag: tagName })

  } catch (error) {
    console.error('[Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Systeme.io may send a GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'KLARO webhook endpoint active' }, { status: 200 })
}
