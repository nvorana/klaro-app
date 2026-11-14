import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWelcomeEmail } from '@/lib/email/sendWelcomeEmail'
import { isPostCutoffAPProfile } from '@/lib/apKlaroPolicy'

// ── /api/cron/sweep-pending ──────────────────────────────────────────────────
//
// Runs on a schedule (Vercel cron — see vercel.json) and on-demand. Catches
// pending KLARO accounts whose paid status in Systeme.io never reached us via
// webhook (manual tag-adds in Systeme.io UI don't fire webhooks, so they sit
// stuck on `pending` even though the customer paid).
//
// Logic mirrors scripts/sweep-pending-activate.mjs:
//   1. Pull all profiles with access_level='pending'
//   2. For each, fetch Systeme.io tags
//   3. If they have paid customer tags (AP enrolled, AP full-paid, TOPIS
//      student, TOPIS full-paid, or KLARO tier), activate them
//   4. Leads, test accounts, and not-in-Systeme cases are LEFT ALONE — never
//      deletes or modifies anything except activations
//
// Security: the request must include either
//   - `Authorization: Bearer <CRON_SECRET>` header (Vercel cron sends this
//     automatically when CRON_SECRET env var is set), OR
//   - `?secret=<CRON_SECRET>` query param (for manual triggering via curl)
//
// Returns JSON with counts + per-student results so the audit log can show
// exactly what the sweep did.

// Pass 2 looks up ~110 students in Systeme.io on top of the pending sweep, so
// the old 60s cap could cut a run off midway. Passes stop at TIME_BUDGET_MS
// and the next run (every 3h) picks up the rest; candidates are shuffled so
// the same students aren't always the ones left out.
export const maxDuration = 300
export const dynamic = 'force-dynamic'
const TIME_BUDGET_MS = 240_000

const EDGAR_COACH_ID = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442'
const SYSTEME_API_BASE = process.env.SYSTEME_API_BASE_URL || 'https://api.systeme.io/api'
const TEST_ACCOUNT_PATTERNS = [/^nvorana\+/i, /\+test\d*@/i]

function isTestAccount(email: string): boolean {
  return TEST_ACCOUNT_PATTERNS.some(p => p.test(email))
}

// Full access without a paid tag, by design: team members and the owner's
// comped friends. Pass 2 never locks or changes these.
const NEVER_PAYMENT_GATED = new Set([
  'nvorana@gmail.com', 'frimando@negosyouniversity.com', 'ferdie.negosyo@gmail.com', 'mikenegosyo@gmail.com',
  'rlontoc.negosyouniversity@gmail.com', 'edgar.negosyouniversity@gmail.com', 'coachmafenu@gmail.com',
  'shurewin@gmail.com', 'shiee.villafuerte@gmail.com',
  'romerly059@gmail.com', 'jhun27@gmail.com', 'richcabansag@gmail.com',
])

// Audit sources that mean "locked for non-payment". Pass 2 only lifts locks
// that came from one of these; anything else (e.g. the coach/admin suspend
// toggle, which audits as 'unknown') stays locked until a person lifts it.
const PAYMENT_LOCK_SOURCES = new Set([
  'webhook_systeme', 'cron_sweep_pending', 'admin_overdue_lock', 'admin_suspend_overdue', 'ap_overdue_gate_rollout',
])

// Systeme.io's contacts API intermittently returns empty results for
// contacts that actually exist (caught real-world: Mary Angelica Bonifacio,
// Lady Sharonne Cruz, Milky Joy Camat, et al — each had Accel-Enrolled
// tagged for 17-24 days but the single-shot lookup kept returning empty,
// so they sat stuck on `pending`).
//
// Retry up to 3 times with exponential backoff before treating "empty"
// as truth. Only return [] (no tags) after all 3 attempts agree on empty.
async function fetchSystemeTags(email: string): Promise<string[] | null> {
  const apiKey = process.env.SYSTEME_API_KEY
  if (!apiKey) return null
  const delays = [0, 800, 2400]
  let lastSuccessfulResult: string[] | null = null
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]))
    try {
      const res = await fetch(`${SYSTEME_API_BASE}/contacts?email=${encodeURIComponent(email)}`, {
        headers: { 'X-API-Key': apiKey, accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        const tags = (data.items[0].tags ?? []) as Array<{ name: string }>
        return tags.map(t => t.name)
      }
      // Empty result — record it but keep retrying. A consistent empty
      // across all 3 attempts gives us higher confidence it's truly empty.
      lastSuccessfulResult = []
    } catch {
      // Network error — retry.
    }
  }
  return lastSuccessfulResult  // null if all attempts errored, [] if all empty
}

