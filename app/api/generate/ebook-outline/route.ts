import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'

// POST /api/generate/ebook-outline
// Body: { target_market, problem, mechanism }
// Returns: { data: { titles: string[], outline: Chapter[] } }

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism } = await request.json()

    if (!target_market || !problem || !mechanism) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const clarity_sentence = `I help ${target_market} who struggle with ${problem} through ${mechanism}`
    const marketHint = await getMarketLanguageHintForUser()

    const prompt = `You are an ebook strategist for the Philippine digital products market.${marketHint}

Clarity Sentence: "${clarity_sentence}"

Task 1: Generate 3 clear, outcome-driven ebook title options. Each title should:
- Be specific and benefit-driven
- Appeal to a Filipino audience
- Be simple and easy to understand
- Imply a clear result the reader will achieve
- Be written in 100% English — no Tagalog or Filipino words in titles or subtitles

Each title option must also include a subtitle. Format: "Title: Subtitle"

Task 2: For the BEST of the 3 titles, create a table of contents with 6 to 8 chapters. For each chapter include:
- Chapter number
- Chapter title (clear, outcome-driven)
- Chapter goal (1 sentence — what the reader will learn or achieve)
- Quick win (1 sentence — one specific action the reader can take immediately after this chapter)

Return ONLY a valid JSON object, no other text:
{
  "titles": ["Title Option 1", "Title Option 2", "Title Option 3"],
  "outline": [
    {
      "chapter_number": 1,
      "title": "...",
      "goal": "...",
      "quick_win": "..."
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
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Ebook outline generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
