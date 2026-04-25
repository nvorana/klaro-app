import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getTestFoundation } from '@/lib/module8/testFoundations'
import { generateMarketLanguage, buildMarketLanguageHint, type MarketLanguage } from '@/lib/marketLanguage'

// Admin-only A/B test for the niche-language injection feature.
// Picks a test foundation, generates the language pack live, then runs the
// SAME story-starter prompt twice in parallel — once with the language hint
// appended, once without. Returns both stories side-by-side so the admin
// can see exactly what the language injection adds.

export const maxDuration = 90

const MASTER_SYSTEM = `You are an expert ebook writing assistant helping Filipino creators turn their knowledge into a sellable digital product (ebook).

Write at an entry level for beginners. Be practical, specific, simple. No hype words.

WRITING REGISTER (strictly enforced): ~70% English / ~30% Tagalog. The narrative prose is English. Tagalog appears as warmth, internal-thought punctuation, and short emotional beats — never as the carrying language. A Filipino-American reader should be able to follow the prose without translation.
✓ Right density: "He caught his reflection in the bathroom mirror. Lumolobo na talaga, he thought."
✗ Too heavy: "Si Mang Ramon ay tumitingin sa salamin, hindi makapaniwala na lumobo na ang kanyang katawan."

Always return valid JSON only. No markdown fences.`

function storyPrompt(targetMarket: string, problem: string, ebookTitle: string, chapterTitle: string, chapterGoal: string): string {
  return `Book: "${ebookTitle}"
Target Market: ${targetMarket}
Problem: ${problem}

You are writing the Story Starter for this chapter:
Chapter title: "${chapterTitle}"
Chapter goal: ${chapterGoal}

Write a 250-350 word relatable story about a real-feeling person from the target market dealing with the topic of this chapter. Show the struggle clearly, then transition smoothly into the lesson. End with a sentence that bridges into the teaching content.

REGISTER REMINDER (do not violate): ~70% English / ~30% Tagalog. The narrative prose, descriptions, and connective sentences are written in English. Tagalog is reserved for short emotional beats, internal thoughts, and dialogue snippets — sprinkled in for warmth, not used as the main language. The character can BE Filipino without the prose BEING Tagalog. If the resulting passage reads as ~90% Tagalog, you have failed this rule.

Return this exact JSON:
{
  "story_starter": "Full story text here, paragraphs separated by \\n\\n"
}`
}

async function runStory(prompt: string, systemSuffix: string): Promise<{ story: string; word_count: number; elapsed_ms: number }> {
  const started = Date.now()
  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: MASTER_SYSTEM + systemSuffix },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.85,
    max_tokens: 1500,
  })
  const raw = completion.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw) as { story_starter?: string }
  const story = parsed.story_starter ?? ''
  return {
    story,
    word_count: story.trim().split(/\s+/).filter(Boolean).length,
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
  const {
    foundation_id,
    chapter_index,
    // Custom niche inputs (used when foundation_id is empty)
    target_market: customTarget,
    core_problem: customProblem,
    unique_mechanism: customMechanism,
    ebook_title: customEbookTitle,
    chapter_title: customChapterTitle,
    chapter_goal: customChapterGoal,
  } = body as {
    foundation_id?: string
    chapter_index?: number
    target_market?: string
    core_problem?: string
    unique_mechanism?: string
    ebook_title?: string
    chapter_title?: string
    chapter_goal?: string
  }

  // Resolve project context — either from preset foundation or custom inputs.
  let label: string
  let target_market: string
  let core_problem: string
  let unique_mechanism: string
  let ebook_title: string
  let clarity_sentence: string
  let chapter_title: string
  let chapter_goal: string
  let chapter_number = 1

  if (foundation_id) {
    const foundation = getTestFoundation(foundation_id)
    if (!foundation) return NextResponse.json({ error: 'Unknown foundation_id' }, { status: 400 })
    const ch = foundation.ebook_chapters[chapter_index ?? 0] ?? foundation.ebook_chapters[0]
    if (!ch) return NextResponse.json({ error: 'No chapter at that index' }, { status: 400 })
    label = foundation.label
    target_market = foundation.target_market
    core_problem = foundation.core_problem
    unique_mechanism = foundation.unique_mechanism
    ebook_title = foundation.ebook_title
    clarity_sentence = foundation.clarity_sentence
    chapter_title = ch.title
    chapter_goal = ch.core_lessons
    chapter_number = ch.chapter_number
  } else {
    if (!customTarget?.trim() || !customProblem?.trim() || !customMechanism?.trim() || !customChapterTitle?.trim() || !customChapterGoal?.trim()) {
      return NextResponse.json({
        error: 'Custom niche requires target_market, core_problem, unique_mechanism, chapter_title, and chapter_goal.',
      }, { status: 400 })
    }
    label = 'Custom niche'
    target_market = customTarget.trim()
    core_problem = customProblem.trim()
    unique_mechanism = customMechanism.trim()
    ebook_title = customEbookTitle?.trim() || `A practical guide for ${target_market}`
    clarity_sentence = `I help ${target_market} who struggle with ${core_problem} through ${unique_mechanism}`
    chapter_title = customChapterTitle.trim()
    chapter_goal = customChapterGoal.trim()
  }

  try {
    // Step 1 — generate the niche language pack.
    const languageStarted = Date.now()
    const language: MarketLanguage = await generateMarketLanguage({
      target_market,
      problem: core_problem,
      mechanism: unique_mechanism,
      clarity_sentence,
    })
    const languageElapsed = Date.now() - languageStarted
    const marketHint = buildMarketLanguageHint(language)

    // Step 2 — same story prompt run TWICE in parallel.
    const prompt = storyPrompt(target_market, core_problem, ebook_title, chapter_title, chapter_goal)

    const [withResult, withoutResult] = await Promise.all([
      runStory(prompt, marketHint),
      runStory(prompt, ''),
    ])

    return NextResponse.json({
      success: true,
      foundation_label: label,
      target_market,
      ebook_title,
      chapter: { number: chapter_number, title: chapter_title, goal: chapter_goal },
      language_pack: language,
      language_elapsed_ms: languageElapsed,
      prompt_used: prompt,
      market_hint_text: marketHint,
      with_language: {
        story: withResult.story,
        word_count: withResult.word_count,
        elapsed_ms: withResult.elapsed_ms,
      },
      without_language: {
        story: withoutResult.story,
        word_count: withoutResult.word_count,
        elapsed_ms: withoutResult.elapsed_ms,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[test-market-language]', message)
    return NextResponse.json({ error: 'comparison_failed', detail: message }, { status: 500 })
  }
}
