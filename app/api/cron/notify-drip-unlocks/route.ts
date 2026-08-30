import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendModuleUnlockedEmail } from '@/lib/email/sendModuleUnlockedEmail'
import { isModuleUnlocked } from '@/lib/modules'
import { isAccessExpired } from '@/lib/accessExpiry'

// ── /api/cron/notify-drip-unlocks ────────────────────────────────────────────
//
// TOPIS students' modules unlock on a weekly drip computed at READ time
// (lib/modules.ts MODULE_UNLOCK_DAYS — day 0/7/14/21/28/35/42 from
// profiles.enrolled_at). No event fires when a module opens, so before this
// cron existed nobody was ever told a module unlocked. This runs daily and
// emails each TOPIS student whose drip has opened a module they haven't been
// notified about yet.
//
// Design:
//   - Catch-up-safe: instead of "what crossed a boundary in the last 24h"
//     (fragile if a run is missed), we compute "all modules drip-unlocked as
//     of NOW" minus "modules we already sent a notification for" (tracked in
//     webhook_logs). Missed runs self-heal on the next run.
//   - Idempotency ledger: one webhook_logs row per (email, module) with
//     action='drip_unlock_email_sent', tag_name='DRIP_UNLOCK', and
//     payload.module_number. Checked before every send.
//   - Module 1 is never notified (unlocks at day 0 — welcome email covers it).
//   - One email per student per run: if several modules are newly unlocked
//     (e.g. late activation), send ONE email for the HIGHEST newly-unlocked
//     module and log ALL of them as sent so they're never notified later.
//   - Skips: suspended, expired (lib/accessExpiry), test accounts.
//   - Rate limit: 600ms between Resend sends, plus a per-run send cap so we
//     stay inside maxDuration; the daily schedule drains any backlog.
//
// Security: same as sweep-pending — `Authorization: Bearer <CRON_SECRET>`
// header (Vercel cron) or `?secret=<CRON_SECRET>` query param (manual).

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_SENDS_PER_RUN = 100
const SEND_DELAY_MS = 600
const TEST_ACCOUNT_PATTERNS = [/^nvorana\+/i, /\+test\d*@/i]

function isTestAccount(email: string): boolean {
  return TEST_ACCOUNT_PATTERNS.some(p => p.test(email))
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization') ?? ''
  const querySecret = request.nextUrl.searchParams.get('secret') ?? ''
  if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_notify_drip_unlocks' })

  // All active TOPIS students on the drip
  const { data: students, error: studentsErr } = await admin
    .from('profiles')
    .select('id, email, first_name, full_name, access_level, enrolled_at, drip_anchor, created_at, access_expires_at, access_suspended')
    .eq('program_type', 'topis')
    .in('access_level', ['enrolled', 'full_access'])
    .not('drip_anchor', 'is', null)

  if (studentsErr) {
    return NextResponse.json({ error: studentsErr.message }, { status: 500 })
  }
  if (!students || students.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, emailed: 0, message: 'No TOPIS students' })
  }

  // Idempotency ledger: every drip-unlock notification ever sent.
  // One row per (contact_email, payload.module_number).
  const { data: sentLog, error: logErr } = await admin
    .from('webhook_logs')
    .select('contact_email, payload')
    .eq('action', 'drip_unlock_email_sent')

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 })
  }

  const alreadySent = new Set<string>() // "email|moduleNumber"
  for (const row of sentLog ?? []) {
    const email = (row.contact_email ?? '').toLowerCase()
    const moduleNumber = (row.payload as { module_number?: number | string } | null)?.module_number
    if (email && moduleNumber != null) alreadySent.add(`${email}|${Number(moduleNumber)}`)
  }

  const results: Array<{ email: string; modules: number[]; action: string; error?: string }> = []
  let emailed = 0
  let skipped = 0
  let errors = 0
  let capped = false

  for (const s of students) {
    const email = (s.email ?? '').trim()
    if (!email || isTestAccount(email)) { skipped++; continue }
    if (s.access_suspended === true) { skipped++; continue }
    if (isAccessExpired(s)) { skipped++; continue }

    // Modules 2..7 currently drip-unlocked but never notified.
    // (Module 1 unlocks at day 0 — the welcome email covers it.)
    const pending: number[] = []
    for (let m = 2; m <= 7; m++) {
      if (!isModuleUnlocked(s.drip_anchor, m)) continue
      if (alreadySent.has(`${email.toLowerCase()}|${m}`)) continue
      pending.push(m)
    }
    if (pending.length === 0) { skipped++; continue }

    if (emailed >= MAX_SENDS_PER_RUN) {
      capped = true
      break
    }

    // One email per student per run: notify only the HIGHEST newly-unlocked
    // module, but log every pending module as sent so late activations don't
    // get a backlog of emails on later runs.
    const highest = Math.max(...pending)
    const result = await sendModuleUnlockedEmail({
      email,
      firstName: s.first_name,
      fullName: s.full_name,
      moduleNumber: highest,
      source: 'drip',
    })

    if (result.sent) {
      emailed++
      const rows = pending.map(m => ({
        payload: { module_number: m, notified_via_module: highest, resend_id: result.resendId ?? null },
        tag_name: 'DRIP_UNLOCK',
        contact_email: email,
        action: 'drip_unlock_email_sent',
      }))
      const { error: insertErr } = await admin.from('webhook_logs').insert(rows)
      if (insertErr) {
        // Email went out but the ledger write failed — surface it loudly so
        // a duplicate on the next run can be traced.
        console.warn(`[notify-drip-unlocks] ledger insert failed for ${email}: ${insertErr.message}`)
        results.push({ email, modules: pending, action: 'sent_log_failed', error: insertErr.message })
        errors++
      } else {
        results.push({ email, modules: pending, action: 'sent' })
      }
      await new Promise(r => setTimeout(r, SEND_DELAY_MS))
    } else {
      results.push({ email, modules: pending, action: 'send_failed', error: result.reason })
      errors++
    }
  }

  console.log(`[notify-drip-unlocks] scanned=${students.length} emailed=${emailed} skipped=${skipped} errors=${errors} capped=${capped}`)

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    scanned: students.length,
    emailed,
    skipped,
    errors,
    capped,
    results,
  })
}
