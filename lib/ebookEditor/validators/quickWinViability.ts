// ─── Validator: Quick Win Viability ───────────────────────────────────────────
// Each chapter offers a "quick win" — one concrete action the reader can take
// today, in under 5 minutes. AI sometimes generates "quick wins" that are
// actually 30-minute tasks ("set up a spreadsheet to track…") or vague advice
// ("reflect on your goals…"). This catches those.
//
// Single small LLM call. Runs only when Tier 1 already flagged.

import { openai, AI_MODEL } from '../../openai'
import type { ChapterShape, Issue, ValidatorResult } from '../types'

export async function validateQuickWinViability(chapter: ChapterShape): Promise<ValidatorResult> {
  const started = Date.now()
  const qw = chapter.quick_win

  if (!qw) {
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }

  const qwText = [
    qw.title ?? '',
    qw.description ?? '',
    (qw.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n'),
  ].filter(Boolean).join('\n')

  if (!qwText.trim()) {
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }

  const prompt = `Check if this "quick win" can realistically be done by a beginner in under 5 minutes.

QUICK WIN:
${qwText}

A real quick win is:
- One specific physical action (write down X, send Y, take Z action)
- Doable with what's already in front of the reader
- Completable in under 5 minutes start-to-finish
- Gives an immediate visible result

NOT a quick win:
- Vague self-reflection ("think about what you want")
- Multi-step setup that takes longer than 5 min
- Requires waiting for someone else
- Requires research or learning

Return ONLY valid JSON:
{
  "doable_in_5_min": true | false,
  "issue": "If not doable in 5 min: one sentence explaining why. Empty string if it is."
}`

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200,
    })
    const raw = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw) as { doable_in_5_min?: boolean; issue?: string }

    const issues: Issue[] = []
    if (parsed.doable_in_5_min === false && parsed.issue?.trim()) {
      issues.push({
        validator: 'quick_win_viability',
        severity: 'low',
        message: `Quick win not doable in 5 min: ${parsed.issue.trim()}`,
        affected_section: 'quick_win',
      })
    }
    return { ok: issues.length === 0, issues, elapsed_ms: Date.now() - started }
  } catch (err) {
    console.error('[validator/quickWinViability] failed:', err)
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }
}
