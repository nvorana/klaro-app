// ─── Diagnose WHY a student's KLARO access ended ─────────────────────────────
//
// READ-ONLY. Writes nothing. Run before granting any extension.
//
// Usage:
//   node --env-file=.env.local scripts/diagnose-access-expiry.mjs <email> [email...]
//
// Mirrors lib/accessExpiry.ts resolution order exactly:
//   1. profiles.access_expires_at (explicit — always wins)
//   2. (created_at ?? enrolled_at) + 90 days
//   3. neither → never expires
//
// Distinguishes the two different reasons a student loses access, which are
// NOT the same thing and need different remedies:
//   - EXPIRED          → 90-day window elapsed. An extension is the fix.
//   - SUSPENDED        → access_suspended = payment hold. An extension does
//                        NOT restore access; the payment tag must clear first.

import { createClient } from '@supabase/supabase-js'

const emails = process.argv.slice(2)
if (!emails.length) {
  console.error('Usage: node --env-file=.env.local scripts/diagnose-access-expiry.mjs <email> [email...]')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DAY_MS = 86400000
const now = Date.now()
const d = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '—')

for (const email of emails) {
  console.log('\n' + '='.repeat(74))
  console.log(email)
  console.log('='.repeat(74))

  const { data: p, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle()

  if (error) { console.log(`  ERROR: ${error.message}`); continue }
  if (!p) { console.log('  NO PROFILE FOUND — never signed up, or different email on file'); continue }

  const legacyStart = p.created_at ?? p.enrolled_at
  const explicit = p.access_expires_at ? new Date(p.access_expires_at) : null
  const fallback = legacyStart ? new Date(new Date(legacyStart).getTime() + 90 * DAY_MS) : null
  const effective = explicit ?? fallback

  const daysPast = effective ? Math.floor((now - effective.getTime()) / DAY_MS) : null

  console.log(`  Name:            ${p.full_name ?? '—'}`)
  console.log(`  Role:            ${p.role ?? '—'}`)
  console.log(`  Access level:    ${p.access_level ?? '—'}`)
  console.log(`  Program:         ${p.program_type ?? '—'}`)
  console.log(`  Suspended:       ${p.access_suspended === true ? 'YES — PAYMENT HOLD' : 'no'}`)
  console.log(`  Installments:    ${p.installments_paid ?? '—'} paid | next due ${d(p.next_payment_due_at)}`)
  console.log(`  created_at:      ${d(p.created_at)}`)
  console.log(`  enrolled_at:     ${d(p.enrolled_at)}`)
  console.log(`  access_expires_at (explicit): ${explicit ? d(explicit) : 'NULL — using 90-day fallback'}`)
  console.log(`  fallback (start + 90d):       ${fallback ? d(fallback) : '—'}`)
  console.log(`  EFFECTIVE EXPIRY:             ${effective ? d(effective) : 'never expires'}`)

  // ── Verdict ────────────────────────────────────────────────────────────────
  let verdict
  if (p.role === 'coach' || p.role === 'admin') {
    verdict = 'NOT EXPIRED — coaches/admins never expire'
  } else if (!effective) {
    verdict = 'NOT EXPIRED — no start date on file, never locks out'
  } else if (now > effective.getTime()) {
    const why = explicit
      ? 'explicit access_expires_at is in the past'
      : `90-day window from ${d(legacyStart)} elapsed`
    verdict = `EXPIRED ${daysPast} days ago — ${why}`
  } else {
    verdict = `ACTIVE — ${Math.ceil((effective.getTime() - now) / DAY_MS)} days remaining`
  }
  console.log(`  >> VERDICT:      ${verdict}`)

  if (p.access_suspended === true) {
    console.log('  >> WARNING:      access_suspended is TRUE. This is a PAYMENT HOLD,')
    console.log('                   not an expiry. Extending access_expires_at will NOT')
    console.log('                   let this student back in — middleware bounces them')
    console.log('                   to the hold screen regardless of expiry date.')
  }

  // ── Recent tag / webhook activity ──────────────────────────────────────────
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('created_at, action, tag, payload')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(8)

  if (logs?.length) {
    console.log('  Recent webhook activity:')
    for (const l of logs) {
      console.log(`    ${d(l.created_at)}  ${l.action ?? '—'}  ${l.tag ?? ''}`)
    }
  } else {
    console.log('  Recent webhook activity: none found')
  }
}

console.log('\nRead-only diagnosis complete. Nothing was modified.\n')
