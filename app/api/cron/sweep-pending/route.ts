import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

// Vercel can take up to 60s on Pro for one sweep; allow it.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const EDGAR_COACH_ID = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442'
const SYSTEME_API_BASE = process.env.SYSTEME_API_BASE_URL || 'https://api.systeme.io/api'
const TEST_ACCOUNT_PATTERNS = [/^nvorana\+/i, /\+test\d*@/i]

function isTestAccount(email: string): boolean {
  return TEST_ACCOUNT_PATTERNS.some(p => p.test(email))
}

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

  // Set audit context up front so all activations in this sweep are attributed
  // to 'cron_sweep_pending' source.
  await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_sweep_pending' })

  const { data: pending } = await admin
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('access_level', 'pending')

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, activated: 0, message: 'No pending accounts' })
  }

  const results: Array<{ email: string; name: string | null; status: string; action: string; error?: string }> = []
  let activated = 0
  let skippedLead = 0
  let skippedTest = 0
  let skippedNotInSysteme = 0
  let errors = 0

  for (const p of pending) {
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
      }
    } else {
      results.push({ email, name: p.full_name, status: d.status, action: 'skip' })
      if (d.status === 'lead_only') skippedLead++
      else if (d.status === 'not_in_systeme') skippedNotInSysteme++
    }

    // Gentle rate-limit on Systeme.io
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`[cron-sweep-pending] scanned=${pending.length} activated=${activated} skipped=${skippedLead + skippedTest + skippedNotInSysteme} errors=${errors}`)

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    scanned: pending.length,
    activated,
    skipped: { leads: skippedLead, tests: skippedTest, not_in_systeme: skippedNotInSysteme },
    errors,
    results,
  })
}