interface DiagnoseResult {
  status: 'paid_accelerator' | 'paid_accelerator_full' | 'paid_topis' | 'paid_topis_full' | 'paid_tier' | 'lead_only' | 'not_in_systeme'
  action: 'activate' | 'skip'
  payload?: Record<string, unknown>
}

function diagnose(tags: string[] | null): DiagnoseResult {
  if (tags === null) return { status: 'not_in_systeme', action: 'skip' }
  if (tags.length === 0) return { status: 'not_in_systeme', action: 'skip' }
  const lower = tags.map(t => t.toLowerCase())

  // Cohort batch from any TOPIS tag
  let cohortBatch: number | null = null
  for (const t of tags) {
    const m = t.match(/TOPIS\s*\|?\s*(\d+)/i)
    if (m) { cohortBatch = parseInt(m[1]); break }
  }

  const isAccelEnrolled = lower.some(t => t === 'accel-enrolled' || t === 'accelerator-enrolled' || t === 'accelerator-program')
  const isAccelFullPaid = lower.some(t => /accel.*full.*payment/i.test(t)) ||
                          lower.some(t => /ap \| payment \| fully_paid/i.test(t))

  if (isAccelEnrolled) {
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      access_level: isAccelFullPaid ? 'full_access' : 'enrolled',
      program_type: 'accelerator',
      coach_id: EDGAR_COACH_ID,
      unlocked_modules: [1, 2],
      enrolled_at: now,
      access_suspended: false,
    }
    if (isAccelFullPaid) payload.full_access_granted_at = now
    return {
      status: isAccelFullPaid ? 'paid_accelerator_full' : 'paid_accelerator',
      action: 'activate',
      payload,
    }
  }

  const isTopisStudent = tags.some(t =>
    /^TOPIS \| Student$/i.test(t) || /^TOPIS-Student$/i.test(t) || /^TOPIS \d+ Student$/i.test(t)
  )
  const isTopisFullyPaid = tags.some(t => /TOPIS \| \d+ \| PAYMENT \| FULLY_PAID/i.test(t)) ||
                           tags.some(t => /TOPIS-\d+-Full-Payment/i.test(t))
  const isTopisPaid = tags.some(t =>
    /TOPIS \d+ (Manual|Online) Paid/i.test(t) ||
    /TOPIS \| \d+ \| PAYMENT \| (MANUAL_PAID|ONLINE_PAID|PAY_)/i.test(t)
  )

  if (isTopisStudent || isTopisFullyPaid || isTopisPaid) {
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      access_level: isTopisFullyPaid ? 'full_access' : 'enrolled',
      program_type: 'topis',
      enrolled_at: now,
      coach_id: null,
      access_suspended: false,
    }
    if (cohortBatch) payload.cohort_batch = cohortBatch
    if (isTopisFullyPaid) payload.full_access_granted_at = now
    return {
      status: isTopisFullyPaid ? 'paid_topis_full' : 'paid_topis',
      action: 'activate',
      payload,
    }
  }

  const tierTag = tags.find(t => /^Klaro-tier(\d+)$/i.test(t)) || tags.find(t => /KLARO-FULLPAY/i.test(t))
  if (tierTag) {
    const tierMatch = tierTag.match(/tier(\d+)/i)
    const tierLevel = tierMatch ? `tier${tierMatch[1]}` : 'full_access'
    return {
      status: 'paid_tier',
      action: 'activate',
      payload: { access_level: tierLevel, enrolled_at: new Date().toISOString(), access_suspended: false },
    }
  }

  return { status: 'lead_only', action: 'skip' }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  // ── Auth: Vercel cron sends `Authorization: Bearer <CRON_SECRET>` ────────
  // Manual triggers can use ?secret=<CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization') ?? ''
  const querySecret = request.nextUrl.searchParams.get('secret') ?? ''
  const headerOk = authHeader === `Bearer ${cronSecret}`
  const queryOk = querySecret === cronSecret
  if (!headerOk && !queryOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const startedAt = Date.now()

  // Set audit context up front so all activations in this sweep are attributed
  // to 'cron_sweep_pending' source.
  await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_sweep_pending' })

  const { data: pending } = await admin
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('access_level', 'pending')

  // No early return when nothing is pending: Pass 2 (payment sync) must still
  // run. It used to return here, which skipped the payment sync entirely.
  const pendingList = pending ?? []

  const results: Array<{ email: string; name: string | null; status: string; action: string; error?: string }> = []
  let activated = 0
  let skippedLead = 0
  let skippedTest = 0
  let skippedNotInSysteme = 0
  let errors = 0

  for (const p of pendingList) {
    if (Date.now() - startedAt > TIME_BUDGET_MS / 2) break  // leave room for Pass 2
    const email = p.email ?? ''
    if (!email) {
      skippedTest++
      continue
    }
    if (isTestAccount(email)) {
      results.push({ email, name: p.full_name, status: 'test_account', action: 'skip' })
      skippedTest++
      continue
    }

    const tags = await fetchSystemeTags(email)
    const d = diagnose(tags)

    if (d.action === 'activate' && d.payload) {
      // POLICY (July 1, 2026): new AP students no longer receive KLARO
      // access. Skip activation for post-cutoff AP-diagnosed profiles.
      // TOPIS + tier customers are unaffected.
      const isAP = d.payload.program_type === 'accelerator'
      if (isAP && isPostCutoffAPProfile(p.created_at)) {
        results.push({ email, name: p.full_name, status: d.status, action: 'skip_ap_policy' })
        continue
      }

      // Re-set audit context just before each write to maximize the chance the
      // session var survives PgBouncer pooling (cheap; same connection within
      // the function invocation).
      await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_sweep_pending' })
      const { error } = await admin
        .from('profiles')
        .update(d.payload)
        .eq('id', p.id)
      if (error) {
        results.push({ email, name: p.full_name, status: d.status, action: 'error', error: error.message })
        errors++
      } else {
        results.push({ email, name: p.full_name, status: d.status, action: 'activated' })
        activated++
        // Welcome email — idempotent, fires only once per profile
        await sendWelcomeEmail({
          profileId: p.id,
          email,
          fullName: p.full_name,
          accessLevel: (d.payload.access_level as string) ?? 'enrolled',
          programType: (d.payload.program_type as string | undefined),
        })
      }
    } else {
      results.push({ email, name: p.full_name, status: d.status, action: 'skip' })
      if (d.status === 'lead_only') skippedLead++
      else if (d.status === 'not_in_systeme') skippedNotInSysteme++
    }

    // Gentle rate-limit on Systeme.io
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`[cron-sweep-pending] scanned=${pendingList.length} activated=${activated} skipped=${skippedLead + skippedTest + skippedNotInSysteme} errors=${errors}`)

  // ── Pass 2: payment-state sync (AP + TOPIS + tier students) ─────────────────
  // Webhooks miss events: tags edited by hand in the Systeme.io UI don't fire
  // them. Until 2026-11 this pass only looked at AP 'enrolled' students and
  // never restored anyone, which left two holes:
  //   - 9 overdue students (TOPIS 79, plus AP students on tier1) kept full use
  //     of KLARO for weeks; they were locked by hand on 2026-11-02.
  //   - Marichu Sevilla paid in full and stayed locked for 11 days, because
  //     the PAY_3 / FULLY_PAID tags were added by hand and the webhook that
  //     restores access never fired.
  // So this pass now reconciles every student who isn't fully paid or is
  // locked:
  //   overdue in Systeme, not locked         → lock (payment hold)
  //   locked, no longer overdue in Systeme   → unlock, but ONLY if their lock
  //       came from a payment source. A coach/admin lock (toggle-suspension,
  //       audited as 'unknown') is never undone here.
  //   fully paid, still 'enrolled'           → upgrade to full_access
  // Fully paid wins over a stale overdue tag left behind in Systeme.
  const paymentSync: Array<{ email: string; action: string }> = []

  const isOverdue = (tags: string[]) =>
    tags.some(t =>
      /^AP \| PAYMENT \| OVERDUE$/i.test(t.trim()) ||
      /^TOPIS \| PAYMENT \| OVERDUE$/i.test(t.trim()) ||
      /^TOPIS \d+ Overdue$/i.test(t.trim()) ||
      /^Unsettled - AP$/i.test(t.trim()) ||
      /^Accel-Unsettled-\d+$/i.test(t.trim())
    )
  const isFullyPaid = (tags: string[]) =>
    tags.some(t =>
      /^AP \| PAYMENT \| FULLY_PAID$/i.test(t.trim()) ||
      /^Accel-Full-Payment/i.test(t.trim()) ||
      /^TOPIS \| \d+ \| PAYMENT \| FULLY_PAID$/i.test(t.trim()) ||
      /^TOPIS-\d+-Full-Payment/i.test(t.trim())
    )

  // Not fully set up yet, or locked. full_access students are fully paid by
  // definition (team and comp accounts below are the exceptions), and
  // lite_workshop is the free tier, so neither needs a payment check.
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, email, access_level, program_type, access_suspended')
    .eq('role', 'student')
    .not('access_level', 'in', '("pending","lite_workshop")')
    .or('access_level.neq.full_access,access_suspended.eq.true')

  // Why each locked student was locked: the latest audit row that set
  // access_suspended = true.
  const lockedIds = (candidates ?? []).filter(p => p.access_suspended).map(p => p.id)
  const lockSource = new Map<string, string>()
  if (lockedIds.length > 0) {
    const { data: lockRows } = await admin
      .from('profile_audit_log')
      .select('profile_id, source, after_value, changed_at')
      .eq('field', 'access_suspended')
      .in('profile_id', lockedIds)
      .order('changed_at', { ascending: false })
    for (const r of lockRows ?? []) {
      if (r.after_value === true && !lockSource.has(r.profile_id)) lockSource.set(r.profile_id, r.source)
    }
  }

  // Shuffled so a run that hits the time budget doesn't always skip the same tail.
  const queue = [...(candidates ?? [])].sort(() => Math.random() - 0.5)
  let paymentChecked = 0
  for (const p of queue) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    const email = (p.email ?? '').toLowerCase()
    if (!email || isTestAccount(email) || NEVER_PAYMENT_GATED.has(email)) continue
    const tags = await fetchSystemeTags(email)
    paymentChecked++
    await new Promise(r => setTimeout(r, 150))
    if (tags === null || tags.length === 0) continue  // lookup failed / not found — leave alone

    const fullyPaid = isFullyPaid(tags)
    const overdue = !fullyPaid && isOverdue(tags)
    const update: Record<string, unknown> = {}

    if (overdue && !p.access_suspended) {
      update.access_suspended = true
    } else if (!overdue && p.access_suspended) {
      const source = lockSource.get(p.id) ?? 'unknown'
      if (PAYMENT_LOCK_SOURCES.has(source)) update.access_suspended = false
      else paymentSync.push({ email, action: `kept_locked_manual_lock(${source})` })
    }
    if (fullyPaid && p.access_level === 'enrolled' && (p.program_type === 'accelerator' || p.program_type === 'topis')) {
      update.access_level = 'full_access'
      update.full_access_granted_at = new Date().toISOString()
    }
    if (Object.keys(update).length === 0) continue

    await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_sweep_pending' })
    const { error } = await admin
      .from('profiles')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    const action = [
      update.access_suspended === true && 'locked_overdue',
      update.access_suspended === false && 'unlocked_paid',
      update.access_level === 'full_access' && 'upgraded_full_access',
    ].filter(Boolean).join('+')
    paymentSync.push({ email, action: error ? `error(${action}): ${error.message}` : action })
  }

  console.log(`[cron-sweep-pending] payment_sync checked=${paymentChecked}/${queue.length} changes=${JSON.stringify(paymentSync)}`)

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    scanned: pendingList.length,
    activated,
    skipped: { leads: skippedLead, tests: skippedTest, not_in_systeme: skippedNotInSysteme },
    errors,
    results,
    payment_sync: paymentSync,
  })
}
