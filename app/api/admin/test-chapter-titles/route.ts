import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getTestFoundation } from '@/lib/module8/testFoundations'

// Admin-only A/B test for chapter title generation.
// Takes the same ebook context + chapter goals, runs two title-generation
// prompts in parallel, and returns both sets so the admin can compare.

export const maxDuration = 60

const MASTER_SYSTEM = `You are an expert ebook writing assistant helping Filipino entrepreneurs and knowledge workers create their first digital product.

WRITING RULES:
- Be practical, specific, simple. Entry-level audience.
- TITLES must be 100% English — no Tagalog or Filipino words whatsoever.
- No hype, no fake claims.
- BANNED WORDS in any title: unlock, unleash, discover, transform your life, revolutionize, ultimate guide, game-changing, next-level, powerful secrets, tap into, harness, ignite, amplify, supercharge, ultimate, complete, mastering, comprehensive.

Always return valid JSON only. No explanations outside JSON.`

interface ChapterGoal {
  number: number
  goal: string
}

// ── OLD PROMPT (extracted from current production outlinePrompt rules) ────────

function oldPrompt(targetMarket: string, problem: string, ebookTitle: string, chapters: ChapterGoal[]): string {
  const chapterList = chapters.map(c => `Chapter ${c.number}: ${c.goal}`).join('\n')

  return `TASK: Generate a chapter title for each chapter goal below.

Book: "${ebookTitle}"
Target Market: ${targetMarket}
Problem: ${problem}

CHAPTER GOALS:
${chapterList}

TITLE RULES:
- Each chapter title must be nice, cute, succinct, witty, and attention-grabbing — make the reader excited to open it
- Avoid generic titles like "Introduction to X" or "Understanding Y" — every title should have personality and spark curiosity

Return this exact JSON:
{
  "chapters": [
    { "number": 1, "title": "Title here", "goal": "Original goal echoed" }
  ]
}`
}

// ── NEW PROMPT (simple workshop-style) ────────────────────────────────────────

function newPrompt(targetMarket: string, problem: string, ebookTitle: string, chapters: ChapterGoal[]): string {
  const chapterList = chapters.map(c => `Chapter ${c.number}: ${c.goal}`).join('\n')

  return `Book: "${ebookTitle}"
Target Market: ${targetMarket}
Problem: ${problem}

CHAPTER GOALS:
${chapterList}

Can you come up with a nice, cute, succinct, witty, attention-grabbing chapter titles.

Return this exact JSON:
{
  "chapters": [
    { "number": 1, "title": "Title here", "goal": "Original goal echoed" }
  ]
}`
}

async function runTitleGen(prompt: string): Promise<{ chapters: { number: number; title: string; goal: string }[]; elapsed_ms: number }> {
  const started = Date.now()
  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: MASTER_SYSTEM },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.85,
    max_tokens: 1500,
  })
  const raw = completion.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)
  return {
    chapters: parsed.chapters ?? [],
    elapsed_ms: Date.now() - started,
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

  const body = await request.json()
  const { foundation_id } = body

  const foundation = getTestFoundation(foundation_id)
  if (!foundation) return NextResponse.json({ error: 'Unknown foundation_id' }, { status: 400 })

  // Build chapter goal list from the foundation's ebook_chapters
  const chapterGoals: ChapterGoal[] = foundation.ebook_chapters.map(ch => ({
    number: ch.chapter_number,
    goal: ch.core_lessons,
  }))

  const oldPromptText = oldPrompt(foundation.target_market, foundation.core_problem, foundation.ebook_title, chapterGoals)
  const newPromptText = newPrompt(foundation.target_market, foundation.core_problem, foundation.ebook_title, chapterGoals)

  try {
    const [oldResult, newResult] = await Promise.all([
      runTitleGen(oldPromptText),
      runTitleGen(newPromptText),
    ])

    return NextResponse.json({
      success: true,
      foundation_label: foundation.label,
      ebook_title: foundation.ebook_title,
      target_market: foundation.target_market,
      original_titles: foundation.ebook_chapters.map(ch => ({
        number: ch.chapter_number,
        title: ch.title,
        goal: ch.core_lessons,
      })),
      old: {
        chapters: oldResult.chapters,
        elapsed_ms: oldResult.elapsed_ms,
        prompt: oldPromptText,
      },
      new: {
        chapters: newResult.chapters,
        elapsed_ms: newResult.elapsed_ms,
        prompt: newPromptText,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[test-chapter-titles]', message)
    return NextResponse.json({ error: 'generation_failed', detail: message }, { status: 500 })
  }
}
