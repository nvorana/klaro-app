// ─── Module 4: 4U sales-page headline ─────────────────────────────────────────
//
// 2026-10-06. Jon's sales page headline was "Achieve Financial Peace for
// Retirement in 15 Minutes." The prompt demanded the 4U formula, but:
//   - gpt-4o only got the clarity sentence, title, bonuses, price and
//     guarantee, so the one number available was the "15-Minute" in the
//     bonus names, and all three options were built on "in 15 minutes"
//   - nothing checked the output: the model's own recommended_reason only
//     claimed two of the four Us, "Unlock" (banned everywhere else) got
//     through, and a malformed fourth "option" went unnoticed
// The 4U formula is a must, so it is now enforced:
//   1. real material: the student's saved ebook (chapters and their quick
//      wins), what the market already tries (Module 1 validation), their own
//      words, and the offer's transformation
//   2. Sol writes each U separately for every option before the headline
//   3. code checks every U is filled, lengths, no question, no banned words
//   4. a separate grader marks each U pass/fail; failures are regenerated
//      with the grader's notes. Only options passing all four are returned.

import { openai, modelForRoute, samplingParams, tokenLimit } from '@/lib/openai'
import { logAiUsage } from '@/lib/aiUsage'
import { findBannedWords } from '@/lib/bannedWords'
import { createClient } from '@/lib/supabase/server'

const WRITER_MODEL = modelForRoute('sales-headline', 'creative', 'gpt-5.6-sol')
const GRADER_MODEL = modelForRoute('sales-headline-grader', 'creative', 'gpt-5.6-terra')
const MAX_ROUNDS = 2

export interface HeadlineRequest {
  target_market: string
  problem: string
  mechanism: string
  ebook_title: string
  bonuses?: Array<{ name?: string; title?: string } | string>
}

interface FourU { useful: string; urgent: string; unique: string; ultra_specific: string }
interface Draft extends FourU { line1: string; line2: string }
interface Grade { useful: boolean; urgent: boolean; unique: boolean; ultra_specific: boolean; notes: string }

