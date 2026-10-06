import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWelcomeEmail } from '@/lib/email/sendWelcomeEmail'
import { isPostCutoffAPProfile } from '@/lib/apKlaroPolicy'

// ── /api/cron/weekly-pending-digest ──────────────────────────────────────────
//
// Catches accounts that the main 3-hourly cron keeps missing — the Mary
// Angelica Bonifacio class of bug, where Systeme.io's API returns empty for
// a contact that IS in Systeme.io.
//
// For every profile that's been stuck on `pending` for 7+ days:
//   1. Try the Systeme.io lookup 3 times with backoff. If any attempt
//      succeeds with paid tags, activate them.
//   2. Report policy skips separately from lookup and activation exceptions.
// At the end, email the digest to the admin via Resend so a human can
// investigate the ones the API keeps missing.
//
// Schedule: weekly (Mondays 06:00 Manila / 22:00 UTC Sunday). On Vercel
// Hobby this clamps to daily, which is fine — it just means the digest
// arrives more often.

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const EDGAR_COACH_ID = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442'
const SYSTEME_API_BASE = process.env.SYSTEME_API_BASE_URL || 'https://api.systeme.io/api'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nvorana@gmail.com'
const RESEND_FROM = 'KLARO <notify@notify.negosyouniversity.com>'
const TEST_ACCOUNT_PATTERNS = [/^nvorana\+/i, /\+test\d*@/i]

function isTestAccount(email: string): boolean {
  return TEST_ACCOUNT_PATTERNS.some(p => p.test(email))
}

// 3 attempts with exponential backoff: 0ms, 800ms, 2400ms.
async function fetchSystemeTagsWithRetry(email: string): Promise<{ status: 'found'; tags: string[] } | { status: 'not_found' | 'lookup_failed' }> {
  const apiKey = process.env.SYSTEME_API_KEY
  if (!apiKey) return { status: 'lookup_failed' }
  const delays = [0, 800, 2400]
  let emptyResults = 0
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]))
    try {
      const res = await fetch(`${SYSTEME_API_BASE}/contacts?email=${encodeURIComponent(email)}`, {
        headers: { 'X-API-Key': apiKey, accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      if (!Array.isArray(data.items)) throw new Error('Invalid Systeme.io contacts response')
      if (data.items.length > 0) {
        return { status: 'found', tags: (data.items[0].tags ?? []).map((t: { name: string }) => t.name) }
      }
      // Empty result — could be transient. Retry.
      emptyResults++
    } catch {
      // Network error — retry.
    }
  }
  return { status: emptyResults === delays.length ? 'not_found' : 'lookup_failed' }
}

interface DiagnoseResult {
  status: string
  action: 'activate' | 'skip'
  payload?: Record<string, unknown>
}

function diagnose(tags: string[]): DiagnoseResult {
  const lower = tags.map(t => t.toLowerCase())

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

  const isTopisStudent = tags.some(t => /^TOPIS \| Student$/i.test(t) || /^TOPIS-Student$/i.test(t) || /^TOPIS \d+ Student$/i.test(t))
  const isTopisFullyPaid = tags.some(t => /TOPIS \| \d+ \| PAYMENT \| FULLY_PAID/i.test(t)) || tags.some(t => /TOPIS-\d+-Full-Payment/i.test(t))
  const isTopisPaid = tags.some(t => /TOPIS \d+ (Manual|Online) Paid/i.test(t) || /TOPIS \| \d+ \| PAYMENT \| (MANUAL_PAID|ONLINE_PAID|PAY_)/i.test(t))

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

interface AuditAccount {
  email: string
  name: string | null
  daysPending: number
  finalStatus: string
}

interface AuditGroups {
  policy_skips: AuditAccount[]
  leads: AuditAccount[]
  not_found: AuditAccount[]
  lookup_failures: AuditAccount[]
  activation_failures: AuditAccount[]
  activations: AuditAccount[]
}

function reviewAccounts(groups: AuditGroups): AuditAccount[] {
  return [...groups.leads, ...groups.not_found, ...groups.lookup_failures, ...groups.activation_failures]
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

async function sendDigest(groups: AuditGroups) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[weekly-digest] RESEND_API_KEY not set — skipping email')
    return
  }
  const reviewCount = reviewAccounts(groups).length
  const activated = groups.activations.length
  const sections: Array<[string, string, AuditAccount[]]> = [
    ['Expected AP policy skips', 'AP enrollment tags were found, but the July 1, 2026 (Manila) cutoff policy blocks automatic activation. No manual review is required solely for this policy skip.', groups.policy_skips],
    ['Leads / no recognized enrollment or payment tags', 'The contact was found in Systeme.io without recognized enrollment or payment tags. Found contacts return immediately; three retries are only used for empty or failed lookups. Check payment email and tag naming before deciding whether access is warranted.', groups.leads],
    ['Contacts not found', 'All three Systeme.io lookup attempts returned no contact. This is not proof of non-payment; check for a different email or a missing contact.', groups.not_found],
    ['Lookup failures', 'Systeme.io could not be reliably checked (API configuration, HTTP, network, or response errors). Payment status is unknown; retry or investigate the integration.', groups.lookup_failures],
    ['Activation failures', 'Recognized enrollment or payment tags were found, but the profile update failed. Investigate the database error; these are not missing-payment cases.', groups.activation_failures],
    ['Successful automatic activations', 'The profile update succeeded. Welcome email delivery is handled separately by the idempotent welcome-email sender.', groups.activations],
  ]
  const html = `
    <div style="font-family:sans-serif;max-width:760px;margin:0 auto;padding:24px;">
      <h2>KLARO Weekly Pending Account Audit</h2>
      <p>Generated ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' })} (Manila)</p>
      <p><strong>${reviewCount} account(s) need manual review</strong>;
        ${groups.policy_skips.length} expected policy skip(s);
        ${activated} successful automatic activation(s).</p>
      ${reviewCount === 0 ? '<p>No manual-review exceptions were found in this audit.</p>' : '<p>Review the leads, not-found contacts, lookup failures, and activation failures below.</p>'}
      ${sections.map(([title, description, accounts]) => `
        <h3>${title}: ${accounts.length}</h3><p>${description}</p>
        ${accounts.length ? `<table style="width:100%;border-collapse:collapse;">
          <thead><tr><th>Name</th><th>Email</th><th>Days pending</th><th>Status</th></tr></thead>
          <tbody>${accounts.map(account => `<tr>
            <td>${escapeHtml(account.name ?? '(no name)')}</td>
            <td>${escapeHtml(account.email)}</td>
            <td>${account.daysPending}</td>
            <td>${escapeHtml(account.finalStatus)}</td>
          </tr>`).join('')}</tbody></table>` : ''}
      `).join('')}
      <p>Sent by /api/cron/weekly-pending-digest. To stop, remove from vercel.json crons.</p>
    </div>
  `
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [ADMIN_EMAIL],
        subject: `KLARO weekly: ${reviewCount} manual review, ${groups.policy_skips.length} policy skips (${activated} auto-activated)`,
        html,
      }),
    })
    if (!res.ok) console.warn('[weekly-digest] Resend send failed:', res.status, await res.text())
  } catch (e) {
    console.warn('[weekly-digest] Resend send error:', e)
  }
}

