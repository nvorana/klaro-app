// Module unlocked email — sent when a coach unlocks a new module for a
// student. Fires ONE email per newly-added module (skipped if the student
// already had that module unlocked).
//
// Triggered from /api/coach/unlock-modules only (not admin cohort/batch
// unlocks — those affect too many students at once and would spam).

const RESEND_FROM = 'KLARO <notify@notify.negosyouniversity.com>'
const REPLY_TO = 'jon@negosyouniversity.com'
const LOGIN_URL = 'https://klaro.chillyonaryo.com/login'
const SUPPORT_EMAIL = 'jon@negosyouniversity.com'

// Metadata for each module. Titles + descriptions + time estimates match
// what students actually see inside KLARO.
const MODULE_META: Record<number, { title: string; blurb: string; time: string; output: string }> = {
  1: {
    title: 'The Clarity Builder',
    blurb: "Define who you help, what problem you solve, and what makes your solution unique. You'll walk away with your Clarity Sentence — the foundation everything else builds on.",
    time: '15–20 minutes',
    output: 'Your Clarity Sentence',
  },
  2: {
    title: 'The Ebook Factory',
    blurb: 'Turn your Clarity Sentence into a complete ebook. Generate your title, outline, and 8 chapters with your Canva cover prompt, then export as a .docx.',
    time: '60–90 minutes',
    output: 'Your Full Ebook (.docx)',
  },
  3: {
    title: 'The Irresistible Offer Builder',
    blurb: 'Package your ebook into a compelling offer — with the right bonuses, price, and guarantee — that people actually want to buy.',
    time: '30–45 minutes',
    output: 'Your Irresistible Offer Statement',
  },
  4: {
    title: 'The Sales Page Builder',
    blurb: 'Generate your full sales page copy — headline, story, offer, bonuses, guarantee, FAQ, all of it — using your Clarity Sentence and Irresistible Offer.',
    time: '45–60 minutes',
    output: 'Your Sales Page Copy',
  },
  5: {
    title: 'The 7-Day Email Sequence',
    blurb: 'Write 7 emails that nurture your readers, build trust, and sell your ebook. Personalized to your niche and voice.',
    time: '30–45 minutes',
    output: 'Your 7-Day Email Sequence',
  },
  6: {
    title: 'The Lead Magnet Builder',
    blurb: 'Create a free lead magnet — a mini-guide, checklist, or template — that attracts subscribers and warms them up to buy your ebook.',
    time: '30–45 minutes',
    output: 'Your Lead Magnet (.docx)',
  },
  7: {
    title: 'The Facebook Content Engine',
    blurb: "Generate ready-to-post Facebook content that drives conversations, builds authority, and pulls readers into your world.",
    time: '20–30 minutes',
    output: 'Your Facebook Posts',
  },
}

export interface ModuleUnlockedContext {
  email: string
  firstName?: string | null
  fullName?: string | null
  moduleNumber: number
}

export interface ModuleUnlockedResult {
  sent: boolean
  reason?: 'no_api_key' | 'no_email' | 'unknown_module' | 'resend_failed'
  resendId?: string
}

export async function sendModuleUnlockedEmail(ctx: ModuleUnlockedContext): Promise<ModuleUnlockedResult> {
  if (!ctx.email) return { sent: false, reason: 'no_email' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[module-unlocked] RESEND_API_KEY not set — skipping')
    return { sent: false, reason: 'no_api_key' }
  }

  const meta = MODULE_META[ctx.moduleNumber]
  if (!meta) {
    console.warn(`[module-unlocked] unknown module ${ctx.moduleNumber}`)
    return { sent: false, reason: 'unknown_module' }
  }

  const firstName = (ctx.firstName?.trim() || ctx.fullName?.split(' ')[0] || 'there').slice(0, 60)
  const subject = `Module ${ctx.moduleNumber} unlocked — ${meta.title}`
  const html = buildHtml({ firstName, moduleNumber: ctx.moduleNumber, meta })
  const text = buildText({ firstName, moduleNumber: ctx.moduleNumber, meta })

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
      console.warn(`[module-unlocked] Resend ${res.status} for ${ctx.email}: ${body.slice(0, 300)}`)
      return { sent: false, reason: 'resend_failed' }
    }
    const body = await res.json().catch(() => ({}))
    console.log(`[module-unlocked] sent module ${ctx.moduleNumber} unlock email to ${ctx.email} (id=${body?.id})`)
    return { sent: true, resendId: body?.id }
  } catch (e) {
    console.warn('[module-unlocked] error:', e)
    return { sent: false, reason: 'resend_failed' }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function buildHtml({ firstName, moduleNumber, meta }: { firstName: string; moduleNumber: number; meta: typeof MODULE_META[number] }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Module ${moduleNumber} unlocked</title></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1F36;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">

        <tr><td style="background:#1A1F36;padding:32px 32px 28px;text-align:center;">
          <div style="display:inline-block;padding:8px 16px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);border-radius:999px;color:#10B981;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Module ${moduleNumber} Unlocked</div>
          <h1 style="color:white;font-size:26px;font-weight:bold;margin:18px 0 4px;line-height:1.2;">${escapeHtml(meta.title)}</h1>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0;">is now open for you</p>
        </td></tr>

        <tr><td style="padding:32px;">

          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#1F2937;">Hi ${escapeHtml(firstName)},</p>

          <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#1F2937;">Your coach just opened <strong>Module ${moduleNumber} — ${escapeHtml(meta.title)}</strong> for you. Here's what's inside:</p>

          <div style="background:#F8F9FA;border-radius:12px;padding:20px;margin:0 0 24px;border-left:3px solid #F4B942;">
            <p style="font-size:14px;line-height:1.6;margin:0 0 12px;color:#1F2937;">${escapeHtml(meta.blurb)}</p>
            <table cellspacing="0" cellpadding="0" style="margin:8px 0 0;">
              <tr>
                <td style="font-size:12px;color:#6B7280;padding-right:12px;">⏱ ${escapeHtml(meta.time)}</td>
                <td style="font-size:12px;color:#6B7280;">📝 Output: ${escapeHtml(meta.output)}</td>
              </tr>
            </table>
          </div>

          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
            <tr><td style="background:#1A1F36;border-radius:12px;">
              <a href="${LOGIN_URL}" style="display:inline-block;padding:14px 28px;color:white;text-decoration:none;font-weight:bold;font-size:15px;">Log in and start Module ${moduleNumber} →</a>
            </td></tr>
          </table>

          <p style="font-size:13px;line-height:1.6;color:#6B7280;margin:24px 0 0;border-top:1px solid #E5E7EB;padding-top:20px;">Have a question about this module? Just reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#1A1F36;font-weight:600;">${SUPPORT_EMAIL}</a>.</p>

        </td></tr>

        <tr><td style="background:#F8F9FA;padding:20px 32px;text-align:center;font-size:12px;color:#9CA3AF;">KLARO by Negosyo University</td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildText({ firstName, moduleNumber, meta }: { firstName: string; moduleNumber: number; meta: typeof MODULE_META[number] }): string {
  return `Hi ${firstName},

Your coach just opened Module ${moduleNumber} — ${meta.title} — for you.

Here's what's inside:
${meta.blurb}

Time to complete: ${meta.time}
What you'll walk away with: ${meta.output}

LOG IN AND START: ${LOGIN_URL}

Have a question about this module? Just reply to this email or write to ${SUPPORT_EMAIL}.

— KLARO by Negosyo University`
}
