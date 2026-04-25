import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getTestFoundation } from '@/lib/module8/testFoundations'

// Admin-only side-by-side test of two story_starter (chapter intro) prompts.
// Returns both outputs so the admin can compare them.

export const maxDuration = 60

// ── MASTER SYSTEM PROMPT (mirrors ebook-agent) ───────────────────────────────
const MASTER_SYSTEM = `You are an expert ebook writing assistant helping Filipino creators turn their knowledge into a sellable digital product (ebook).

Your job is to write a high-quality, practical, entry-level non-fiction ebook for whatever specific Filipino audience the creator is serving — defined by the target_market and problem in the project context.

WRITING RULES — follow these strictly:
- Write at an entry level. This is for beginners, not experts.
- Be practical and specific. Every lesson must have a clear "what to do."
- Do NOT use hype, exaggerated claims, or fake testimonials.
- Do NOT include advanced strategies — keep it simple and executable.
- Do NOT use academic or formal language. Write conversationally.
- VARY sentence length deliberately. Mix long explanatory sentences with punchy 3–6 word sentences. Short sentences land harder. Use them after important points.
- Use simple words.
- Clarity over cleverness. Done beats perfect.
- Use English as the primary language. Add light, natural Taglish warmth where a Filipino reader would feel immediately understood — never forced, just real.
- TITLES AND SUBTITLES must be 100% English — no Tagalog or Filipino words whatsoever.
- Chapter titles must also be 100% English.
- Body content and examples may use natural conversational Taglish where it adds warmth.

WHAT READERS BUY: People don't buy information. They buy relief. They buy clarity, speed, and confidence. Every section must make the reader feel: "I can do this."

BANNED WORDS — Never use these in any output, including titles, chapter names, and body text:
HARD BAN: unlock, unleash, discover, transform your life, revolutionize, ultimate guide, game-changing, next-level, powerful secrets, tap into, harness, ignite, amplify, supercharge
SOFT BAN (avoid unless truly necessary): maximize, optimize, elevate, breakthrough, leverage

Always return valid JSON only. No explanations outside JSON. No markdown fences.`

// ── OLD PROMPT (current production — pass2_StoryPrompt) ──────────────────────

function oldPrompt(project: { target_market: string; problem: string }, bookTitle: string, chapter: { number: number; title: string; goal: string }): string {
  return `TASK: Story Starter for Chapter ${chapter.number} — "${chapter.title}"

Book: "${bookTitle}"
Target Market: ${project.target_market}
Problem: ${project.problem}
Chapter Goal: ${chapter.goal}

Write ONLY the Story Starter for this chapter. Do NOT teach yet — pure storytelling.

CINEMATIC TECHNIQUE — follow this exactly:
- Open in a specific moment, mid-scene. No preamble.
- Use a fictional but hyper-realistic Filipino character from the target market. Give them a full name and a concrete situation.
- VARY sentence length deliberately. Long sentences for building tension. Then short ones. Very short ones. One-word sentences if needed.
- Use real Taglish dialogue in quotation marks — the words people actually say to themselves or others.
- Show the pain through specific sensory detail — not "she was stressed" but what she saw, said, felt, or did.
- Include at least one moment of false hope followed by a harder fall. (e.g. They thought it was fixed. It wasn't.)
- End the story with a powerful realization line — something that flips their understanding.
- NEVER start the transition with "In this chapter" or generic openers.
- Transition to the lesson with something like: "Because here's what most [target market] don't realize:" or "That's the thing about [topic]."
- 300–500 words. No more. No padding.

Return this exact JSON:
{
  "story_starter": "Full story text here — use \\n\\n between paragraphs for line breaks"
}`
}

// ── NEW PROMPT (hybrid — workshop-style framing) ─────────────────────────────

function newPrompt(project: { target_market: string; problem: string }, bookTitle: string, chapter: { number: number; title: string; goal: string }): string {
  return `TASK: Story-driven introduction for Chapter ${chapter.number} — "${chapter.title}"

Book: "${bookTitle}"
Target Market: ${project.target_market}
Problem: ${project.problem}
Chapter Goal: ${chapter.goal}

Write an introduction for this chapter that uses a STORY.

The story must be: engaging, unique, intriguing, captivating, vivid.
Use simple words that ${project.target_market} can relate to.

End with a POWERFUL HOOK that keeps the reader hanging — they MUST keep reading.
USE PERSUASIVE SALES COPY STRATEGY to make the reader read every line.
Every paragraph pulls them to the next.

CHARACTER (the protagonist):
- Fictional but hyper-realistic Filipino from ${project.target_market}
- Full name, specific job, specific city, specific situation
- Show their pain through sensory detail — what they saw, said, felt, did
- Include one moment of false hope, followed by a harder fall

VOICE:
- Simple words. Conversational. Light Taglish where it lands harder than English.
- Real dialogue in quotation marks — what people actually say
- Vary sentence length: long for tension, short for impact

LENGTH: 300–500 words.

Return this exact JSON:
{
  "story_starter": "Full story text — use \\n\\n between paragraphs"
}`
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runStoryStarter(prompt: string): Promise<{ story_starter: string; elapsed_ms: number }> {
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
    story_starter: parsed.story_starter ?? '',
    elapsed_ms: Date.now() - started,
  }
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

  const body = await request.json()
  const { foundation_id, chapter_index, custom_chapter, custom_project, custom_book_title } = body

  // Resolve project + chapter context
  let project: { target_market: string; problem: string }
  let bookTitle: string
  let chapter: { number: number; title: string; goal: string }

  if (foundation_id) {
    const foundation = getTestFoundation(foundation_id)
    if (!foundation) return NextResponse.json({ error: 'Unknown foundation_id' }, { status: 400 })

    const ch = foundation.ebook_chapters[chapter_index ?? 0]
    if (!ch) return NextResponse.json({ error: 'Chapter index out of range' }, { status: 400 })

    project = {
      target_market: foundation.target_market,
      problem: foundation.core_problem,
    }
    bookTitle = foundation.ebook_title
    chapter = {
      number: ch.chapter_number,
      title: ch.title,
      goal: ch.core_lessons,  // closest field; foundation chapters don't have explicit "goal"
    }
  } else if (custom_chapter && custom_project && custom_book_title) {
    project = custom_project
    bookTitle = custom_book_title
    chapter = custom_chapter
  } else {
    return NextResponse.json({ error: 'Provide either foundation_id+chapter_index OR custom_*' }, { status: 400 })
  }

  // Build both prompts
  const oldPromptText = oldPrompt(project, bookTitle, chapter)
  const newPromptText = newPrompt(project, bookTitle, chapter)

  try {
    // Run both in parallel
    const [oldResult, newResult] = await Promise.all([
      runStoryStarter(oldPromptText),
      runStoryStarter(newPromptText),
    ])

    return NextResponse.json({
      success: true,
      project,
      bookTitle,
      chapter,
      old: {
        story_starter: oldResult.story_starter,
        elapsed_ms: oldResult.elapsed_ms,
        word_count: oldResult.story_starter.split(/\s+/).filter(Boolean).length,
        prompt: oldPromptText,
      },
      new: {
        story_starter: newResult.story_starter,
        elapsed_ms: newResult.elapsed_ms,
        word_count: newResult.story_starter.split(/\s+/).filter(Boolean).length,
        prompt: newPromptText,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[test-story-starter]', message)
    return NextResponse.json({ error: 'generation_failed', detail: message }, { status: 500 })
  }
}
