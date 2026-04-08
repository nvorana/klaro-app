import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

// POST /api/generate/bonus
// Body: { ebook_title, target_market, problem, objection }
// Returns: { data: { bonus_name, description, format } }

export async function POST(request: NextRequest) {
  try {
    const { ebook_title, target_market, problem, objection } = await request.json()

    if (!ebook_title || !target_market || !problem || !objection) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prompt = `You are a digital product strategist.

Main ebook: "${ebook_title}" — helps ${target_market} with ${problem}
Objection to neutralize: "${objection}"

Create ONE bonus digital document idea that directly addresses this objection.
The bonus should:
- Be a simple document (checklist, guide, template, or cheat sheet — NOT audio or video)
- Feel like an immediate, practical solution to the specific objection
- Have a compelling name that implies a clear outcome
- Be something that could realistically be created as a 2-5 page document

Return ONLY a valid JSON object, no other text:
{
  "bonus_name": "The name of the bonus document",
  "description": "One sentence — what this bonus does for the reader",
  "format": "checklist or guide or template or cheat sheet"
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
