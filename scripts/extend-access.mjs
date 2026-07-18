// ─── Extend a student's KLARO access ─────────────────────────────────────────
//
// Usage:
//   node --env-file=.env.local scripts/extend-access.mjs <email> <days>
//   node --env-file=.env.local scripts/extend-access.mjs maria@example.com 30
//
// Policy (2026-07-17): any student may request an extension; the team grants
// them case-by-case. No paid renewal flow exists yet.
//
// How it works: writes profiles.access_expires_at = (current effective expiry
// OR today, whichever is later) + <days>. The middleware and all display
// surfaces read this column first via lib/accessExpiry.ts, falling back to
// the legacy (created_at ?? enrolled_at) + 90d formula when it's NULL.
// Extending from "today" for already-expired students means a 30-day
// extension always gives 30 usable days, not 30 days bolted onto a
// long-past date.

import { createClient } from '@supabase/supabase-js'

const [email, daysArg] = process.argv.slice(2)
const days = parseInt(daysArg, 10)

if (!email || !days || days < 1) {
  console.error('Usage: node --env-file=.env.local scripts/extend-access.mjs <email> <days>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data: profile, error } = await supabase
  .from('profiles')
  .select('id, full_name, email, access_level, program_type, created_at, enrolled_at, access_expires_at')
  .ilike('email', email)
  .maybeSingle()

if (error || !profile) {
  console.error(`No profile found for ${email}` + (error ? ` (${error.message})` : ''))
  process.exit(1)
}

const DAY_MS = 86400000
// Mirror lib/accessExpiry.ts resolution: explicit column wins, else legacy formula.
const legacyStart = profile.created_at ?? profile.enrolled_at
const currentExpiry = profile.access_expires_at
  ? new Date(profile.access_expires_at)
  : legacyStart
    ? new Date(new Date(legacyStart).getTime() + 90 * DAY_MS)
    : null

const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry : new Date()
const newExpiry = new Date(base.getTime() + days * DAY_MS)

console.log(`Student:         ${profile.full_name} <${profile.email}>`)
console.log(`Access level:    ${profile.access_level} (${profile.program_type ?? 'no program'})`)
console.log(`Current expiry:  ${currentExpiry ? currentExpiry.toISOString().slice(0, 10) : 'none'}${currentExpiry && currentExpiry.getTime() < Date.now() ? ' (EXPIRED — extending from today)' : ''}`)
console.log(`New expiry:      ${newExpiry.toISOString().slice(0, 10)} (+${days} days)`)

await supabase.rpc('set_audit_context', { p_user: null, p_source: 'extend_access_script' })

const { error: updateError } = await supabase
  .from('profiles')
  .update({ access_expires_at: newExpiry.toISOString(), updated_at: new Date().toISOString() })
  .eq('id', profile.id)

if (updateError) {
  console.error(`Update failed: ${updateError.message}`)
  process.exit(1)
}

console.log('Done — access_expires_at written.')
