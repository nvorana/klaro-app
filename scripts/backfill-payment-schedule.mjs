// One-time backfill: stamp installments_paid + next_payment_due_at for all
// not-fully-paid AP and TOPIS students, derived from their Systeme.io tags.
// Plans: AP = 2 payments, TOPIS = 3, 30 days apart, first paid at enrollment.
//
// Run: node --env-file=.env.local scripts/backfill-payment-schedule.mjs

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const SYSTEME_API_BASE = process.env.SYSTEME_API_BASE_URL || 'https://api.systeme.io/api'
const DAY = 86400000
const PLAN = { accelerator: 2, topis: 3 }

async function fetchTags(email) {
  for (let a = 0; a < 3; a++) {
    if (a > 0) await new Promise(r => setTimeout(r, 800 * a))
    try {
      const res = await fetch(`${SYSTEME_API_BASE}/contacts?email=${encodeURIComponent(email)}`, {
        headers: { 'X-API-Key': process.env.SYSTEME_API_KEY, accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.items?.length > 0) return (data.items[0].tags ?? []).map(t => t.name)
    } catch {}
  }
  return null
}

function installmentsFromTags(tags, program) {
  const norm = tags.map(t => t.replace(/[\s|_]+/g, '-').replace(/-+/g, '-'))
  let paid = 1  // first payment happens at enrollment
  for (const t of norm) {
    let m
    if (program === 'accelerator' && (m = t.match(/^AP-PAYMENT-PAY-(\d+)$/i))) paid = Math.max(paid, +m[1])
    if (program === 'topis') {
      if ((m = t.match(/^TOPIS-\d+-PAYMENT-PAY-(\d+)$/i))) paid = Math.max(paid, +m[1])
      if (/^TOPIS(-\d+)?-2nd-Pay-Settled(-\d+)?$/i.test(t)) paid = Math.max(paid, 2)
    }
  }
  const fullyPaid =
    (program === 'accelerator' && norm.some(t => /^Accel-Full-Payment(-\d+)?$/i.test(t) || /^AP-PAYMENT-FULLY-PAID$/i.test(t))) ||
    (program === 'topis' && norm.some(t => /^TOPIS-\d+-(PAYMENT-)?FULLY-PAID$/i.test(t) || /^TOPIS(-\d+)?-Full-Payment(-\d+)?$/i.test(t)))
  return { paid, fullyPaid }
}

const { data: students } = await supabase
  .from('profiles')
  .select('id, email, full_name, program_type, enrolled_at, access_level, access_suspended')
  .in('program_type', ['accelerator', 'topis'])
  .eq('access_level', 'enrolled')
  .or('role.is.null,role.eq.student')

const real = students.filter(s => !/nvorana\+|\+test|coachmafenu/i.test(s.email ?? ''))
console.log(`Not-fully-paid AP/TOPIS students to stamp: ${real.length}\n`)

await supabase.rpc('set_audit_context', { p_user: null, p_source: 'backfill_payment_schedule' })

let stamped = 0, skippedFull = 0, lookupFailed = 0
for (const s of real) {
  const tags = await fetchTags(s.email)
  if (tags === null) { console.log('  lookup failed: ' + s.email); lookupFailed++; continue }
  const { paid, fullyPaid } = installmentsFromTags(tags, s.program_type)
  if (fullyPaid) { console.log('  fully paid in Systeme (sweep will upgrade): ' + s.email); skippedFull++; continue }
  const total = PLAN[s.program_type]
  const due = s.enrolled_at && paid < total
    ? new Date(new Date(s.enrolled_at).getTime() + 30 * DAY * paid).toISOString()
    : null
  const { error } = await supabase
    .from('profiles')
    .update({ installments_paid: paid, next_payment_due_at: due, updated_at: new Date().toISOString() })
    .eq('id', s.id)
  if (error) { console.log('  ERROR ' + s.email + ': ' + error.message); continue }
  stamped++
  console.log(
    '  ' + (s.full_name ?? '?').padEnd(28) + ' | ' + s.program_type.padEnd(11) +
    ' | paid ' + paid + '/' + total +
    ' | next due ' + (due ? due.slice(0, 10) : 'n/a') +
    (s.access_suspended ? ' | (suspended)' : '')
  )
  await new Promise(r => setTimeout(r, 150))
}
console.log(`\nStamped: ${stamped}, fully-paid skipped: ${skippedFull}, lookup failures: ${lookupFailed}`)
