import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInactivityNudge } from '@/lib/email/sendInactivityNudge'
import { isModuleUnlockedForStudent, MODULE_INFO } from '@/lib/modules'
import { isAccessExpired } from '@/lib/accessExpiry'

// ── /api/cron/nudge-inactive ─────────────────────────────────────────────────
//
// Twice-weekly re-engagement nudge for students who haven't opened KLARO in
// 7-21 days (last_active_at is stamped on every dashboard visit).
//
// Who gets it:
//   - role = 'student' or null (never coaches/admins)
//   - access_level NOT IN ('pending', 'lite_workshop')
//   - not suspended, not expired (lib/accessExpiry)
//   - last_active_at between 7 and 21 days ago. Older than 21 days is a
//     coach conversation, not an automated email — don't spam.
//   - hasn't finished the program (a row in content_posts = Module 7 output
//     exists = done, skip)
//
// Throttle: max ONE nudge per student per 14 days, enforced inside
// sendInactivityNudge via webhook_logs action='inactivity_nudge_sent'
// (latest row's processed_at checked before each send).
//
// Security: same CRON_SECRET pattern as sweep-pending.

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_SENDS_PER_RUN = 100
const SEND_DELAY_MS = 600
const DAY_MS = 24 * 60 * 60 * 1000
const TEST_ACCOUNT_PATTERNS = [/^nvorana\+/i, /\+test\d*@/i]

function isTestAccount(email: string): boolean {
  return TEST_ACCOUNT_PATTERNS.some(p => p.test(email))
}

/** Highest module currently unlocked for this student (at least 1). */
function highestUnlockedModule(p: {
  unlocked_modules: number[] | null
  access_level: string | null
  enrolled_at: string | null
  drip_anchor: string | null
  program_type: string | null
}): number {
  let highest = 1
  for (let m = 2; m <= 7; m++) {
    if (isModuleUnlockedForStudent(p.unlocked_modules, p.access_level, p.drip_anchor, m, p.program_type)) {
      highest = m
    }
  }
  return highest
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
  await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_nudge_inactive' })

  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString()
  const twentyOneDaysAgo = new Date(now - 21 * DAY_MS).toISOString()

  // Students inactive 7-21 days
  const { data: students, error: studentsErr } = await admin
    .from('profiles')
    .select('id, email, first_name, full_name, role, access_level, program_type, unlocked_modules, enrolled_at, drip_anchor, created_at, access_expires_at, access_suspended, last_active_at')
    .gte('last_active_at', twentyOneDaysAgo)
    .lte('last_active_at', sevenDaysAgo)
    .not('access_level', 'in', '("pending","lite_workshop")')

  if (studentsErr) {
    return NextResponse.json({ error: studentsErr.message }, { status: 500 })
  }
  if (!students || students.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, emailed: 0, message: 'No inactive students in window' })
  }

  // Program finishers: a content_posts row means Module 7 output exists —
  // they're done, no nudge needed.
  const ids = students.map(s => s.id)
  const { data: finishedRows } = await admin
    .from('content_posts')
    .select('user_id')
    .in('user_id', ids)
  const finished = new Set((finishedRows ?? []).map(r => r.user_id))

  const results: Array<{ email: string; action: string; module?: number; error?: string }> = []
  let emailed = 0
  let skipped = 0
  let errors = 0
  let capped = false

  for (const s of students) {
    const email = (s.email ?? '').trim()
    if (!email || isTestAccount(email)) { skipped++; continue }
    if (s.role && s.role !== 'student') { skipped++; continue }
    if (s.access_suspended === true) { skipped++; continue }
    if (isAccessExpired(s)) { skipped++; continue }
    if (finished.has(s.id)) { skipped++; continue }

    if (emailed >= MAX_SENDS_PER_RUN) {
      capped = true
      break
    }

    const moduleNumber = highestUnlockedModule(s)
    const moduleTitle = MODULE_INFO.find(m => m.number === moduleNumber)?.title ?? 'next module'

    const result = await sendInactivityNudge({
      email,
      firstName: s.first_name,
      fullName: s.full_name,
      nextModuleNumber: moduleNumber,
      nextModuleTitle: moduleTitle,
    })

    if (result.sent) {
      emailed++
      results.push({ email, action: 'sent', module: moduleNumber })
      await new Promise(r => setTimeout(r, SEND_DELAY_MS))
    } else if (result.reason === 'recently_nudged') {
      skipped++
      results.push({ email, action: 'recently_nudged' })
    } else {
      errors++
      results.push({ email, action: 'send_failed', error: result.reason })
    }
  }

  console.log(`[nudge-inactive] scanned=${students.length} emailed=${emailed} skipped=${skipped} errors=${errors} capped=${capped}`)

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
