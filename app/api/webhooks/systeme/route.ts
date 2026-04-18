import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Systeme.io Webhook Handler ───────────────────────────────────────────────
//
// Listens for "contact.tag_added" and "contact.tag_removed" events.
//
// TOPIS tag patterns (batch number is embedded, e.g. TOPIS-77-UNSETTLED):
//   TOPIS-Student              → enroll as TOPIS, set access_level = 'enrolled'
//   TOPIS-[N]-UNSETTLED        → suspend access (missed 2nd or 3rd payment)
//   TOPIS-[N]-2nd-Pay-Settled  → restore access (2nd payment received)
//   TOPIS-[N]-Full-Payment     → restore access, mark fully paid
//
// Legacy KLARO tags (kept for backwards compatibility):
//   KLARO-FULLPAY     → full_access
//   KLARO-ENROLLED    → enrolled
// ─────────────────────────────────────────────────────────────────────────────

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
    const payload = await request.json()
    const supabase = createAdminClient()

    const email      = payload?.contact?.email as string | undefined
    const tagName    = payload?.tag?.name     as string | undefined
    const eventType  = payload?.event_type    as string | undefined

    // Always log every incoming webhook
    await supabase.from('webhook_logs').insert({
      payload,
      tag_name:        tagName,
      contact_email:   email,
      action:          'received',
    })

    if (!email || !tagName || !eventType) {
      return NextResponse.json({ error: 'Missing email, tag, or event_type' }, { status: 400 })
    }

    // ── Helper: look up profile by email ────────────────────────────────────
    async function getProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('id, enrolled_at, access_level')
        .eq('email', email)
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
    const isAdded   = eventType === 'contact.tag_added'
    const isRemoved = eventType === 'contact.tag_removed'

    // ── TOPIS-Student ────────────────────────────────────────────────────────
    // Enroll the student in the TOPIS program when they first get this tag
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
      } else {
        await logAction('topis_enrolled_pending_signup')
      }
      return NextResponse.json({ success: true })
    }

    // ── Accel-Enrolled ─────────────────────────────────────────────────────
    // Enroll student in the Accelerator Program, auto-assign to coach Edgar
    const EDGAR_COACH_ID = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442'

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
        // Don't downgrade access_level if they already have tier access
        if (!profile.access_level || profile.access_level === 'pending') {
          updates.access_level = 'enrolled'
        }
        await supabase.from('profiles').update(updates).eq('id', profile.id)
        await logAction('accelerator_enrolled')
      } else {
        await logAction('accelerator_enrolled_pending_signup')
      }
      return NextResponse.json({ success: true })
    }

    // ── TOPIS-[N]-UNSETTLED ──────────────────────────────────────────────────
    // Tag ADDED → suspend access (missed 2nd or 3rd payment)
    // Tag REMOVED → restore access (payment was settled)
    if (topis.isUnsettled) {
      const profile = await getProfile()
      if (profile) {
        const updates: Record<string, unknown> = {
          access_suspended: isAdded,
          updated_at:       new Date().toISOString(),
        }
        // Also store batch number when we first see it
        if (topis.batchNumber) {
          updates.cohort_batch = topis.batchNumber
        }
        await supabase.from('profiles').update(updates).eq('id', profile.id)
        await logAction(isAdded ? 'access_suspended_unsettled' : 'access_restored_unsettled_removed')
      } else {
        await logAction(isAdded ? 'suspend_pending_signup' : 'restore_pending_signup')
      }
      return NextResponse.json({ success: true })
    }

    // ── TOPIS-[N]-2nd-Pay-Settled ────────────────────────────────────────────
    // 2nd payment received — restore access
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

    // ── TOPIS-[N]-Full-Payment ───────────────────────────────────────────────
    // Fully paid — restore access and mark as full_access
    if (topis.isFullPay && isAdded) {
      const profile = await getProfile()
      if (profile) {
        await supabase
          .from('profiles')
          .update({
            access_level:     'full_access',
            access_suspended: false,
            cohort_batch:     topis.batchNumber ?? undefined,
            full_access_granted_at: new Date().toISOString(),
            updated_at:       new Date().toISOString(),
          })
          .eq('id', profile.id)
        await logAction('access_restored_full_payment')
      } else {
        await logAction('full_payment_pending_signup')
      }
      return NextResponse.json({ success: true })
    }

    // ── Klaro Tier Tags ──────────────────────────────────────────────────────
    // Klaro-tier1 → access_level = 'tier1' (Module 1 only)
    // Klaro-tier2 → access_level = 'tier2' (Modules 1–3)
    // Klaro-tier3 → access_level = 'tier3' (All modules)
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

    // ── Legacy: KLARO-FULLPAY ────────────────────────────────────────────────
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
    }

    // ── Legacy: KLARO-ENROLLED ───────────────────────────────────────────────
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
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
