import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

// POST /api/generate/objections
// Body: { target_market: string, problem: string, mechanism: string, ebook_title: string }
// Returns top 10 objections the target market would have before buying the ebook

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism, ebook_title } = await request.json()

    const prompt = `You are a sales psychology expert for the Philippine digital products market.

Target market: ${target_market}
Problem being solved: ${problem}
Solution method: ${mechanism}
Ebook title: ${ebook_title}

Generate the top 10 most common objections or hesitations that ${target_market} would have BEFORE buying an ebook that solves ${problem}.

These should be real, specific objections — not generic ones. Think about:
- Skepticism about results ("Will this actually work for me?")
- Past failed attempts ("I've tried things like this before")
- Time concerns ("I don't have time to read and apply this")
- Money concerns ("Is this worth the price?")
- Trust issues ("How do I know this person knows what they're talking about?")
- "Is this for me?" doubts ("My situation is different")
- Tech or skill concerns ("I'm not tech-savvy enough")

Return ONLY a valid JSON object in exactly this format:
{
  "objections": [
    {
      "objection": "The specific objection as the buyer would think or say it",
      "underlying_fear": "The real fear or belief behind this objection (1 sentence)"
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
