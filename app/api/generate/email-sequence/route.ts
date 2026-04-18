import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

export const maxDuration = 120

// POST /api/generate/email-sequence
// Body: { target_market, problem, mechanism, ebook_title, sales_page_url, batch }
// batch=1 → Days 1-4 (value emails), batch=2 → Days 5-7 (selling emails)
// If batch is omitted, defaults to batch 1 for backward compatibility

const SHARED_RULES = (target_market: string, problem: string, mechanism: string, ebook_title: string) => `You are a Filipino email copywriter writing emails on behalf of an expert selling their ebook. You write in their voice — not yours. The emails go to a specific Filipino audience.

---

CONTEXT:
- Who reads these emails: ${target_market}
- What they struggle with: ${problem}
- What solves it: ${mechanism}
- The ebook being sold: "${ebook_title}"

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

LENGTH RULE (THIS OVERRIDES EVERYTHING — non-negotiable):
- Each email body MUST be at least 250 words. Minimum 250 words. No exceptions.
- The body field must contain at least 25 lines of text (separated by \\n).
- Short sentences are fine, but you need MANY of them — at least 30 sentences per email.
- Add more emotional detail, more specific examples, more vivid scenarios.
- Expand the Stir section with 2-3 specific relatable moments the reader has experienced.
- Expand the Shift section with a concrete mini-story or example.
- If you think the email is done, add a PS line with one more thought.
- IMPORTANT: An email with fewer than 250 words is a FAILURE. Write more.

Subject line rules:
- Max 19 characters — count every letter, space, and punctuation mark. Hard limit.
- Name the reader's world, not the product. The best subject lines feel personal, not promotional.
- No all-caps. One emoji max (and only sometimes).
- Each email gets TWO subject line options for A/B testing.`

function buildBatch1Prompt(target_market: string, problem: string, mechanism: string, ebook_title: string) {
  return `${SHARED_RULES(target_market, problem, mechanism, ebook_title)}

---

YOUR TASK: Write Days 1–4 of a 7-day email sequence. These are PURE VALUE emails. Zero selling. The reader should feel deeply seen and understood. Build trust.

Structure for each email:
1. Hook — bold statement, uncomfortable truth, or relatable moment (1–3 lines)
2. Stir — describe the problem they're living with. Make them feel seen. (4–6 short paragraphs)
3. Shift — reveal the insight or reframe. "Here's what nobody tells you..." (3–4 paragraphs)
4. Seed — plant the idea of the solution without hard-selling (1–2 lines)
5. Reframe — 1–2 sharp lines that change how the reader sees their situation. Use contrast: "Hindi pala yung [X] ang [problem]. Yung [Y] pala ang [truth]."
6. Sign-off: "To your [relevant aspiration]," then a new line with just: [Your Name]

Each email MUST cover a DIFFERENT angle of the problem. Do not repeat the same points across days:
- Day 1: The surface-level frustration they feel every day
- Day 2: The deeper root cause they haven't considered
- Day 3: A common mistake or myth that's making things worse
- Day 4: The mindset shift or "aha moment" that changes everything

CTA: All 4 emails have null CTAs. No selling.

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
    }
  ]
}`
}

function buildBatch2Prompt(target_market: string, problem: string, mechanism: string, ebook_title: string, sales_page_url: string) {
  return `${SHARED_RULES(target_market, problem, mechanism, ebook_title)}

---

YOUR TASK: Write Days 5–7 of a 7-day email sequence. These are SELLING emails. The reader has received 4 value emails already and trusts the sender. Now gradually introduce the ebook.

- Day 5 (soft sell): Soft introduce the ebook. "I put everything I know into this." Focus on benefits, not features. Share a personal story about why you created it. One CTA link.
- Day 6 (medium sell): Address the biggest objection head-on. "Kahit [common excuse]..." then bridge to the solution. Include social proof or a specific result. One CTA link.
- Day 7 (hard close): Final push. Direct. Honest urgency — no fake scarcity. Recap what they get (ebook + bonuses). Paint the "6 months from now" picture. Hard CTA.

Sign-off: "To your [relevant aspiration]," then a new line with just: [Your Name]

CTA: All 3 emails include the sales page URL: ${sales_page_url}

---

Return ONLY a valid JSON object. No explanation before or after. No markdown. Just the JSON:

{
  "emails": [
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
}

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism, ebook_title, sales_page_url, batch } = await request.json()

    const batchNum = batch || 1
    const prompt = batchNum === 2
      ? buildBatch2Prompt(target_market, problem, mechanism, ebook_title, sales_page_url)
      : buildBatch1Prompt(target_market, problem, mechanism, ebook_title)

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 6000,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Email sequence generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
