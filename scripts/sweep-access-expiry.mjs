// ─── Access expiry sweep ──────────────────────────────────────────────────────
//
// READ-ONLY by default. Writes nothing unless --fix-pending-gap is passed.
//
// Usage:
//   node --env-file=.env.local scripts/sweep-access-expiry.mjs
//   node --env-file=.env.local scripts/sweep-access-expiry.mjs --fix-pending-gap
//   node --env-file=.env.local scripts/sweep-access-expiry.mjs --fix-pending-gap --apply
//
// Reports four groups:
//   A. PENDING WITH CLOCK RUNNING — signed up, never granted access, but the
//      90-day countdown from created_at is already burning. This is the bug.
//   B. LOST DAYS TO A PENDING GAP — access arrived days/weeks after signup, so
//      the student never got a full usable 90 days.
//   C. EXPIRED — window already elapsed.
//   D. EXPIRING WITHIN 30 DAYS.
//
// --fix-pending-gap rewrites access_expires_at for groups A and B to
// (grant time + 90 days), giving back the days lost before access existed.
// Without --apply it is a dry run.

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const FIX = args.includes('--fix-pending-gap')
const APPLY = args.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DAY = 86400000
const ACCESS_DAYS = 90
const GAP_THRESHOLD_DAYS = 2   // below this, signup and grant are effectively the same event
const now = Date.now()
const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '—')

// ── Load every student ────────────────────────────────────────────────────────
const { data: profiles, error } = await supabase
  .from('profiles')
  .select('id, email, full_name, role, access_level, program_type, access_suspended, created_at, enrolled_at, access_expires_at')
  .eq('role', 'student')

if (error) { console.error('Load failed: ' + error.message); process.exit(1) }

// ── Progress, so we can tell a stalled student from an engaged one ────────────
const { data: progress } = await supabase
  .from('module_progress')
  .select('user_id, module_number, completed_at')

const completedBy = new Map()
for (const r of progress ?? []) {
  if (!r.completed_at) continue
  if (!completedBy.has(r.user_id)) completedBy.set(r.user_id, new Set())
  completedBy.get(r.user_id).add(r.module_number)
}
const doneCount = (id) => (completedBy.get(id)?.size ?? 0)

// ── Classify ──────────────────────────────────────────────────────────────────
// Mirrors lib/accessExpiry.ts, including the 2026-07-29 pending rule:
// a student who has not been granted access yet has no window running.
const effectiveExpiry = (p) => {
  if (p.access_level === 'pending' && !p.access_expires_at) return null
  if (p.access_expires_at) return new Date(p.access_expires_at)
  const start = p.created_at ?? p.enrolled_at
  return start ? new Date(new Date(start).getTime() + ACCESS_DAYS * DAY) : null
}

const pendingNow = []   // A
const lostDays = []     // B
const expired = []      // C
const expiringSoon = [] // D

for (const p of profiles) {
  const exp = effectiveExpiry(p)
  const daysLeft = exp ? Math.ceil((exp.getTime() - now) / DAY) : null

  if (p.access_level === 'pending') {
    const waiting = p.created_at ? Math.floor((now - new Date(p.created_at).getTime()) / DAY) : 0
    const wouldHaveBeen = p.created_at
      ? new Date(new Date(p.created_at).getTime() + ACCESS_DAYS * DAY)
      : null
    pendingNow.push({ ...p, waiting, wouldHaveBeen, exp, daysLeft })
    continue
  }

  // Gap between signing up and actually being granted access.
  if (p.created_at && p.enrolled_at) {
    const gap = (new Date(p.enrolled_at).getTime() - new Date(p.created_at).getTime()) / DAY
    if (gap > GAP_THRESHOLD_DAYS) {
      lostDays.push({ ...p, gap: Math.round(gap), exp, daysLeft })
    }
  }

  if (exp && now > exp.getTime()) expired.push({ ...p, exp, daysLeft })
  else if (daysLeft !== null && daysLeft <= 30) expiringSoon.push({ ...p, exp, daysLeft })
}

const row = (p, extra = '') =>
  `   ${(p.email ?? '').padEnd(38)} ${String(p.program_type ?? '—').padEnd(12)} ` +
  `${doneCount(p.id)}/7 done  exp ${day(p.exp)}  ${extra}`

