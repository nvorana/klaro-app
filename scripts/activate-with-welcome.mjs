// One-shot activation tool — auto-detects tier from Systeme.io, activates
// the profile in KLARO with proper audit context, and sends the welcome
// email via Resend. Idempotent (won't double-send the welcome email).
//
// This is the tool to use for every "Status: email" / "Activate: email"
// request so we never forget the welcome email again.
//
// Run:
//   node --env-file=.env.local scripts/activate-with-welcome.mjs <email>
//
// Example:
//   node --env-file=.env.local scripts/activate-with-welcome.mjs gabu2@yahoo.com

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// POLICY (July 1, 2026): new AP students no longer receive KLARO access.
// Mirrors lib/apKlaroPolicy.ts — keep them in sync when the constants change.
const AP_KLARO_CUTOFF = new Date('2026-06-30T16:00:00Z')  // = July 1 midnight Manila
function isPostCutoffAPProfile(createdAt) {
  if (!createdAt) return true
  return new Date(createdAt).getTime() >= AP_KLARO_CUTOFF.getTime()
}
const SYSTEME_API_BASE = process.env.SYSTEME_API_BASE_URL || 'https://api.systeme.io/api'
const SYSTEME_API_KEY = process.env.SYSTEME_API_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EDGAR_COACH_ID = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442'

const RESEND_FROM = 'KLARO <notify@notify.negosyouniversity.com>'
const REPLY_TO = 'jon@negosyouniversity.com'
const LOGIN_URL = 'https://klaro.chillyonaryo.com/login'
const SUPPORT_EMAIL = 'jon@negosyouniversity.com'

const email = process.argv[2]
if (!email) { console.error('Usage: activate-with-welcome.mjs <email>'); process.exit(1) }

// ── Step 1: Look up KLARO profile (gracefully handle missing welcome col) ──
let profile, lookupError, hasWelcomeCol = true
;({ data: profile, error: lookupError } = await supabase
  .from('profiles')
  .select('id, full_name, first_name, access_level, program_type, unlocked_modules, coach_id, welcome_email_sent_at, created_at')
  .eq('email', email)
  .maybeSingle())

if (lookupError && lookupError.message?.includes('welcome_email_sent_at')) {
  // Column doesn't exist yet — fall back to select without it
  console.log('(welcome_email_sent_at column missing — falling back; will skip idempotency stamp)')
  hasWelcomeCol = false
  ;({ data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id, full_name, first_name, access_level, program_type, unlocked_modules, coach_id, created_at')
    .eq('email', email)
    .maybeSingle())
}

if (lookupError) {
  console.error(`✗ Lookup error: ${lookupError.message}`)
  process.exit(1)
}

if (!profile) {
  console.error(`✗ ${email}: NOT FOUND in KLARO (they need to sign up first)`)
  process.exit(1)
}

console.log(`KLARO profile found: ${profile.full_name ?? '(no name)'}`)
console.log(`  access_level:     ${profile.access_level}`)
console.log(`  program_type:     ${profile.program_type ?? '(none)'}`)
console.log(`  unlocked_modules: ${JSON.stringify(profile.unlocked_modules ?? [])}`)
console.log(`  welcome email:    ${hasWelcomeCol ? (profile.welcome_email_sent_at ?? 'never sent') : '(column not present — assuming never sent)'}`)

// ── Step 2: Auto-detect tier from Systeme.io ──────────────────────────────
async function fetchSystemeTags() {
  if (!SYSTEME_API_KEY) return null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 800))
    try {
      const res = await fetch(`${SYSTEME_API_BASE}/contacts?email=${encodeURIComponent(email)}`, {
        headers: { 'X-API-Key': SYSTEME_API_KEY, accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        return (data.items[0].tags ?? []).map(t => t.name)
      }
    } catch {}
  }
  return null
}

console.log('\nChecking Systeme.io tags…')
const tags = await fetchSystemeTags()
if (tags === null) {
  console.error('✗ Could not fetch Systeme.io tags (or contact not found). Skipping activation.')
  process.exit(1)
}

const lower = tags.map(t => t.toLowerCase())

let cohortBatch = null
for (const t of tags) {
  const m = t.match(/TOPIS\s*\|?\s*(\d+)/i)
  if (m) { cohortBatch = parseInt(m[1]); break }
}

