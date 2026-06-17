import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWelcomeEmail } from '@/lib/email/sendWelcomeEmail'

// ── /api/cron/weekly-pending-digest ──────────────────────────────────────────
//
// Catches accounts that the main 3-hourly cron keeps missing — the Mary
// Angelica Bonifacio class of bug, where Systeme.io's API returns empty for
// a contact that IS in Systeme.io.
//
// For every profile that's been stuck on `pending` for 7+ days:
//   1. Try the Systeme.io lookup 3 times with backoff. If any attempt
//      succeeds with paid tags, activate them.
//   2. If all 3 attempts return empty, add to a digest.
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
async function fetchSystemeTagsWithRetry(email: string): Promise<string[] | null> {
  const apiKey = process.env.SYSTEME_API_KEY
  if (!apiKey) return null
  const delays = [0, 800, 2400]
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]))
    try {
      const res = await fetch(`${SYSTEME_API_BASE}/contacts?email=${encodeURIComponent(email)}`, {
        headers: { 'X-API-Key': apiKey, accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        return (data.items[0].tags ?? []).map((t: { name: string }) => t.name)
      }
      // Empty result — could be transient. Retry.
    } catch {
      // Network error — retry.
    }
  }
  return null  // All 3 attempts failed/empty
}

interface DiagnoseResult {
  status: string
  action: 'activate' | 'skip'
  payload?: Record<string, unknown>
}

function diagnose(tags: string[] | null): DiagnoseResult {
  if (!tags || tags.length === 0) return { status: 'not_in_systeme', action: 'skip' }
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

async function sendDigest(stuck: Array<{ email: string; name: string | null; daysPending: number; finalStatus: string }>, activated: number) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[weekly-digest] RESEND_API_KEY not set — skipping email')
    return
  }

  const rows = stuck.map(s => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${s.name ?? '(no name)'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;">${s.email}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${s.daysPending}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#999;">${s.finalStatus}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
      <h2 style="color:#1A1F36;margin:0 0 8px 0;">KLARO Weekly Pending Account Audit</h2>
      <p style="color:#666;font-size:14px;margin:0 0 24px 0;">
        Generated ${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}
      </p>

      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 4px 0;font-size:14px;color:#666;">This week's automatic activations</p>
        <p style="margin:0;font-size:28px;font-weight:bold;color:#10B981;">${activated} ✓</p>
      </div>

      ${stuck.length === 0 ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;">
          <p style="margin:0;color:#166534;font-weight:bold;">All pending accounts are accounted for. ✓</p>
          <p style="margin:8px 0 0 0;color:#166534;font-size:14px;">
            Anyone stuck on pending has been verified as not-in-Systeme — they likely signed up directly without going through the funnel.
          </p>
        </div>
      ` : `
        <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="margin:0;color:#92400e;font-weight:bold;">${stuck.length} account(s) need manual review</p>
          <p style="margin:8px 0 0 0;color:#92400e;font-size:14px;">
            These have been pending for 7+ days. After 3 retry attempts against Systeme.io, no payment tags were found.
            <br><br>
            <strong>What to check:</strong> Did they pay using a different email than the one in KLARO? Are they on a tag scheme the cron doesn't recognize? Should they just be deleted as never-paid?
          </p>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:8px;text-align:left;color:#666;">Name</th>
              <th style="padding:8px;text-align:left;color:#666;">Email</th>
              <th style="padding:8px;text-align:center;color:#666;">Days</th>
              <th style="padding:8px;text-align:left;color:#666;">Last status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `}

      <p style="color:#999;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
        Sent by /api/cron/weekly-pending-digest. To stop, remove from vercel.json crons.
      </p>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [ADMIN_EMAIL],
        subject: stuck.length === 0
          ? `KLARO weekly: all clean ✓ (${activated} auto-activated)`
          : `KLARO weekly: ${stuck.length} stuck pending (${activated} auto-activated)`,
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

  const { data: pending } = await admin
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('access_level', 'pending')
    .lt('created_at', sevenDaysAgo)

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, activated: 0, stuck: 0, message: 'No long-pending accounts' })
  }

  await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_weekly_digest' })

  let activated = 0
  const stuck: Array<{ email: string; name: string | null; daysPending: number; finalStatus: string }> = []

  for (const p of pending) {
    const email = p.email ?? ''
    if (!email || isTestAccount(email)) continue

    const daysPending = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (24 * 60 * 60 * 1000))

    const tags = await fetchSystemeTagsWithRetry(email)
    const d = diagnose(tags)

    if (d.action === 'activate' && d.payload) {
      await admin.rpc('set_audit_context', { p_user: null, p_source: 'cron_weekly_digest' })
      const { error } = await admin.from('profiles').update(d.payload).eq('id', p.id)
      if (!error) {
        activated++
        console.log(`[weekly-digest] activated ${email} as ${d.status}`)
        // Welcome email — idempotent, fires only once per profile
        await sendWelcomeEmail({
          profileId: p.id,
          email,
          fullName: p.full_name,
          accessLevel: (d.payload.access_level as string) ?? 'enrolled',
          programType: (d.payload.program_type as string | undefined),
        })
      } else {
        stuck.push({ email, name: p.full_name, daysPending, finalStatus: `error: ${error.message}` })
      }
    } else {
      stuck.push({ email, name: p.full_name, daysPending, finalStatus: d.status })
    }

    await new Promise(r => setTimeout(r, 200))
  }

  await sendDigest(stuck, activated)

  console.log(`[weekly-digest] scanned=${pending.length} activated=${activated} stuck=${stuck.length}`)

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    scanned: pending.length,
    activated,
    stuck: stuck.length,
    stuck_accounts: stuck,
  })
}
