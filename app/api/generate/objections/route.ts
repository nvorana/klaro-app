import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

// POST /api/generate/objections
// Body: { target_market: string, problem: string, mechanism: string, ebook_title: string }
// Returns top 10 objections the target market would have before buying the ebook

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism, ebook_title } = await request.json()

    const prompt = `You are a buyer psychology expert for the Philippine digital products market.

Target market: ${target_market}
Problem being solved: ${problem}
Solution method: ${mechanism}
Ebook title: ${ebook_title}

Generate the top 10 most common self-doubt objections that ${target_market} would have before acting on an ebook that solves ${problem}.

CRITICAL: These objections are about the BUYER doubting THEMSELVES and their situation — NOT about doubting the seller, the product's legitimacy, or the author's credentials. Do NOT include objections like "Is this a scam?", "Who is this person?", or "Is this worth the price?" Those belong in sales copy, not the offer stack.

The objections you generate must come from one of these angles:
- Past failure: "I've tried something like this before and it didn't work"
- Personal fit: "What if this doesn't apply to my specific situation?"
- Capability doubt: "I don't think I have the skill/time/discipline to actually do this"
- Timing: "I'm too busy right now to implement anything new"
- Identity: "I'm not the kind of person who can pull this off"
- Fear of wasted effort: "What if I read the whole thing and still can't make it work?"
- Comparison: "Other people can do this, but my situation is different because…"

Write each objection as the buyer would actually think or say it — in their own internal voice, honest and specific to ${target_market}.

Return ONLY a valid JSON object in exactly this format:
{
  "objections": [
    {
      "objection": "The specific objection as the buyer would think or say it",
      "underlying_fear": "The real self-doubt or belief behind this objection (1 sentence)"
    }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const content = completion.choices[0].message.content
    const parsed = JSON.parse(content || '{}')
    // Robustly extract array from any wrapping key the AI might use
    const result = Array.isArray(parsed)
      ? parsed
      : parsed.objections ?? parsed.items ?? parsed.data ?? parsed.results ?? Object.values(parsed).find(v => Array.isArray(v)) ?? []

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Objections generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
