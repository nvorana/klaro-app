// Payment reminder email — the FRIENDLY layer of the collection ladder.
// Sent by /api/cron/notify-payment-due at daysLeft === 5 (early heads up)
// and daysLeft === 0 (due today). Suspension for overdue balances is handled
// separately; this email never threatens, it just reminds warmly.
//
// From-address, styling wrapper, and Resend fetch pattern mirror
// lib/email/sendWelcomeEmail.ts. Idempotency lives in the cron route
// (webhook_logs ledger keyed on due date), not here.

const RESEND_FROM = 'KLARO <notify@notify.negosyouniversity.com>'
const REPLY_TO = 'jon@negosyouniversity.com'
const LOGIN_URL = 'https://klaro.chillyonaryo.com/login'

export interface PaymentReminderContext {
  email: string
  firstName?: string | null
  /** The installment due date (used for the "July 22" style date in copy). */
  dueDate: Date
  /** Whole days until due (negative = past due). Picks the copy variant. */
  daysLeft: number
  /** e.g. "2nd payment" / "3rd payment" */
  installmentLabel: string
}

export interface PaymentReminderResult {
  sent: boolean
  reason?: 'no_api_key' | 'no_email' | 'resend_failed'
  resendId?: string
}

function formatDueDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
}

export async function sendPaymentReminder(ctx: PaymentReminderContext): Promise<PaymentReminderResult> {
  if (!ctx.email) return { sent: false, reason: 'no_email' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[payment-reminder] RESEND_API_KEY not set, skipping')
    return { sent: false, reason: 'no_api_key' }
  }

  const firstName = (ctx.firstName?.trim() || 'there').slice(0, 60)
  const dateLabel = formatDueDate(ctx.dueDate)
  const isDueToday = ctx.daysLeft <= 0

  const subject = isDueToday
    ? `Your ${ctx.installmentLabel} is due today`
    : `Friendly reminder: your ${ctx.installmentLabel} is coming up`

  const html = buildHtml({ firstName, installmentLabel: ctx.installmentLabel, dateLabel, isDueToday })
  const text = buildText({ firstName, installmentLabel: ctx.installmentLabel, dateLabel, isDueToday })

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
      console.warn(`[payment-reminder] Resend ${res.status} for ${ctx.email}: ${body.slice(0, 300)}`)
      return { sent: false, reason: 'resend_failed' }
    }
    const body = await res.json().catch(() => ({}))
    const resendId = body?.id

    console.log(`[payment-reminder] sent to ${ctx.email} (variant=${isDueToday ? 'due' : 'early'}, resend_id=${resendId})`)
    return { sent: true, resendId }
  } catch (e) {
    console.warn('[payment-reminder] error:', e)
    return { sent: false, reason: 'resend_failed' }
  }
}

// ── Templates ────────────────────────────────────────────────────────────────
// Register: casual conversational English with light natural Tagalog.
// Warm, zero pressure. No em dashes, no formal or legal words.

interface CopyParams {
  firstName: string
  installmentLabel: string
  dateLabel: string
  isDueToday: boolean
}

function bodyParagraphs({ firstName, installmentLabel, dateLabel, isDueToday }: CopyParams): string[] {
  if (isDueToday) {
    return [
      `Hi ${firstName},`,
      `Just a gentle reminder that your ${installmentLabel} for the program is due today, ${dateLabel}.`,
      `Settling it today keeps your KLARO access uninterrupted, so you can keep building without any hiccups.`,
      `If you already settled this, you can ignore this email. Reply to this email kung may tanong ka or need mo ng konting extension, we got you.`,
    ]
  }
  return [
    `Hi ${firstName},`,
    `Quick heads up lang. Your ${installmentLabel} for the program is due on ${dateLabel}.`,
    `Keeping it settled keeps your KLARO access and your momentum going, so nothing pauses on your end.`,
    `If you already settled this, you can ignore this email. And if anything's up, just reply and let us know.`,
  ]
}

function buildHtml(params: CopyParams): string {
  const paragraphs = bodyParagraphs(params)
    .map(p => `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#1F2937;">${escapeHtml(p)}</p>`)
    .join('\n          ')

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Payment reminder</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1F36;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">

        <tr><td style="padding:32px;">

          ${paragraphs}

          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0 8px;">
            <tr><td style="background:#1A1F36;border-radius:12px;">
              <a href="${LOGIN_URL}" style="display:inline-block;padding:14px 28px;color:white;text-decoration:none;font-weight:bold;font-size:15px;">Open my KLARO workspace &rarr;</a>
            </td></tr>
          </table>

        </td></tr>

        <tr><td style="background:#F8F9FA;padding:20px 32px;text-align:center;font-size:12px;color:#9CA3AF;">KLARO by Negosyo University</td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`.trim()
}

function buildText(params: CopyParams): string {
  return `
${bodyParagraphs(params).join('\n\n')}

OPEN YOUR WORKSPACE: ${LOGIN_URL}

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
