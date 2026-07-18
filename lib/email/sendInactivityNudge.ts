// Inactivity nudge email — a short, warm check-in for students who haven't
// opened KLARO in 7-21 days. Sent by /api/cron/nudge-inactive.
//
// Throttle/idempotency: at most ONE nudge per student per 14 days. Every send
// is logged in webhook_logs with action='inactivity_nudge_sent'; before
// sending we check the most recent such row's processed_at and skip if it's
// within the last 14 days.
//
// From-address, styling wrapper, and Resend fetch pattern mirror
// lib/email/sendWelcomeEmail.ts.

import { createAdminClient } from '@/lib/supabase/admin'

const RESEND_FROM = 'KLARO <notify@notify.negosyouniversity.com>'
const REPLY_TO = 'jon@negosyouniversity.com'
const LOGIN_URL = 'https://klaro.chillyonaryo.com/login'
const SUPPORT_EMAIL = 'jon@negosyouniversity.com'

const NUDGE_COOLDOWN_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export interface InactivityNudgeContext {
  email: string
  firstName?: string | null
  fullName?: string | null
  /** Title of the highest module currently unlocked for this student. */
  nextModuleTitle: string
  nextModuleNumber: number
}

export interface InactivityNudgeResult {
  sent: boolean
  reason?: 'recently_nudged' | 'no_api_key' | 'no_email' | 'resend_failed'
  resendId?: string
}

export async function sendInactivityNudge(ctx: InactivityNudgeContext): Promise<InactivityNudgeResult> {
  if (!ctx.email) return { sent: false, reason: 'no_email' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[inactivity-nudge] RESEND_API_KEY not set — skipping')
    return { sent: false, reason: 'no_api_key' }
  }

  const admin = createAdminClient()

  // Throttle: skip if a nudge went out within the last 14 days
  const { data: lastNudge } = await admin
    .from('webhook_logs')
    .select('processed_at')
    .eq('contact_email', ctx.email)
    .eq('action', 'inactivity_nudge_sent')
    .order('processed_at', { ascending: false })
    .limit(1)

  if (lastNudge && lastNudge.length > 0 && lastNudge[0].processed_at) {
    const ageMs = Date.now() - new Date(lastNudge[0].processed_at).getTime()
    if (ageMs < NUDGE_COOLDOWN_DAYS * DAY_MS) {
      return { sent: false, reason: 'recently_nudged' }
    }
  }

  const firstName = (ctx.firstName?.trim() || ctx.fullName?.split(' ')[0] || 'there').slice(0, 60)
  const subject = 'Your KLARO workspace is waiting for you'
  const html = buildHtml({ firstName, moduleTitle: ctx.nextModuleTitle, moduleNumber: ctx.nextModuleNumber })
  const text = buildText({ firstName, moduleTitle: ctx.nextModuleTitle, moduleNumber: ctx.nextModuleNumber })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [ctx.email],
        reply_to: REPLY_TO,
        subject,
        html,
        text,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.warn(`[inactivity-nudge] Resend ${res.status} for ${ctx.email}: ${body.slice(0, 300)}`)
      return { sent: false, reason: 'resend_failed' }
    }
    const body = await res.json().catch(() => ({}))
    const resendId = body?.id

    // Log the send so the 14-day throttle holds across runs
    await admin.from('webhook_logs').insert({
      payload: { resend_id: resendId ?? null, next_module: ctx.nextModuleNumber },
      tag_name: 'INACTIVITY_NUDGE',
      contact_email: ctx.email,
      action: 'inactivity_nudge_sent',
    })

    console.log(`[inactivity-nudge] sent to ${ctx.email} (resend_id=${resendId})`)
    return { sent: true, resendId }
  } catch (e) {
    console.warn('[inactivity-nudge] error:', e)
    return { sent: false, reason: 'resend_failed' }
  }
}

// ── Templates ────────────────────────────────────────────────────────────────
// Register: casual conversational English with light natural Tagalog. Short.
// No em dashes, no formal words, no forced Tagalog.

function buildHtml({ firstName, moduleTitle, moduleNumber }: { firstName: string; moduleTitle: string; moduleNumber: number }): string {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Your KLARO workspace is waiting</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1F36;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">

        <tr><td style="padding:32px;">

          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#1F2937;">Hi ${escapeHtml(firstName)},</p>

          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#1F2937;">Quick check-in lang. <strong>Module ${moduleNumber} (${escapeHtml(moduleTitle)})</strong> is unlocked and ready in your KLARO workspace.</p>

          <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#1F2937;">Even 15 minutes today is enough to pick up where you left off. Tuloy lang tayo.</p>

          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
            <tr><td style="background:#1A1F36;border-radius:12px;">
              <a href="${LOGIN_URL}" style="display:inline-block;padding:14px 28px;color:white;text-decoration:none;font-weight:bold;font-size:15px;">Open my KLARO workspace →</a>
            </td></tr>
          </table>

          <p style="font-size:13px;line-height:1.6;color:#6B7280;margin:24px 0 0;border-top:1px solid #E5E7EB;padding-top:20px;">Stuck on something? Just reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#1A1F36;font-weight:600;">${SUPPORT_EMAIL}</a> and we'll help you move forward.</p>

        </td></tr>

        <tr><td style="background:#F8F9FA;padding:20px 32px;text-align:center;font-size:12px;color:#9CA3AF;">KLARO by Negosyo University</td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`.trim()
}

function buildText({ firstName, moduleTitle, moduleNumber }: { firstName: string; moduleTitle: string; moduleNumber: number }): string {
  return `
Hi ${firstName},

Quick check-in lang. Module ${moduleNumber} (${moduleTitle}) is unlocked and ready in your KLARO workspace.

Even 15 minutes today is enough to pick up where you left off. Tuloy lang tayo.

OPEN YOUR WORKSPACE: ${LOGIN_URL}

Stuck on something? Just reply to this email and we'll help you move forward.

- KLARO by Negosyo University
`.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