const isAccelEnrolled = lower.some(t => t === 'accel-enrolled' || t === 'accelerator-enrolled' || t === 'accelerator-program')
const isAccelFullPaid = lower.some(t => /accel.*full.*payment/i.test(t)) || lower.some(t => /ap \| payment \| fully_paid/i.test(t))
const isTopisStudent = tags.some(t => /^TOPIS \| Student$/i.test(t) || /^TOPIS-Student$/i.test(t) || /^TOPIS \d+ Student$/i.test(t))
const isTopisFullyPaid = tags.some(t => /TOPIS \| \d+ \| PAYMENT \| FULLY_PAID/i.test(t)) || tags.some(t => /TOPIS-\d+-Full-Payment/i.test(t))
const isTopisPaid = tags.some(t => /TOPIS \d+ (Manual|Online) Paid/i.test(t) || /TOPIS \| \d+ \| PAYMENT \| (MANUAL_PAID|ONLINE_PAID|PAY_)/i.test(t))

const now = new Date().toISOString()
let payload = null
let verdict = ''

if (isAccelEnrolled) {
  payload = {
    access_level: isAccelFullPaid ? 'full_access' : 'enrolled',
    program_type: 'accelerator',
    coach_id: EDGAR_COACH_ID,
    unlocked_modules: [1, 2],
    enrolled_at: now,
    access_suspended: false,
  }
  if (isAccelFullPaid) payload.full_access_granted_at = now
  verdict = isAccelFullPaid ? 'AP fully paid' : 'AP partial-pay'
} else if (isTopisStudent || isTopisFullyPaid || isTopisPaid) {
  payload = {
    access_level: isTopisFullyPaid ? 'full_access' : 'enrolled',
    program_type: 'topis',
    coach_id: null,
    enrolled_at: now,
    access_suspended: false,
  }
  if (cohortBatch) payload.cohort_batch = cohortBatch
  if (isTopisFullyPaid) payload.full_access_granted_at = now
  verdict = `TOPIS ${cohortBatch ?? '?'} ${isTopisFullyPaid ? 'fully paid' : 'partial-pay'}`
} else {
  const tierTag = tags.find(t => /^Klaro-tier(\d+)$/i.test(t)) || tags.find(t => /KLARO-FULLPAY/i.test(t))
  if (tierTag) {
    const tierMatch = tierTag.match(/tier(\d+)/i)
    payload = {
      access_level: tierMatch ? `tier${tierMatch[1]}` : 'full_access',
      enrolled_at: now,
      access_suspended: false,
    }
    verdict = `KLARO tier (${tierTag})`
  } else {
    console.log('\n⚠ No paid customer tags found in Systeme.io. Tags:')
    for (const t of tags) console.log(`    - ${t}`)
    console.log('\nLikely a lead, not a paying customer. Not activating.')
    process.exit(0)
  }
}

console.log(`\nSysteme verdict: ${verdict}`)

// POLICY (July 1, 2026): block new AP activations for post-cutoff profiles.
if (payload?.program_type === 'accelerator' && isPostCutoffAPProfile(profile.created_at)) {
  console.log(`\n🚫 BLOCKED by July 1 policy — AP students created on/after ${AP_KLARO_CUTOFF.toISOString()} no longer receive KLARO access.`)
  console.log(`   Profile created: ${profile.created_at}`)
  console.log(`   No activation applied. No welcome email sent.`)
  console.log(`   To revert: edit lib/apKlaroPolicy.ts.`)
  process.exit(0)
}

// ── Step 3: Apply activation ───────────────────────────────────────────────
await supabase.rpc('set_audit_context', { p_user: null, p_source: 'admin_grant_script' })
const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id)
if (error) {
  console.error(`\n✗ Activation update failed: ${error.message}`)
  process.exit(1)
}
console.log('\n✓ Activation applied:')
for (const [k, v] of Object.entries(payload)) {
  if (k === 'coach_id' && v === EDGAR_COACH_ID) console.log(`  ${k}: Edgar`)
  else console.log(`  ${k}: ${JSON.stringify(v)}`)
}

// ── Step 4: Send welcome email (idempotent) ────────────────────────────────
if (!RESEND_API_KEY) {
  console.log('\n⚠ RESEND_API_KEY not set — skipping welcome email')
  process.exit(0)
}

