// ─── Validator: Internal Consistency ──────────────────────────────────────────
// Does the story_starter actually set up what the lessons teach? Are character
// names and details consistent across sections? Do practical steps follow from
// the lessons?
//
// Single LLM call, small token budget. Runs only when Tier 1 has flagged.

import { openai, AI_MODEL } from '../../openai'
import type { ChapterShape, Issue, ValidatorResult } from '../types'

export async function validateConsistency(chapter: ChapterShape): Promise<ValidatorResult> {
  const started = Date.now()

  if (!chapter.story_starter || !chapter.core_lessons) {
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }

  const stepsText = (chapter.practical_steps ?? [])
    .map((s, i) => `${i + 1}. ${s.title ?? ''}: ${s.description ?? ''}`)
    .join('\n')

  const prompt = `You are a strict editorial reviewer. Check if a chapter is internally consistent.

STORY STARTER:
${chapter.story_starter}

CORE LESSONS:
${chapter.core_lessons}

PRACTICAL STEPS:
${stepsText || '(none)'}

Check for:
1. Does the story_starter introduce characters, situations, or concepts that are RELEVANT to and connect with the lessons? Or is it disconnected/decorative?
2. Are character names and details consistent if referenced in multiple sections?
3. Do the practical steps follow logically from the lessons?
4. Any internal contradictions?

Return ONLY valid JSON:
{
  "consistent": true | false,
  "issue": "If not consistent: one sentence describing the specific problem. Empty string if consistent."
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
    const parsed = JSON.parse(raw) as { consistent?: boolean; issue?: string }

    const issues: Issue[] = []
    if (parsed.consistent === false && parsed.issue?.trim()) {
      issues.push({
        validator: 'consistency',
        severity: 'medium',
        message: `Internal inconsistency: ${parsed.issue.trim()}`,
        affected_section: 'overall',
      })
    }
    return { ok: issues.length === 0, issues, elapsed_ms: Date.now() - started }
  } catch (err) {
    console.error('[validator/consistency] failed:', err)
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }
}
