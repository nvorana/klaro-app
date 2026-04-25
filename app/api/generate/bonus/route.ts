import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'

// POST /api/generate/bonus
// Body: { ebook_title, target_market, problem, objection }
// Returns: { data: { bonus_name, description, format } }

export async function POST(request: NextRequest) {
  try {
    const { ebook_title, target_market, problem, objection } = await request.json()

    if (!ebook_title || !target_market || !problem || !objection) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const marketHint = await getMarketLanguageHintForUser()

    const prompt = `You are a digital product strategist.${marketHint}

Main ebook: "${ebook_title}" — helps ${target_market} with ${problem}
Objection to neutralize: "${objection}"

Create ONE bonus digital document idea that directly addresses this objection.
The bonus must:
- Be a SHORT, text-based document only — NO audio, NO video, NO webinar, NO coaching call
- Choose from these formats ONLY: PDF Checklist, Worksheet, Template, Cheat Sheet, Swipe File, Script, Mini-Guide, Action Guide
- Feel like an immediate, practical shortcut that dissolves the objection
- Have a compelling name that implies a clear, specific outcome
- Be completable in under 15 minutes by the reader

Return ONLY a valid JSON object, no other text:
{
  "bonus_name": "The name of the bonus document",
  "description": "One sentence — what this bonus does for the reader and how it addresses their doubt",
  "format": "one of: PDF Checklist, Worksheet, Template, Cheat Sheet, Swipe File, Script, Mini-Guide, Action Guide"
}`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 300,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Bonus generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