export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }

async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  const authHeader = request.headers.get('authorization') ?? ''
  const querySecret = request.nextUrl.searchParams.get('secret') ?? ''
  if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: pending, error: pendingError } = await admin
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('access_level', 'pending')
    .lt('created_at', sevenDaysAgo)

  if (pendingError) {
    console.error('[weekly-digest] pending query failed:', pendingError.message)
    return NextResponse.json({ error: 'Unable to load pending accounts' }, { status: 500 })
  }

  await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_weekly_digest' })

  const groups: AuditGroups = {
    policy_skips: [], leads: [], not_found: [], lookup_failures: [], activation_failures: [], activations: [],
  }
  let ignored = 0

  for (const p of pending ?? []) {
    const email = p.email ?? ''
    if (!email || isTestAccount(email)) { ignored++; continue }

    const daysPending = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (24 * 60 * 60 * 1000))

    const account = { email, name: p.full_name, daysPending }
    const lookup = await fetchSystemeTagsWithRetry(email)
    if (lookup.status !== 'found') {
      const category = lookup.status === 'not_found' ? groups.not_found : groups.lookup_failures
      category.push({ ...account, finalStatus: lookup.status })
      await new Promise(r => setTimeout(r, 200))
      continue
    }
    const d = diagnose(lookup.tags)

    if (d.action === 'activate' && d.payload) {
      // POLICY (July 1, 2026): skip AP activations for post-cutoff profiles.
      const isAP = d.payload.program_type === 'accelerator'
      if (isAP && isPostCutoffAPProfile(p.created_at)) {
        groups.policy_skips.push({ ...account, finalStatus: 'skip_ap_policy' })
        continue
      }
      await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_weekly_digest' })
      const { error } = await admin.from('profiles').update(d.payload).eq('id', p.id)
      if (!error) {
        groups.activations.push({ ...account, finalStatus: d.status })
        console.log(`[weekly-digest] activated ${email} as ${d.status}`)
        // Welcome email — idempotent, fires only once per profile
        try {
          await sendWelcomeEmail({
            profileId: p.id,
            email,
            fullName: p.full_name,
            accessLevel: (d.payload.access_level as string) ?? 'enrolled',
            programType: (d.payload.program_type as string | undefined),
          })
        } catch (error) {
          console.warn('[weekly-digest] welcome email failed:', error)
        }
      } else {
        groups.activation_failures.push({ ...account, finalStatus: `activation_error: ${error.message}` })
      }
    } else {
      groups.leads.push({ ...account, finalStatus: d.status })
    }

    await new Promise(r => setTimeout(r, 200))
  }

  const stuck = reviewAccounts(groups)
  const activated = groups.activations.length
  const counts = Object.fromEntries(Object.entries(groups).map(([category, accounts]) => [category, accounts.length]))
  await sendDigest(groups)

  console.log(`[weekly-digest] scanned=${pending?.length ?? 0} activated=${activated} stuck=${stuck.length}`)

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    scanned: pending?.length ?? 0,
    ignored,
    counts,
    accounts: groups,
    manual_review: stuck.length,
    activated,
    stuck: stuck.length,
    stuck_accounts: stuck,
  })
}
