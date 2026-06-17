// Welcome email helper — sends a one-time activation email via Resend.
//
// Idempotency: checks profiles.welcome_email_sent_at before sending. If
// already sent, returns early without firing a second email. The DB column
// is stamped only after a successful Resend send.
//
// Triggered from every activation path:
//   - /api/cron/sweep-pending
//   - /api/cron/weekly-pending-digest
//   - /api/webhook/systeme (Accel-Enrolled handler)
//   - /api/webhooks/systeme (legacy plural)
//   - lib/claimPendingTags.ts
//   - Manual activation scripts (when SEND_WELCOME=1 is set)

import { createAdminClient } from '@/lib/supabase/admin'

const RESEND_FROM = 'KLARO <notify@notify.negosyouniversity.com>'
const REPLY_TO = 'jon@negosyouniversity.com'
const LOGIN_URL = 'https://klaro.chillyonaryo.com/login'
const SUPPORT_EMAIL = 'jon@negosyouniversity.com'

export interface WelcomeEmailContext {
  profileId: string
  email: string
  firstName?: string | null
  fullName?: string | null
  accessLevel: string       // 'enrolled' | 'full_access' | 'lite_workshop' | etc.
  programType?: string | null
}

export interface WelcomeEmailResult {
  sent: boolean
  reason?: 'already_sent' | 'no_api_key' | 'no_email' | 'resend_failed' | 'db_error'
  resendId?: string
}

export async function sendWelcomeEmail(ctx: WelcomeEmailContext): Promise<WelcomeEmailResult> {
  if (!ctx.email) return { sent: false, reason: 'no_email' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[welcome-email] RESEND_API_KEY not set — skipping')
    return { sent: false, reason: 'no_api_key' }
  }

  const admin = createAdminClient()

  // Idempotency check
  const { data: profile } = await admin
    .from('profiles')
    .select('welcome_email_sent_at')
    .eq('id', ctx.profileId)
    .maybeSingle()

  if (profile?.welcome_email_sent_at) {
    return { sent: false, reason: 'already_sent' }
  }

  const firstName = (ctx.firstName?.trim() || ctx.fullName?.split(' ')[0] || 'there').slice(0, 60)
  const subject = `Your KLARO access is ready ✨`
  const html = buildHtml({ firstName, accessLevel: ctx.accessLevel, programType: ctx.programType })
  const text = buildText({ firstName, accessLevel: ctx.accessLevel, programType: ctx.programType })

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
      console.warn(`[welcome-email] Resend ${res.status}: ${body.slice(0, 300)}`)
      return { sent: false, reason: 'resend_failed' }
    }
    const body = await res.json().catch(() => ({}))
    const resendId = body?.id

    // Stamp profile so we don't send twice
    const { error: stampErr } = await admin
      .from('profiles')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', ctx.profileId)
    if (stampErr) {
      console.warn(`[welcome-email] DB stamp failed for ${ctx.email}:`, stampErr.message)
      return { sent: true, resendId, reason: 'db_error' }
    }

    console.log(`[welcome-email] sent to ${ctx.email} (id=${resendId})`)
    return { sent: true, resendId }
  } catch (e) {
    console.warn('[welcome-email] error:', e)
    return { sent: false, reason: 'resend_failed' }
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

function buildHtml({ firstName }: { firstName: string; accessLevel: string; programType?: string | null }): string {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Welcome to KLARO</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1F36;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">

        <!-- Header band -->
        <tr><td style="background:#1A1F36;padding:32px 32px 28px;text-align:center;">
          <div style="display:inline-block;padding:8px 16px;background:rgba(244,185,66,0.15);border:1px solid rgba(244,185,66,0.4);border-radius:999px;color:#F4B942;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
            Access Activated
          </div>
          <h1 style="color:white;font-size:28px;font-weight:bold;margin:18px 0 0;line-height:1.2;">
            Welcome to KLARO, ${escapeHtml(firstName)}.
          </h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">

          <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#1F2937;">
            Your dashboard is ready. <strong>Module 1 — The Clarity Builder</strong> is unlocked and waiting. This is where you decide who your ebook is for, what problem you solve, and what makes your solution different — the foundation everything else builds on.
          </p>

          <!-- CTA -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
            <tr><td style="background:#1A1F36;border-radius:12px;">
              <a href="${LOGIN_URL}" style="display:inline-block;padding:14px 28px;color:white;text-decoration:none;font-weight:bold;font-size:15px;">
                Log in to KLARO →
              </a>
            </td></tr>
          </table>

          <p style="font-size:14px;line-height:1.6;color:#1F2937;margin:0 0 8px;font-weight:bold;">What happens next:</p>
          <ol style="font-size:14px;line-height:1.7;color:#1F2937;margin:0 0 24px 20px;padding:0;">
            <li>Log in with the email you signed up with: <span style="font-family:monospace;color:#666;">your email</span></li>
            <li>Spend 15–20 minutes on Module 1 — your Clarity Sentence</li>
            <li>Your Coach will reach out within 1–3 days to start coaching</li>
          </ol>

          <!-- Reassurance box -->
          <div style="background:#F8F9FA;border-radius:12px;padding:20px;margin:0 0 24px;border-left:3px solid #F4B942;">
            <p style="font-size:13px;line-height:1.6;margin:0;color:#1F2937;">
              <strong>One quick note:</strong> Modules 3-7 unlock as your Coach guides you through each step — this is intentional. We pace the program to your progress so you build real momentum, not just clicks.
            </p>
          </div>

          <!-- Support -->
          <p style="font-size:13px;line-height:1.6;color:#6B7280;margin:24px 0 0;border-top:1px solid #E5E7EB;padding-top:20px;">
            Stuck? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#1A1F36;font-weight:600;">${SUPPORT_EMAIL}</a> — Jon and the team will help.
          </p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F8F9FA;padding:20px 32px;text-align:center;font-size:12px;color:#9CA3AF;">
          KLARO by Negosyo University<br>
          You're receiving this because you just activated your KLARO access.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`.trim()
}

function buildText({ firstName }: { firstName: string; accessLevel: string; programType?: string | null }): string {
  return `
Welcome to KLARO, ${firstName}.

Your dashboard is ready. Module 1 — The Clarity Builder — is unlocked and waiting.
This is where you decide who your ebook is for, what problem you solve, and what
makes your solution different.

LOG IN HERE: ${LOGIN_URL}

What happens next:
  1. Log in with the email you signed up with
  2. Spend 15-20 minutes on Module 1 — your Clarity Sentence
  3. Your Coach will reach out within 1-3 days to start coaching

One quick note: Modules 3-7 unlock as your Coach guides you through each step.
We pace the program to your progress so you build real momentum.

Stuck? Reply to this email or write to ${SUPPORT_EMAIL}.

— KLARO by Negosyo University
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
