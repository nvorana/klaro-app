import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

// POST /api/generate/ebook-chapter
// Body: { title, target_market, problem, mechanism, chapter: { chapter_number, title, goal, quick_win } }
// Returns: { data: { chapter_number, title, story_starter, core_lessons, quick_win_section } }

export async function POST(request: NextRequest) {
  try {
    const { title, target_market, problem, mechanism, chapter } = await request.json()

    if (!title || !target_market || !problem || !mechanism || !chapter) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prompt = `You are an ebook ghostwriter for the Philippine digital products market.

Ebook title: "${title}"
Target market: ${target_market}
Core problem: ${problem}
Solution method: ${mechanism}

You are writing Chapter ${chapter.chapter_number}: "${chapter.title}"
Chapter goal: ${chapter.goal}
Quick win for this chapter: ${chapter.quick_win}

Write this chapter in three clearly labeled sections:

SECTION 1 — STORY STARTER (300-400 words)
Write a short, relatable story about a real-feeling person from ${target_market} dealing with the topic of this chapter.
The story should feel authentic — not exaggerated. Show the struggle clearly, then transition smoothly into the lesson.
End with a sentence that bridges into the teaching content.

SECTION 2 — CORE LESSONS (400-600 words)
Write the main teaching content of this chapter based on the goal: ${chapter.goal}
Use simple, clear language. Short paragraphs. Practical, actionable advice.
No hype. No exaggerated promises. Write for someone with no background in this topic.
Filipino-audience friendly — warm, direct, encouraging.

SECTION 3 — QUICK WIN (150-200 words)
Give the reader ONE specific action they can take today related to this chapter.
The action should be: ${chapter.quick_win}
Make it concrete, easy, and immediately useful. Encourage them to do it before moving on.

Tone throughout: Warm, practical, honest. Like a knowledgeable friend explaining something important.

Return ONLY a valid JSON object, no other text:
{
  "chapter_number": ${chapter.chapter_number},
  "title": "${chapter.title}",
  "story_starter": "...",
  "core_lessons": "...",
  "quick_win_section": "..."
}`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Ebook chapter generation error:', error)
    return NextResponse.json({ error: 'Chapter generation failed' }, { status: 500 })
  }
}
