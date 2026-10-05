// ─── Module 1: unique mechanisms ─────────────────────────────────────────────
//
// Five named, ownable frameworks for solving the student's chosen problem.
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

A unique mechanism is a named, ownable framework that explains WHY the usual fix keeps failing and gives a new way to see and solve the problem. The reader should finish it thinking "so THAT's why it kept coming back."

FOR EACH MECHANISM:
- Start from the insight. What does this market keep doing that only treats part of the problem? What do they not understand about why the problem returns or never gets solved?
- Turn that insight into a framework the reader can picture and remember.
- Use a DIFFERENT shape for each of the ${MECHANISM_COUNT}, for example: zones or areas to cover; a cycle or sequence over time; a diagnostic method or tool (a "hunt", checklist, tracker or map); layers of defense; an acronym protocol; a scorecard; a timeline. Never give two mechanisms the same shape.
- Make one of them an acronym protocol whenever a short, natural word tied to the problem works (like T.I.C.K. for ticks: Treat, Inspect, Clear, Keep out). Each letter is one part. Skip it rather than force a clumsy acronym.
- Name it so it is easy to say and picture, specific to this problem, and sounds ownable. Add ™ after the name. Avoid generic names like "The Ultimate X System" or "The X Blueprint".
- Keep it honest. If health, safety, legal, or money decisions are involved, the e-book supports professional advice and never replaces it; say how in safety_note.

Return ONLY JSON:
{
  "recommended_rank": <rank of your favorite>,
  "recommended_reason": "1-2 sentences on why it is the strongest for selling an e-book",
  "items": [
    {
      "rank": 1,
      "name": "The <Name>™",
      "shape": "zones | cycle | method | layers | acronym | scorecard | timeline | other",
      "core_idea": "2-3 sentences. What most people in this market do, what they miss, and the new way to see it.",
      "parts": [{ "label": "e.g. Zone 1: The Dog, or T: Treat the Dog", "description": "one sentence" }],
      "big_idea": "One quotable sentence that captures the mechanism",
      "why_it_stands_out": "1-2 sentences: what they already know or try, versus what this finally explains",
      "aha_moment": "The moment it clicks, in their own words, in natural Taglish",
      "ebook_title": "The <Name>™",
      "ebook_subtitle": "A specific, benefit-driven subtitle",
      "tools": ["0 to 3 practical extras the e-book could include, e.g. a printable checklist or tracker"],
      "safety_note": "One sentence, or empty if not needed",
      "strength": "2 to 5 words, e.g. Easiest to understand, Most memorable, Strongest why-it-failed story",
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
  core_idea: string
  parts: Array<{ label: string; description: string }>
  big_idea: string
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
        core_idea: s(it.core_idea),
        parts,
        big_idea: bigIdea,
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
