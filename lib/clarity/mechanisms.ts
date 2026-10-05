// ─── Module 1: unique mechanisms ─────────────────────────────────────────────
//
// Five named, ownable frameworks for solving the student's chosen problem.
//
// Revised the same day after Jon compared a retirement set with ChatGPT's
// (Retirement Gap Method, 3-Paycheck Retirement, 10-Year Rescue, Freedom
// Ladder). Ours had metaphor names (X-Ray, Salbabida, Landing Strip), planner
// jargon parts ("Debt Shadow", "Longevity Ring") and a padded acronym, because
// the prompt handed Sol a quota of shapes and asked for an acronym. Now: start
// from the reader's current thinking and flip it, plain-word names and parts,
// a worked peso example, and the emotional shift. Style examples come from
// other markets so tests on the benchmark topics can't just copy them.
//
// History (2026-10-05): rebuilt to match Jon's benchmark, a ChatGPT
// (GPT-5.6 Sol) answer for recurring ticks. What made it work, and what the
// old gpt-4o prompt lacked:
// - five DIFFERENT shapes (zones, a cycle, a diagnostic method, layers, an
//   acronym) instead of five step lists with different names
// - a sharp insight about why the usual fix fails ("You don't solve a tick
//   problem by treating the dog. You solve the entire ecosystem.")
// - "why it stands out": what owners already know vs what they don't
// - an e-book title and subtitle, practical tools, a safety note
// - a ranking with a clear favourite and why
// The old prompt only received the problem's one-line title; this one gets
// the whole problem card (signs, what people try, evidence, desired outcome).

import { openai, modelForRoute, samplingParams } from '@/lib/openai'
import { logAiUsage } from '@/lib/aiUsage'
import { enforceHouseStyle, fixBannedWords } from '@/lib/clarity/problemsReport'

export const MECHANISM_COUNT = 5

export interface MechanismInput {
  targetMarket: string
  problem: string
  currentSolution?: string
  realQuestion?: string
  signs?: string[]
  currentAttempts?: string
  proofOfDemand?: string
  desiredOutcome?: string
  ebookTitle?: string
}

