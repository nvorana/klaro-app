// ─── Validator: Promise Delivery ──────────────────────────────────────────────
// Does the chapter actually deliver what its title and goal promise? Catches
// chapters that wander, stay too high-level, or substitute a different topic.
// Single LLM call (small budget), runs only when Tier 1 already flagged.

import { openai, AI_MODEL } from '../../openai'
import type { ChapterShape, Issue, ValidatorResult } from '../types'

interface OutlineRef {
  title: string
  goal: string
  quick_win_outcome?: string
}

export async function validatePromiseDelivery(
  chapter: ChapterShape,
  outline: OutlineRef
): Promise<ValidatorResult> {
  const started = Date.now()

  const fullChapter = [
    chapter.story_starter ?? '',
    chapter.core_lessons ?? '',
    (chapter.practical_steps ?? [])
      .map(s => `${s.title ?? ''}: ${s.description ?? ''}`)
      .join('\n'),
    [
      chapter.quick_win?.title ?? '',
      chapter.quick_win?.description ?? '',
      (chapter.quick_win?.steps ?? []).join(' '),
    ].join(' '),
  ].join('\n\n').trim()

  if (!fullChapter) {
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }

  const prompt = `You are a strict editorial reviewer. Check if a chapter delivers on its title's promise and chapter goal.

CHAPTER TITLE: "${outline.title}"
CHAPTER GOAL: ${outline.goal}
${outline.quick_win_outcome ? `EXPECTED QUICK WIN: ${outline.quick_win_outcome}` : ''}

CHAPTER CONTENT:
${fullChapter}

Question: Does this chapter actually deliver on the title and goal? Be strict — a chapter that just talks AROUND the promised topic without delivering it is a failure.

Return ONLY valid JSON:
{
  "delivered": true | false,
  "issue": "If not delivered: one sentence describing what's missing or off. Empty string if delivered."
}`

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 300,
    })
    const raw = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(raw) as { delivered?: boolean; issue?: string }

    const issues: Issue[] = []
    if (parsed.delivered === false && parsed.issue?.trim()) {
      issues.push({
        validator: 'promise_delivery',
        severity: 'medium',
        message: `Title/goal not fully delivered: ${parsed.issue.trim()}`,
        affected_section: 'overall',
      })
    }
    return { ok: issues.length === 0, issues, elapsed_ms: Date.now() - started }
  } catch (err) {
    console.error('[validator/promiseDelivery] failed:', err)
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }
}
