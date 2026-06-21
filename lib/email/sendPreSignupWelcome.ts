// Pre-signup welcome email — sent when Systeme.io fires a paid customer
// tag (Accel-Enrolled, TOPIS-Student, etc.) for a contact who does NOT
// yet have a KLARO account.
//
// This is the fix for the 49-refunder leak: previously these contacts paid,
// got no email from KLARO, never figured out where to sign up, and refunded.
//
// Idempotency: tracked via webhook_logs.action = 'pre_signup_welcome_sent'.
// Before sending, we query webhook_logs for a previous send to this email.
// If found, we skip (so Systeme retries / duplicate tag fires don't spam
// the contact).

import { createAdminClient } from '@/lib/supabase/admin'

const RESEND_FROM = 'KLARO <notify@notify.negosyouniversity.com>'
const REPLY_TO = 'jon@negosyouniversity.com'
const SIGNUP_URL = 'https://klaro.chillyonaryo.com/signup'
const SUPPORT_EMAIL = 'jon@negosyouniversity.com'

export interface PreSignupContext {
  email: string
  firstName?: string | null
  fullName?: string | null
}

export interface PreSignupResult {
  sent: boolean
  reason?: 'already_sent' | 'no_api_key' | 'no_email' | 'resend_failed'
  resendId?: string
}

export async function sendPreSignupWelcome(ctx: PreSignupContext): Promise<PreSignupResult> {
  if (!ctx.email) return { sent: false, reason: 'no_email' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[pre-signup-welcome] RESEND_API_KEY not set — skipping')
    return { sent: false, reason: 'no_api_key' }
  }

  const admin = createAdminClient()

  // Idempotency — has this email been sent before?
  const { data: existing } = await admin
    .from('webhook_logs')
    .select('processed_at')
    .eq('contact_email', ctx.email)
    .eq('action', 'pre_signup_welcome_sent')
    .limit(1)

  if (existing && existing.length > 0) {
    console.log(`[pre-signup-welcome] already sent to ${ctx.email} (${existing[0].processed_at}), skipping`)
    return { sent: false, reason: 'already_sent' }
  }

  const firstName = (ctx.firstName?.trim() || ctx.fullName?.split(' ')[0] || 'there').slice(0, 60)
  const html = buildHtml(firstName)
  const text = buildText(firstName)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [ctx.email],
        reply_to: REPLY_TO,
        subject: 'Set up your KLARO account in 2 minutes',
        html,
        text,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.warn(`[pre-signup-welcome] Resend ${res.status} for ${ctx.email}: ${body.slice(0, 300)}`)
      return { sent: false, reason: 'resend_failed' }
    }
    const body = await res.json().catch(() => ({}))
    const resendId = body?.id

    // Log the send so we never re-send to the same email
    await admin.from('webhook_logs').insert({
      payload: { resend_id: resendId, first_name: firstName },
      tag_name: 'PRE_SIGNUP_WELCOME',
      contact_email: ctx.email,
      action: 'pre_signup_welcome_sent',
    })

    console.log(`[pre-signup-welcome] sent to ${ctx.email} (resend_id=${resendId})`)
    return { sent: true, resendId }
  } catch (e) {
    console.warn('[pre-signup-welcome] error:', e)
    return { sent: false, reason: 'resend_failed' }
  }
}

// ── Template (matches the brief email Jon approved) ─────────────────────────

function buildHtml(firstName: string): string {
  const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Set up your KLARO account</title></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1F36;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background:#1A1F36;padding:32px 32px 28px;text-align:center;">
          <div style="display:inline-block;padding:8px 16px;background:rgba(244,185,66,0.15);border:1px solid rgba(244,185,66,0.4);border-radius:999px;color:#F4B942;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Action Required</div>
          <h1 style="color:white;font-size:26px;font-weight:bold;margin:18px 0 0;line-height:1.2;">Set up your KLARO account in 2 minutes</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#1F2937;">Hi ${safe(firstName)},</p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#1F2937;">Welcome — your access is ready. Here's how to get into KLARO and what to expect.</p>

          <p style="font-size:15px;line-height:1.6;margin:0 0 12px;color:#1F2937;font-weight:bold;">1. Create your account</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;">
            <tr><td style="background:#1A1F36;border-radius:12px;"><a href="${SIGNUP_URL}" style="display:inline-block;padding:14px 28px;color:white;text-decoration:none;font-weight:bold;font-size:15px;">Sign up at klaro.chillyonaryo.com →</a></td></tr>
          </table>
          <div style="background:#FFFBEB;border:1px solid #FEF3C7;border-radius:10px;padding:14px 16px;margin:0 0 28px;">
            <p style="font-size:13px;line-height:1.6;margin:0;color:#92400E;"><strong>⚠ Important:</strong> use the <strong>SAME email address</strong> you used when you paid. That's how we automatically grant your access.</p>
          </div>

          <p style="font-size:15px;line-height:1.6;margin:0 0 8px;color:#1F2937;font-weight:bold;">2. Spend 15 minutes on Module 1</p>
          <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#1F2937;">KLARO is the in-house AI we built specifically for the One-Person Income System. Module 1 — The Clarity Builder — is where you decide who you help, what problem you solve, and what makes your solution unique. By the end, you'll have your <strong>Clarity Sentence</strong> — the foundation everything else builds on.</p>

          <p style="font-size:15px;line-height:1.6;margin:0 0 8px;color:#1F2937;font-weight:bold;">3. Your Coach takes it from there</p>
          <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#1F2937;">Within 1–3 days, your Coach will reach out to plan your next steps. They'll guide you through the rest of the program — from your full ebook to your sales page, emails, and lead magnet.</p>

          <p style="font-size:14px;line-height:1.6;color:#1F2937;margin:24px 0 0;">That's it. Set up your account today so you can start strong.</p>

          <p style="font-size:13px;line-height:1.6;color:#6B7280;margin:24px 0 0;border-top:1px solid #E5E7EB;padding-top:20px;">Need help? Just reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#1A1F36;font-weight:600;">${SUPPORT_EMAIL}</a> — Jon and the team will help.</p>

          <p style="font-size:14px;line-height:1.6;color:#1F2937;margin:24px 0 0;">Excited to see what you build,<br><strong>Jon Oraña</strong><br>Negosyo University</p>
        </td></tr>
        <tr><td style="background:#F8F9FA;padding:20px 32px;text-align:center;font-size:12px;color:#9CA3AF;">KLARO by Negosyo University<br>You're receiving this because you just enrolled in our program.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildText(firstName: string): string {
  return `Hi ${firstName},

Welcome — your access is ready. Here's how to get into KLARO and what to expect.

1. CREATE YOUR ACCOUNT
   ${SIGNUP_URL}

   ⚠ IMPORTANT: use the SAME email you used when you paid. That's how we automatically grant your access.

2. SPEND 15 MINUTES ON MODULE 1
   KLARO is the in-house AI we built specifically for the One-Person Income System.
   Module 1 — The Clarity Builder — is where you decide who you help, what problem you solve,
   and what makes your solution unique. By the end, you'll have your Clarity Sentence — the
   foundation everything else builds on.

3. YOUR COACH TAKES IT FROM THERE
   Within 1-3 days, your Coach will reach out to plan your next steps. They'll guide you
   through the rest of the program — from your full ebook to your sales page, emails, and
   lead magnet.

That's it. Set up your account today so you can start strong.

Need help? Just reply to this email or write to ${SUPPORT_EMAIL}.

Excited to see what you build,
Jon Oraña
Negosyo University`
}
