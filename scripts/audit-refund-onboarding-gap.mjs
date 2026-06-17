// Forensic: of all customers who paid for Accelerator and then refunded
// (per Systeme.io's Accel-Refunded-* tag), how many ever even signed up
// to KLARO? How many logged in? How many completed a module?
//
// Answers: "Are we losing customers in the gap between payment and product activation?"
//
// Run:
//   node --env-file=.env.local scripts/audit-refund-onboarding-gap.mjs

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const SYSTEME_API_BASE = process.env.SYSTEME_API_BASE_URL || 'https://api.systeme.io/api'
const apiKey = process.env.SYSTEME_API_KEY

console.log('Fetching all Systeme.io tags…')
let allTags = []
let after = null
let pages = 0
while (pages < 50) {
  const url = `${SYSTEME_API_BASE}/tags?limit=100${after ? `&startingAfter=${after}` : ''}`
  const res = await fetch(url, { headers: { 'X-API-Key': apiKey, accept: 'application/json' } })
  if (!res.ok) break
  const data = await res.json()
  if (!data.items?.length) break
  allTags.push(...data.items)
  after = data.items[data.items.length - 1].id
  if (data.items.length < 100) break
  pages++
}
console.log(`Found ${allTags.length} total tags`)

const refundedTags = allTags.filter(t => /accel.*refund/i.test(t.name) || /AP \| PAYMENT \| REFUNDED/i.test(t.name))
console.log(`\nRefund-related tags:`)
for (const t of refundedTags) console.log(`  ${t.id}: ${t.name}`)
if (refundedTags.length === 0) { console.log('No refund tags found.'); process.exit(0) }

console.log('\nFetching all refunded contacts…')
const refunders = new Map()
for (const tag of refundedTags) {
  let cursor = null
  while (true) {
    const url = `${SYSTEME_API_BASE}/contacts?tags=${tag.id}&limit=100${cursor ? `&startingAfter=${cursor}` : ''}`
    const res = await fetch(url, { headers: { 'X-API-Key': apiKey, accept: 'application/json' } })
    if (!res.ok) break
    const data = await res.json()
    if (!data.items?.length) break
    for (const c of data.items) {
      const email = c.email
      if (!email) continue
      const firstName = c.fields?.find(f => f.slug === 'first_name')?.value ?? ''
      const surname = c.fields?.find(f => f.slug === 'surname')?.value ?? ''
      const name = `${firstName} ${surname}`.trim() || '(no name)'
      const tags = (c.tags || []).map(t => t.name)
      if (!refunders.has(email)) refunders.set(email, { name, tags })
    }
    if (data.items.length < 100) break
    cursor = data.items[data.items.length - 1].id
    await new Promise(r => setTimeout(r, 150))
  }
}
console.log(`Found ${refunders.size} unique refunders\n`)
if (refunders.size === 0) process.exit(0)

const refunderEmails = [...refunders.keys()]
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, email, full_name, access_level, created_at, last_active_at')
  .in('email', refunderEmails)

const profilesByEmail = new Map((profiles ?? []).map(p => [p.email, p]))

const profileIdsByEmail = new Map((profiles ?? []).map(p => [p.id, p.email]))
const allIds = (profiles ?? []).map(p => p.id)
const completedByEmail = new Map()
if (allIds.length > 0) {
  const { data: mp } = await supabase
    .from('module_progress')
    .select('user_id, module_number, completed_at')
    .in('user_id', allIds)
  for (const row of mp ?? []) {
    if (!row.completed_at) continue
    const email = profileIdsByEmail.get(row.user_id)
    if (!email) continue
    if (!completedByEmail.has(email)) completedByEmail.set(email, new Set())
    completedByEmail.get(email).add(row.module_number)
  }
}

const neverSignedUp = []
const signedUpNeverLoggedIn = []
const loggedInButNeverCompleted = []
const completedAtLeastOne = []

for (const [email, info] of refunders.entries()) {
  const profile = profilesByEmail.get(email)
  if (!profile) {
    neverSignedUp.push({ email, ...info })
  } else if (!profile.last_active_at) {
    signedUpNeverLoggedIn.push({ email, ...info, profile })
  } else if (!completedByEmail.has(email)) {
    loggedInButNeverCompleted.push({ email, ...info, profile })
  } else {
    completedAtLeastOne.push({ email, ...info, profile, completed: completedByEmail.get(email).size })
  }
}

const total = refunders.size
const pct = n => `${Math.round((n / total) * 100)}%`

console.log('═══════════════════════════════════════════════════════════════════')
console.log('FORENSIC: REFUND vs KLARO ACCESS')
console.log('═══════════════════════════════════════════════════════════════════')
console.log(`Total refunders in Systeme.io:          ${total}`)
console.log('')
console.log(`  🔴 Never signed up to KLARO:           ${String(neverSignedUp.length).padStart(3)}  (${pct(neverSignedUp.length).padStart(4)})`)
console.log(`  🟠 Signed up, never logged in:         ${String(signedUpNeverLoggedIn.length).padStart(3)}  (${pct(signedUpNeverLoggedIn.length).padStart(4)})`)
console.log(`  🟡 Logged in but no module completion: ${String(loggedInButNeverCompleted.length).padStart(3)}  (${pct(loggedInButNeverCompleted.length).padStart(4)})`)
console.log(`  ✅ Actually used the product:          ${String(completedAtLeastOne.length).padStart(3)}  (${pct(completedAtLeastOne.length).padStart(4)})`)

const neverEngaged = neverSignedUp.length + signedUpNeverLoggedIn.length
console.log('')
console.log(`  Combined "never engaged":              ${String(neverEngaged).padStart(3)}  (${pct(neverEngaged).padStart(4)})  ← onboarding gap`)

if (neverSignedUp.length > 0) {
  console.log('\n── 🔴 Never signed up to KLARO ────────────────────────────────')
  for (const r of neverSignedUp.slice(0, 30)) console.log(`  ${r.name.padEnd(30)} ${r.email}`)
  if (neverSignedUp.length > 30) console.log(`  ... and ${neverSignedUp.length - 30} more`)
}
if (signedUpNeverLoggedIn.length > 0) {
  console.log('\n── 🟠 Signed up, never logged in ──────────────────────────────')
  for (const r of signedUpNeverLoggedIn.slice(0, 30)) console.log(`  ${r.name.padEnd(30)} ${r.email}`)
}
if (completedAtLeastOne.length > 0) {
  console.log('\n── ✅ Refunded but DID use the product (interesting!) ─────────')
  for (const r of completedAtLeastOne) console.log(`  ${r.name.padEnd(30)} ${r.email}  (completed ${r.completed} module${r.completed === 1 ? '' : 's'})`)
}

console.log('')
console.log('Report complete (read-only — no changes made).')
