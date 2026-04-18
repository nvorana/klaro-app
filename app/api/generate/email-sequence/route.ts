import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

export const maxDuration = 120

// POST /api/generate/email-sequence
// Body: { target_market, problem, mechanism, ebook_title, sales_page_url }
// Returns 7 emails: Days 1-4 pure value, Days 5-7 soft selling

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism, ebook_title, sales_page_url } = await request.json()

    const prompt = `You are a Filipino email copywriter writing a 7-day launch email sequence on behalf of an expert selling their ebook. You write in their voice — not yours. The emails go to a specific Filipino audience.

---

CONTEXT:
- Who reads these emails: ${target_market}
- What they struggle with: ${problem}
- What solves it: ${mechanism}
- The ebook being sold: "${ebook_title}"
- Sales page URL: ${sales_page_url}

---

EMAIL ARC:
- Days 1–4: Pure value. Zero selling. The reader should feel deeply seen and understood. Build trust.
- Days 5–7: Gradually introduce the ebook. Soft sell → medium sell → direct close.

---

WRITING RULES (non-negotiable):

Language:
- Taglish: 75% English, 25% Tagalog at the word level
- Tagalog is for emotional punch — hooks, gut-check moments, rhetorical questions, PS lines
- Use casual everyday Tagalog only: pero, kasi, lang, talaga, diba, kahit, parang, na, e
- NEVER use deep or formal Filipino (subalit, gayunpaman, nangangailangan, pinapanood)
- Sentence structure in English, Tagalog drops in for emotion and rhythm

Voice:
- Write like the sender is a real person — someone who has lived through this problem and found the answer
- NOT a marketer. NOT a motivational speaker. A trusted friend who is one step ahead.
- Short sentences. 5–8 words average. Punch, don't lecture.
- Single-sentence paragraphs are the default. Rarely 2+ sentences in one paragraph.
- Heavy white space — one thought per line. This is read on mobile.
- No corporate jargon. No "leverage," "unlock your potential," "game-changer," "actionable."
- Never open with "I hope this email finds you well."

Specificity rule:
- Vague = fiction. Specific = real.
- "7:43 PM" not "evening." "3 months" not "a short time." "₱4,200" not "a small amount."
- The more specific, the more the reader's brain accepts it as true.

LENGTH RULE (critical):
- Each email body MUST be 200–300 words. Target 250 words per email.
- Do NOT write short emails. The reader needs enough substance to feel the email was worth opening.
- Count your words. If an email is under 200 words, expand the Stir and Shift sections.

Structure for value emails (Days 1–4):
1. Hook — bold statement, uncomfortable truth, or relatable moment (1–3 lines)
2. Stir — describe the problem they're living with. Make them feel seen. (4–6 short paragraphs)
3. Shift — reveal the insight or reframe. "Here's what nobody tells you..." (3–4 paragraphs)
4. Seed — plant the idea of the solution without hard-selling (1–2 lines)
5. Reframe — 1–2 sharp lines that change how the reader sees their situation. Use contrast: "Hindi pala yung [X] ang [problem]. Yung [Y] pala ang [truth]."
6. Sign-off: "To your [relevant aspiration]," then a new line with just: [Your Name]

Structure for selling emails (Days 5–7):
- Day 5: Soft introduce the ebook. "I put everything I know into this." Benefits, not features. One CTA link.
- Day 6: Address the biggest objection. "Kahit [common excuse]..." then bridge to the solution. One CTA link.
- Day 7: Final push. Direct. Honest urgency. Recap what they get. Hard CTA.
- Sign-off same as value emails.

Subject line rules:
- Max 19 characters — count every letter, space, and punctuation mark. Hard limit.
- Name the reader's world, not the product. The best subject lines feel personal, not promotional.
- No all-caps. One emoji max (and only sometimes).
- Each email gets TWO subject line options for A/B testing.

CTA rules (Days 5–7 only):
- Natural, not pushy — a simple invitation, not a command
- The CTA field contains only the URL: ${sales_page_url}
- Days 1–4 have null CTAs

---

Return ONLY a valid JSON object. No explanation before or after. No markdown. Just the JSON:

{
  "emails": [
    {
      "day": 1,
      "type": "value",
      "subject_a": "...",
      "subject_b": "...",
      "body": "...",
      "cta": null
    },
    {
      "day": 2,
      "type": "value",
      "subject_a": "...",
      "subject_b": "...",
      "body": "...",
      "cta": null
    },
    {
      "day": 3,
      "type": "value",
      "subject_a": "...",
      "subject_b": "...",
      "body": "...",
      "cta": null
    },
    {
      "day": 4,
      "type": "value",
      "subject_a": "...",
      "subject_b": "...",
      "body": "...",
      "cta": null
    },
    {
      "day": 5,
      "type": "selling",
      "subject_a": "...",
      "subject_b": "...",
      "body": "...",
      "cta": "${sales_page_url}"
    },
    {
      "day": 6,
      "type": "selling",
      "subject_a": "...",
      "subject_b": "...",
      "body": "...",
      "cta": "${sales_page_url}"
    },
    {
      "day": 7,
      "type": "selling",
      "subject_a": "...",
      "subject_b": "...",
      "body": "...",
      "cta": "${sales_page_url}"
    }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 10000,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Email sequence generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
