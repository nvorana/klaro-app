// ─── Validator: Length ────────────────────────────────────────────────────────
// Each section has a target word count baked into its generation prompt
// (e.g. story_starter is asked for 300-500 words). Verify the output hit the
// target. Flags both under-runs (lazy generation) and over-runs (rambly fluff).
//
// No LLM. Just word counts.

import type { AffectedSection, ChapterShape, Issue, ValidatorResult } from '../types'

// Target word ranges per section. Generous on both sides — the prompts ask
// for specific ranges, but we only flag when output is meaningfully outside.
const SECTION_TARGETS: Record<string, { min: number; max: number; section: AffectedSection }> = {
  story_starter: { min: 200, max: 600, section: 'story_starter' },
  core_lessons: { min: 350, max: 1100, section: 'core_lessons' },
  quick_win:    { min: 100, max: 350,  section: 'quick_win' },
}

const PRACTICAL_STEPS_MIN = 3
const PRACTICAL_STEPS_MAX = 7

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function validateLength(chapter: ChapterShape): ValidatorResult {
  const started = Date.now()
  const issues: Issue[] = []

  const sectionTexts: Record<string, string> = {
    story_starter: chapter.story_starter ?? '',
    core_lessons: chapter.core_lessons ?? '',
    quick_win: [
      chapter.quick_win?.title ?? '',
      chapter.quick_win?.description ?? '',
      (chapter.quick_win?.steps ?? []).join(' '),
    ].join(' '),
  }

  for (const [name, text] of Object.entries(sectionTexts)) {
    const target = SECTION_TARGETS[name]
    if (!target || !text.trim()) continue
    const wc = countWords(text)
    const { min, max, section } = target

    if (wc < min) {
      issues.push({
        validator: 'length',
        severity: wc < min * 0.6 ? 'high' : 'low',
        message: `${section} is only ${wc} words (target ${min}-${max}). Expand with more specific examples, dialogue, or sensory detail.`,
        affected_section: section,
      })
    } else if (wc > max) {
      issues.push({
        validator: 'length',
        severity: wc > max * 1.5 ? 'medium' : 'low',
        message: `${section} is ${wc} words (target ${min}-${max}). Tighten — cut repeated points and filler.`,
        affected_section: section,
      })
    }
  }

  // Practical steps: count items, not words
  const stepCount = (chapter.practical_steps ?? []).length
  if (stepCount > 0) {
    if (stepCount < PRACTICAL_STEPS_MIN) {
      issues.push({
        validator: 'length',
        severity: 'medium',
        message: `Only ${stepCount} practical steps (target ${PRACTICAL_STEPS_MIN}-${PRACTICAL_STEPS_MAX}). Add more concrete actions.`,
        affected_section: 'practical_steps',
      })
    } else if (stepCount > PRACTICAL_STEPS_MAX) {
      issues.push({
        validator: 'length',
        severity: 'low',
        message: `${stepCount} practical steps (target ${PRACTICAL_STEPS_MIN}-${PRACTICAL_STEPS_MAX}). Combine related steps to keep the flow tight.`,
        affected_section: 'practical_steps',
      })
    }
  }

  return { ok: issues.length === 0, issues, elapsed_ms: Date.now() - started }
}