if (hasWelcomeCol && profile.welcome_email_sent_at) {
  console.log(`\nWelcome email: already sent on ${profile.welcome_email_sent_at}, skipping`)
  process.exit(0)
}

const firstName = (profile.first_name?.trim() || profile.full_name?.split(' ')[0] || 'there').slice(0, 60)
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Welcome to KLARO</title></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1F36;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background:#1A1F36;padding:32px 32px 28px;text-align:center;">
          <div style="display:inline-block;padding:8px 16px;background:rgba(244,185,66,0.15);border:1px solid rgba(244,185,66,0.4);border-radius:999px;color:#F4B942;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Access Activated</div>
          <h1 style="color:white;font-size:28px;font-weight:bold;margin:18px 0 0;line-height:1.2;">Welcome to KLARO, ${escapeHtml(firstName)}.</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#1F2937;">Your dashboard is ready. <strong>Module 1 — The Clarity Builder</strong> is unlocked and waiting. This is where you decide who your ebook is for, what problem you solve, and what makes your solution different — the foundation everything else builds on.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
            <tr><td style="background:#1A1F36;border-radius:12px;"><a href="${LOGIN_URL}" style="display:inline-block;padding:14px 28px;color:white;text-decoration:none;font-weight:bold;font-size:15px;">Log in to KLARO →</a></td></tr>
          </table>
          <p style="font-size:14px;line-height:1.6;color:#1F2937;margin:0 0 8px;font-weight:bold;">What happens next:</p>
          <ol style="font-size:14px;line-height:1.7;color:#1F2937;margin:0 0 24px 20px;padding:0;">
            <li>Log in with the email you signed up with</li>
            <li>Spend 15–20 minutes on Module 1 — your Clarity Sentence</li>
            <li>Your Coach will reach out within 1–3 days to start coaching</li>
          </ol>
          <div style="background:#F8F9FA;border-radius:12px;padding:20px;margin:0 0 24px;border-left:3px solid #F4B942;">
            <p style="font-size:13px;line-height:1.6;margin:0;color:#1F2937;"><strong>One quick note:</strong> Modules 3-7 unlock as your Coach guides you through each step — this is intentional. We pace the program to your progress so you build real momentum, not just clicks.</p>
          </div>
          <p style="font-size:13px;line-height:1.6;color:#6B7280;margin:24px 0 0;border-top:1px solid #E5E7EB;padding-top:20px;">Stuck? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#1A1F36;font-weight:600;">${SUPPORT_EMAIL}</a> — Jon and the team will help.</p>
        </td></tr>
        <tr><td style="background:#F8F9FA;padding:20px 32px;text-align:center;font-size:12px;color:#9CA3AF;">KLARO by Negosyo University<br>You're receiving this because you just activated your KLARO access.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

const text = `Welcome to KLARO, ${firstName}.

Your dashboard is ready. Module 1 — The Clarity Builder — is unlocked and waiting.

LOG IN HERE: ${LOGIN_URL}

What happens next:
  1. Log in with the email you signed up with
  2. Spend 15-20 minutes on Module 1 — your Clarity Sentence
  3. Your Coach will reach out within 1-3 days to start coaching

One quick note: Modules 3-7 unlock as your Coach guides you through each step.

Stuck? Reply to this email or write to ${SUPPORT_EMAIL}.

— KLARO by Negosyo University`

console.log('\nSending welcome email…')
const sendRes = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: RESEND_FROM,
    to: [email],
    reply_to: REPLY_TO,
    subject: 'Your KLARO access is ready ✨',
    html,
    text,
  }),
})

if (!sendRes.ok) {
  console.error(`✗ Welcome email send failed: ${sendRes.status} ${await sendRes.text()}`)
  process.exit(0)
}
const sendBody = await sendRes.json()
console.log(`✓ Welcome email sent (Resend id: ${sendBody.id})`)

// Stamp the column (gracefully handle missing column)
if (!hasWelcomeCol) {
  console.warn('\n⚠ welcome_email_sent_at column not present — no idempotency stamp.')
  console.warn('  Run migrations/welcome_email_tracking.sql in Supabase to prevent re-sends.')
} else {
  const { error: stampErr } = await supabase
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', profile.id)
  if (stampErr) console.warn(`⚠ Could not stamp welcome_email_sent_at: ${stampErr.message}`)
  else console.log('✓ welcome_email_sent_at stamped — future activations will not re-send')
}
