import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'

export const maxDuration = 30

// POST /api/generate/lead-magnet-ideas
// Body: { target_market, problem, mechanism, ebook_title }
// Returns: { data: [{ angle, description, emotional_trigger, example_title }] }

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism, ebook_title } = await request.json()

    if (!target_market || !problem || !mechanism) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const marketHint = await getMarketLanguageHintForUser()

    const prompt = `You are a lead magnet strategist for Filipino digital product sellers.${marketHint}

A student is selling an ebook titled "${ebook_title || 'their ebook'}".
Their clarity sentence: "I help ${target_market} who struggle with ${problem} through ${mechanism}."

Their lead magnet must:
- Give ONE specific micro-win — the smallest result that proves their approach works
- Feel completable in under 10 minutes
- Be distinct from the ebook itself (a taste, not a summary)
- Speak to the exact frustration ${target_market} feel RIGHT NOW — not aspirations, but current pain

Generate 3 DIFFERENT lead magnet angles. Each angle targets a different emotional entry point:
- One hits FRUSTRATION ("I've been trying and nothing works")
- One hits FEAR or URGENCY ("I'm falling behind / running out of time")
- One hits DESIRE or RELIEF ("Finally, something simple I can actually do")

For each angle, the example title must use this formula:
"How to [Specific Small Result] in [Short Time], Even If [Most Common Objection]"
— Ultra-specific to ${target_market}. No vague claims. No income promises.

Return ONLY a valid JSON object, no other text:
{
  "ideas": [
    {
      "angle": "Short punchy name for this angle (4-7 words, like a book chapter title)",
      "description": "2 sentences. What specific thing will the reader walk away knowing or able to do? Be concrete — name the action or result, not a vague benefit.",
      "emotional_trigger": "frustration" | "fear" | "desire",
      "example_title": "How to [result] in [timeframe], Even If [objection]"
    },
    { ... },
    { ... }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 800,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    if (!Array.isArray(result.ideas) || result.ideas.length === 0) {
      throw new Error('No ideas returned')
    }

    return NextResponse.json({ data: result.ideas })
  } catch (error) {
    console.error('Lead magnet ideas error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