export interface HeadlineResult {
  options: string[]           // "line 1\nline 2", the shape the page already uses
  recommended: number
  recommended_reason: string
  four_u: FourU[]             // per option, shown under each headline
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const words = (t: string) => t.split(/\s+/).filter(Boolean).length

// ── Material ─────────────────────────────────────────────────────────────────

async function loadMaterial(userId: string, req: HeadlineRequest): Promise<string> {
  const supabase = await createClient()
  const [{ data: clarity }, { data: offer }, { data: ebook }] = await Promise.all([
    supabase.from('clarity_sentences').select('target_market, core_problem, unique_mechanism, validation_feedback, market_language').eq('user_id', userId).maybeSingle(),
    supabase.from('offers').select('transformation').eq('user_id', userId).maybeSingle(),
    supabase.from('ebooks').select('title, chapters').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const vf = (clarity?.validation_feedback ?? {}) as { existing_solutions?: string[]; buying_behavior?: string }
  const ml = (clarity?.market_language ?? {}) as { emotional_words?: string[]; everyday_phrases?: string[] }
  const chapters = Array.isArray(ebook?.chapters) ? ebook!.chapters as Array<{ number?: number; title?: string; quick_win?: { name?: string; immediate_result?: string } }> : []
  const bonusNames = (req.bonuses ?? []).map(b => (typeof b === 'string' ? b : s(b.name) || s(b.title))).filter(Boolean)

  return [
    `Reader: ${clarity?.target_market || req.target_market}`,
    `Their problem: ${clarity?.core_problem || req.problem}`,
    `The book's method (unique mechanism): ${clarity?.unique_mechanism || req.mechanism}`,
    `Ebook title: ${ebook?.title || req.ebook_title}`,
    vf.existing_solutions?.length ? `What they already try: ${vf.existing_solutions.join('; ')}` : '',
    vf.buying_behavior ? `What they already spend on: ${vf.buying_behavior}` : '',
    (ml.emotional_words?.length || ml.everyday_phrases?.length)
      ? `Their own words: ${[...(ml.emotional_words ?? []), ...(ml.everyday_phrases ?? [])].slice(0, 12).join(', ')}` : '',
    offer?.transformation ? `The transformation the offer promises: ${offer.transformation}` : '',
    chapters.length
      ? `What the book walks them through (chapter: the win at the end):\n${chapters.map(c => `- ${c.number}. ${c.title}: ${c.quick_win?.name ?? ''}${c.quick_win?.immediate_result ? ` (they end with: ${c.quick_win.immediate_result})` : ''}`).join('\n')}`
      : '',
    bonusNames.length ? `Bonuses (context only; never take a number or timeframe from these names): ${bonusNames.join('; ')}` : '',
  ].filter(Boolean).join('\n')
}

// ── Writing ──────────────────────────────────────────────────────────────────

const FOUR_U = `THE 4U FORMULA. Every headline must satisfy ALL FOUR. This is not optional.
- useful: a concrete thing the reader gets or can do, taken from what the book actually delivers. A feeling alone ("financial peace", "peace of mind") fails.
- urgent: a TRUE reason to act now, from the reader's situation or stage of life, or a realistic timeframe for the FIRST result ("this weekend", "before your next payday"). Never promise the whole outcome in an unrealistic time. Never take a number or timeframe from the bonus names.
- unique: what makes this different from what they already try. Name the old way (e.g. advisors, seminars, "just save more") and show the book's method as the different way.
- ultra_specific: concrete specifics: exactly who this is for, plus at least one real number that is TRUE from the material (how many steps or chapters, a stage of life, a count from the book). Never invent results, incomes, returns, or peso amounts.`

function writerPrompt(material: string, feedback: string): string {
  return `Write 3 headline options for the sales page of this ebook.

MATERIAL (the only facts you may use):
${material}

${FOUR_U}

FORMAT for each option:
- line1: the main outcome statement, under 20 words
- line2: a sub-headline under 15 words that removes the biggest objection or sharpens the unique angle
- Not a question. Plain conversational English; a short phrase in the reader's own Taglish is welcome where it is truly how they talk. No em dashes. No hype words (amazing, revolutionary, life-changing, unlock, unleash, discover, ultimate, game-changing).
- Write like a top direct-response copywriter: lead with the outcome, natural spoken rhythm, not a list of features.
- The 3 options must take different angles and must not reuse the same number or timeframe.
- Vary the structure: at most ONE option may open by naming the reader ("Filipino Husbands…"), and no two line2s may follow the same pattern. Don't repeat the "use X, not Y" contrast in every option; show uniqueness in different ways.
- The real number for ultra_specific must appear in the headline text itself (line1 or line2), not only in your notes.
- Style example from an unrelated market, never reuse its wording: "Collect Your Utang Before Payday. The 4-Step Listahan System for Sari-Sari Owners Tired of Chasing Suki."

For EACH option, first write the four Us as short phrases, then write line1 and line2 so that all four are clearly present in the headline itself.
${feedback ? `\nA strict grader rejected earlier attempts. Fix these problems:\n${feedback}\n` : ''}
Return ONLY JSON:
{
  "options": [
    { "useful": "...", "urgent": "...", "unique": "...", "ultra_specific": "...", "line1": "...", "line2": "..." }
  ],
  "recommended": <index 0-2 of the strongest>,
  "recommended_reason": "One sentence on why it is strongest for this reader"
}`
}

async function writeDrafts(material: string, feedback: string, userId: string): Promise<{ drafts: Draft[]; recommended: number; reason: string }> {
  const res = await openai.chat.completions.create({
    model: WRITER_MODEL,
    messages: [{ role: 'user', content: writerPrompt(material, feedback) }],
    response_format: { type: 'json_object' },
    ...samplingParams(WRITER_MODEL, 0.8),
    ...tokenLimit(WRITER_MODEL, 1500),
  })
  logAiUsage({ userId, route: 'sales-page-section', model: WRITER_MODEL, usage: res.usage })
  const j = JSON.parse(res.choices[0].message.content || '{}') as { options?: unknown[]; recommended?: number; recommended_reason?: string }
  const drafts = (Array.isArray(j.options) ? j.options : [])
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map(o => ({
      useful: s(o.useful), urgent: s(o.urgent), unique: s(o.unique), ultra_specific: s(o.ultra_specific),
      line1: s(o.line1).replace(/\s*—\s*/g, ', '), line2: s(o.line2).replace(/\s*—\s*/g, ', '),
    }))
  return { drafts, recommended: Number(j.recommended) || 0, reason: s(j.recommended_reason) }
}

// Hard rules checked in code before any grading.
function codeCheck(d: Draft): string | null {
  for (const k of ['useful', 'urgent', 'unique', 'ultra_specific'] as const) {
    if (words(d[k]) < 2) return `missing the "${k}" U`
  }
  if (!d.line1 || !d.line2) return 'needs both line1 and line2'
  if (words(d.line1) > 22) return 'line1 is over 20 words'
  if (words(d.line2) > 17) return 'line2 is over 15 words'
  if (/\?\s*$/.test(d.line1) || /\?\s*$/.test(d.line2)) return 'is a question'
  // Ultra-specific needs a real number in the headline itself: a digit or a
  // number word. The first test run passed "Filipino Husbands in Their 50s"
  // with no number in the line the reader actually sees.
  const text = `${d.line1} ${d.line2}`
  if (!/\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty)\b/i.test(text)) return 'has no real number in the headline text'
  const banned = findBannedWords(`${d.line1} ${d.line2}`)
  if (banned.length) return `uses banned words: ${banned.join(', ')}`
  return null
}

// ── Grading ──────────────────────────────────────────────────────────────────

async function gradeDrafts(material: string, drafts: Draft[], userId: string): Promise<Grade[]> {
  const res = await openai.chat.completions.create({
    model: GRADER_MODEL,
    messages: [{ role: 'user', content: `You are a strict direct-response copy editor. Grade each sales page headline against the 4U formula, judging ONLY the headline text itself (line1 + line2), not the notes the writer attached.

MATERIAL (what is true about this product):
${material}

${FOUR_U}

Fail a U if it is missing, vague, a feeling only, unrealistic, or not true to the material. Fail ultra_specific unless the headline text itself contains a true, concrete number. Fail urgent if the timeframe promises the full outcome unrealistically or is taken from a bonus name. Fail ultra_specific if it has no true, concrete number or specific reader.

HEADLINES:
${drafts.map((d, i) => `${i}. ${d.line1} / ${d.line2}`).join('\n')}

Return ONLY JSON:
{ "grades": [ { "index": 0, "useful": true, "urgent": true, "unique": true, "ultra_specific": true, "notes": "one sentence: what fails and why, or 'passes all four'" } ] }` }],
    response_format: { type: 'json_object' },
    ...samplingParams(GRADER_MODEL, 0.2),
    ...tokenLimit(GRADER_MODEL, 800),
  })
  logAiUsage({ userId, route: 'sales-page-section', model: GRADER_MODEL, usage: res.usage })
  const j = JSON.parse(res.choices[0].message.content || '{}') as { grades?: Array<Record<string, unknown>> }
  return drafts.map((_, i) => {
    const g = (j.grades ?? []).find(x => Number(x.index) === i) ?? {}
    return {
      useful: g.useful === true, urgent: g.urgent === true, unique: g.unique === true, ultra_specific: g.ultra_specific === true,
      notes: s(g.notes),
    }
  })
}

const passesAll = (g: Grade) => g.useful && g.urgent && g.unique && g.ultra_specific

// ── Entry point ──────────────────────────────────────────────────────────────

export async function generateHeadlines(userId: string, req: HeadlineRequest): Promise<HeadlineResult> {
  const material = await loadMaterial(userId, req)
  const passing: Array<{ draft: Draft; wasRecommended: boolean }> = []
  let reason = ''
  let feedback = ''

  for (let round = 0; round < MAX_ROUNDS && passing.length < 2; round++) {
    const { drafts, recommended, reason: r } = await writeDrafts(material, feedback, userId)
    const problems: string[] = []
    const checked = drafts.map((d, i) => ({ d, i, problem: codeCheck(d) }))
    checked.filter(c => c.problem).forEach(c => problems.push(`"${c.d.line1}" ${c.problem}`))
    const candidates = checked.filter(c => !c.problem)
    if (candidates.length) {
      const grades = await gradeDrafts(material, candidates.map(c => c.d), userId)
      candidates.forEach((c, k) => {
        if (passesAll(grades[k])) {
          if (passing.length < 3) passing.push({ draft: c.d, wasRecommended: c.i === recommended })
          if (c.i === recommended && r) reason = r
        } else {
          problems.push(`"${c.d.line1}": ${grades[k].notes || 'failed at least one U'}`)
        }
      })
    }
    feedback = problems.join('\n')
  }

  if (passing.length === 0) {
    throw new Error('Could not write a headline that meets all four parts of the 4U formula. Please try again.')
  }

  const recIndex = Math.max(0, passing.findIndex(p => p.wasRecommended))
  return {
    options: passing.map(p => `${p.draft.line1}\n${p.draft.line2}`),
    recommended: recIndex,
    recommended_reason: reason || 'Passes all four parts of the 4U formula and fits this reader most closely.',
    four_u: passing.map(p => ({ useful: p.draft.useful, urgent: p.draft.urgent, unique: p.draft.unique, ultra_specific: p.draft.ultra_specific })),
  }
}
