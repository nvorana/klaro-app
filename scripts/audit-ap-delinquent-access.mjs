// Read-only audit: which not-fully-paid AP students still have KLARO access,
// and what payment-related tags Systeme.io holds for them (looking for any
// delinquency/past-due marker we could gate on).
//
// Run: node --env-file=.env.local scripts/audit-ap-delinquent-access.mjs

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const SYSTEME_API_KEY = process.env.SYSTEME_API_KEY
const SYSTEME_API_BASE = process.env.SYSTEME_API_BASE_URL || 'https://api.systeme.io/api'

async function fetchSystemeTags(email) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt))
    try {
      const res = await fetch(`${SYSTEME_API_BASE}/contacts?email=${encodeURIComponent(email)}`, {
        headers: { 'X-API-Key': SYSTEME_API_KEY, accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.items?.length > 0) return (data.items[0].tags ?? []).map(t => t.name)
    } catch {}
  }
  return null
}

const { data: students } = await supabase
  .from('profiles')
  .select('id, full_name, email, access_level, enrolled_at, last_active_at, access_suspended')
  .eq('program_type', 'accelerator')
  .eq('access_level', 'enrolled')
  .or('role.is.null,role.eq.student')
  .order('enrolled_at', { ascending: true })

const real = students.filter(s => !/nvorana\+|\+test|coachmafenu/i.test(s.email ?? ''))
console.log(`Not-fully-paid AP students: ${real.length}\n`)

const day = 86400000
const payTagRe = /pay|paid|due|delinq|unsettled|install|balance|settle|refund|cancel/i
const tagCounts = {}

for (const s of real) {
  const tags = await fetchSystemeTags(s.email)
  const payTags = tags === null ? ['<systeme lookup failed>'] : tags.filter(t => payTagRe.test(t))
  for (const t of payTags) tagCounts[t] = (tagCounts[t] || 0) + 1
  const enrolledDays = s.enrolled_at ? Math.floor((Date.now() - new Date(s.enrolled_at).getTime()) / day) : '?'
  const activeDays = s.last_active_at ? Math.floor((Date.now() - new Date(s.last_active_at).getTime()) / day) : null
  console.log(
    (s.full_name ?? '?').padEnd(28) + ' | ' + s.email.padEnd(36) +
    ' | enrolled ' + String(enrolledDays).padStart(3) + 'd ago' +
    ' | ' + (activeDays === null ? 'never active ' : `active ${String(activeDays).padStart(3)}d ago`) +
    ' | ' + (payTags.length ? payTags.join(', ') : '(no payment tags)')
  )
  await new Promise(r => setTimeout(r, 150))
}

console.log('\n── Payment-related tag frequency across these students ──')
for (const [tag, n] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(n).padStart(3) + '  ' + tag)
}