console.log('\n' + '#'.repeat(78))
console.log('# KLARO ACCESS SWEEP — ' + new Date().toISOString().slice(0, 10))
console.log('# ' + profiles.length + ' students')
console.log('#'.repeat(78))

console.log('\n[A] PENDING — CLOCK STOPPED — ' + pendingNow.length)
console.log('    Signed up, access not granted yet. No window is running; each')
console.log('    gets a full 90 days the moment access is granted.')
console.log('    "was" = the bogus expiry they carried before the 2026-07-29 fix.')
pendingNow.sort((a, b) => b.waiting - a.waiting)
for (const p of pendingNow) {
  const stale = p.wouldHaveBeen && p.wouldHaveBeen.getTime() < now ? '  <-- had already "expired"' : ''
  console.log(`   ${(p.email ?? '').padEnd(38)} waiting ${String(p.waiting).padStart(3)}d   was ${day(p.wouldHaveBeen)}${stale}`)
}
if (!pendingNow.length) console.log('    (none)')

console.log('\n[B] LOST DAYS TO A PENDING GAP — ' + lostDays.length)
console.log('    Access arrived >' + GAP_THRESHOLD_DAYS + ' days after signup; clock started at signup.')
lostDays.sort((a, b) => b.gap - a.gap)
for (const p of lostDays) console.log(row(p, `lost ~${p.gap}d`))
if (!lostDays.length) console.log('    (none)')

console.log('\n[C] EXPIRED — ' + expired.length)
expired.sort((a, b) => a.exp - b.exp)
for (const p of expired) console.log(row(p, `${Math.abs(p.daysLeft)}d ago`))
if (!expired.length) console.log('    (none)')

console.log('\n[D] EXPIRING WITHIN 30 DAYS — ' + expiringSoon.length)
expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft)
for (const p of expiringSoon) console.log(row(p, `in ${p.daysLeft}d`))
if (!expiringSoon.length) console.log('    (none)')

// ── Engagement split on the expired group — informs who's worth extending ─────
console.log('\n--- EXPIRED, split by engagement ---')
const stalled = expired.filter(p => doneCount(p.id) <= 2)
const midway  = expired.filter(p => doneCount(p.id) > 2 && doneCount(p.id) < 7)
const finished = expired.filter(p => doneCount(p.id) === 7)
console.log('   finished all 7:      ' + finished.length)
console.log('   midway (3-6):        ' + midway.length)
console.log('   stalled (0-2 done):  ' + stalled.length)

// ── Optional repair ───────────────────────────────────────────────────────────
if (FIX) {
  // Group A needs no repair — the pending rule in lib/accessExpiry.ts already
  // stops their clock, and the DB trigger starts a fresh 90 days on grant.
  // Only group B (already granted, but late) can be repaired retroactively.
  const targets = lostDays
  console.log('\n' + '='.repeat(78))
  console.log((APPLY ? 'APPLYING' : 'DRY RUN —') + ' pending-gap repair on ' + targets.length + ' profile(s)')
  console.log('CAUTION: this trusts enrolled_at as the grant time. That column is')
  console.log('partly backfilled — verify a sample before applying.')
  console.log('='.repeat(78))

  for (const p of targets) {
    const grantAt = new Date(p.enrolled_at)
    const newExpiry = new Date(grantAt.getTime() + ACCESS_DAYS * DAY)
    if (p.access_expires_at && new Date(p.access_expires_at).getTime() >= newExpiry.getTime()) {
      console.log('   SKIP (already >= proposed): ' + p.email)
      continue
    }
    console.log('   ' + p.email.padEnd(38) + day(p.exp) + '  ->  ' + day(newExpiry))
    if (APPLY) {
      await supabase.rpc('set_audit_context', { p_user: null, p_source: 'pending_gap_repair' })
      const { error: e } = await supabase
        .from('profiles')
        .update({ access_expires_at: newExpiry.toISOString(), updated_at: new Date().toISOString() })
        .eq('id', p.id)
      if (e) console.log('      FAILED: ' + e.message)
    }
  }
  if (!APPLY) console.log('\n   Dry run only. Re-run with --apply to write.')
}

console.log('')