export function mechanismsPrompt(i: MechanismInput): string {
  const context = [
    `Target market: ${i.targetMarket}`,
    `Problem: ${i.problem}`,
    i.realQuestion && `Their question, in their words: ${i.realQuestion}`,
    i.signs?.length && `What it looks like day to day:\n${i.signs.map(s => `- ${s}`).join('\n')}`,
    i.currentSolution && `What they usually do now: ${i.currentSolution}`,
    i.currentAttempts && i.currentAttempts !== i.currentSolution && `Why that isn't working: ${i.currentAttempts}`,
    i.proofOfDemand && `What they already spend on it: ${i.proofOfDemand}`,
    i.desiredOutcome && `The outcome they want: ${i.desiredOutcome}`,
  ].filter(Boolean).join('\n\n')

  return `You are a best-selling non-fiction author and direct-response marketer. Create ${MECHANISM_COUNT} unique mechanisms for an e-book that solves this problem.

${context}

A unique mechanism is a named, ownable way of solving the problem that changes how the reader sees it. It starts from what they currently believe or do, flips it, and gives them a simple path they can follow. The reader should finish it thinking "ah, that's the real problem, and I can actually do this."

FOR EACH MECHANISM:
- Start from the reader's current thinking: the question they keep asking, the usual advice, or what they keep doing. Then flip it. "Instead of [what they do or believe now], [the new way]."
- Speak to this reader's exact situation (their age, stage, money, constraints), not a generic person.
- Choose the shape that genuinely fits THIS problem: stages over time, a simple formula with levers, separate income or resource sources, zones or places, levels or milestones, a cycle to break, a timeline with phases. The five must be genuinely different ideas, but never force a shape or wrap an idea in a metaphor just to be different.
- Name it so a stranger can guess the idea from the name alone (style examples from other markets, never reuse their wording: "The 15-Minute Ulam System", "The Night-Before Exam Rescue", "The Utang Collection Calendar"). At most one name in the set may be built on a metaphor, and only if the meaning is instantly clear. Use an acronym only if every letter is a plain, natural step; never pad a letter to make a word. Add ™ after the name. Avoid "The Ultimate X System" or "The X Blueprint".
- Name the parts in plain words this reader already uses (style examples: Plan, Prep, Cook; Spot it, Ask it, Collect it). No planner or industry jargon, no invented terms. Each part name must make sense on its own, before its description.
- Make it concrete. When the problem involves money, time, counts, or other measurable things, include a short worked example with realistic Philippine numbers, clearly marked as an example (style example from another market: "Say your store lends ₱300 of utang a day: that's ₱9,000 a month sitting in other people's pockets.").
- Say how it changes the way the reader feels: from overwhelmed to what.
- Keep it honest. If health, safety, legal, or money decisions are involved, the e-book supports professional advice and never replaces it; say how in safety_note.

Return ONLY JSON:
{
  "recommended_rank": <rank of your favorite>,
  "recommended_reason": "1-2 sentences on why it is the strongest for selling an e-book",
  "items": [
    {
      "rank": 1,
      "name": "The <Name>™",
      "shape": "stages | formula | sources | zones | levels | cycle | timeline | other",
      "old_way": "What they believe or do now, in a few words",
      "new_way": "The flip, in a few words",
      "core_idea": "2-3 sentences. What most people in this market do, what that misses for someone in their situation, and the new way to see it.",
      "parts": [{ "label": "Plain-word name", "description": "One sentence on what they do in this part" }],
      "big_idea": "One quotable sentence that captures the flip",
      "worked_example": "A short example with realistic numbers, or empty if the problem has nothing measurable",
      "the_shift": "One sentence: how this changes the way the reader feels about the problem",
      "why_it_stands_out": "1-2 sentences: what most books, advice, or people say, versus what this does differently",
      "aha_moment": "The moment it clicks, in their own words, in natural Taglish",
      "ebook_title": "The <Name>™",
      "ebook_subtitle": "A specific, benefit-driven subtitle that names the reader",
      "tools": ["0 to 3 practical extras the e-book could include, e.g. a printable tracker or checklist"],
      "safety_note": "One sentence, or empty if not needed",
      "strength": "2 to 5 words, e.g. Easiest to sell, Most measurable, Most hopeful",
      "strength_reason": "One sentence"
    }
  ]
}

Exactly ${MECHANISM_COUNT} items, ranked from strongest to weakest for selling an e-book to this market. Each has 3 to 5 parts. Plain conversational English; Taglish only in aha_moment. No em dashes. English contractions keep their apostrophes; no apostrophes on shortened Tagalog words (yan, yung, di, wag, to). Never use: unlock, unleash, discover, transform, revolutionize, ultimate, game-changing, next-level, harness, ignite, amplify, supercharge.`
}

// ── Generation (streamed) ────────────────────────────────────────────────────

// Sol to match the problems step and Jon's benchmark. Terra was as fast
// (~41s vs ~43s) with similar quality in the 2026-10-05 comparison.
const MECHANISMS_MODEL = modelForRoute('clarity-mechanisms', 'creative', 'gpt-5.6-sol')

export interface MechanismCard {
  rank: number
  name: string
  shape: string
  old_way: string
  new_way: string
  core_idea: string
  parts: Array<{ label: string; description: string }>
  big_idea: string
  worked_example: string
  the_shift: string
  why_it_stands_out: string
  aha_moment: string
  ebook_title: string
  ebook_subtitle: string
  tools: string[]
  safety_note: string
  strength: string
  strength_reason: string
  // Older fields, derived so a browser on the previous page bundle still
  // renders something sensible.
  steps: string[]
  aha_statements: string[]
  positioning_line: string
}

export interface MechanismCards {
  items: MechanismCard[]
  recommended: { rank: number; reason: string } | null
}

export type MechanismsEvent =
  | { type: 'mechanism'; index: number; name: string }
  | { type: 'progress'; chars: number }
  | { type: 'done'; cards: MechanismCards }

// A mechanism is announced once its "name" string has fully streamed in.
const NAME_FIELD_RE = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g

export async function* streamMechanisms(
  input: MechanismInput,
  userId: string | null,
  signal?: AbortSignal,
): AsyncGenerator<MechanismsEvent> {
  const stream = await openai.chat.completions.create(
    {
      model: MECHANISMS_MODEL,
      messages: [{ role: 'user', content: mechanismsPrompt(input) }],
      response_format: { type: 'json_object' },
      ...samplingParams(MECHANISMS_MODEL, 0.8),
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal },
  )

  let text = ''
  let announced = 0
  let lastProgressAt = 0
  for await (const chunk of stream) {
    if (chunk.usage) logAiUsage({ userId, route: 'clarity', model: MECHANISMS_MODEL, usage: chunk.usage })
    const delta = chunk.choices[0]?.delta?.content
    if (!delta) continue
    text += delta
    const matches = [...text.matchAll(NAME_FIELD_RE)]
    while (announced < matches.length && announced < MECHANISM_COUNT) {
      let name = matches[announced][1]
      try { name = JSON.parse(`"${name}"`) } catch { /* keep raw */ }
      announced++
      yield { type: 'mechanism', index: announced, name }
    }
    if (text.length - lastProgressAt > 500) {
      lastProgressAt = text.length
      yield { type: 'progress', chars: text.length }
    }
  }

  if (!text.trim()) throw new Error('No mechanisms came back. Please try again.')
  const json = await fixBannedWords(text, userId)
  const cards = normalizeMechanisms(JSON.parse(json))
  if (cards.items.length === 0) throw new Error('No mechanisms came back. Please try again.')
  yield { type: 'done', cards }
}

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function normalizeMechanisms(raw: unknown): MechanismCards {
  const parsed = enforceHouseStyle(raw) as Record<string, unknown>
  const list = Array.isArray(parsed.items) ? parsed.items : []

  const items = list
    .map((r, i) => ({ it: r as Record<string, unknown>, i }))
    .sort((a, b) => (Number(a.it.rank) || a.i + 1) - (Number(b.it.rank) || b.i + 1))
    .map(({ it }, i): MechanismCard => {
      const parts = (Array.isArray(it.parts) ? it.parts : [])
        .map(p => ({ label: s((p as { label?: unknown })?.label), description: s((p as { description?: unknown })?.description) }))
        .filter(p => p.label)
        .slice(0, 6)
      const aha = s(it.aha_moment)
      const bigIdea = s(it.big_idea)
      return {
        rank: i + 1,
        name: s(it.name),
        shape: s(it.shape),
        old_way: s(it.old_way).replace(/^instead of\s+/i, ''),
        new_way: s(it.new_way),
        core_idea: s(it.core_idea),
        parts,
        big_idea: bigIdea,
        worked_example: s(it.worked_example),
        the_shift: s(it.the_shift),
        why_it_stands_out: s(it.why_it_stands_out),
        aha_moment: aha,
        ebook_title: s(it.ebook_title),
        ebook_subtitle: s(it.ebook_subtitle),
        tools: (Array.isArray(it.tools) ? it.tools : []).map(s).filter(Boolean).slice(0, 3),
        safety_note: s(it.safety_note),
        strength: s(it.strength),
        strength_reason: s(it.strength_reason),
        steps: parts.map(p => (p.description ? `${p.label}: ${p.description}` : p.label)),
        aha_statements: aha ? [aha] : [],
        positioning_line: bigIdea,
      }
    })
    .filter(m => m.name)
    .slice(0, MECHANISM_COUNT)

  const rec = Number(parsed.recommended_rank)
  const recommended = Number.isInteger(rec) && rec >= 1 && rec <= items.length
    ? { rank: rec, reason: s(parsed.recommended_reason) }
    : null
  return { items, recommended }
}
