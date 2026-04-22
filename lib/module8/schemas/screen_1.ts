// ───────────────────────────────────────────────────────────────────────────
// Schema: Screen 1 — Course Readiness Check
// ───────────────────────────────────────────────────────────────────────────
// Per Appendix A + spec docs:
// - User answers 5 multi-choice questions (closed list enums)
// - Deterministic scoring computes readiness_score (0-10) and verdict
// - Creator generates coach_notes prose

import { z } from 'zod'
import { READINESS_VERDICTS } from '../types'

// ── User answers (request payload) ──────────────────────────────────────
export const readinessRequestSchema = z.object({
  ebook_finished_status:    z.enum(['finished', 'almost_finished', 'not_finished']),
  ebook_sales_signal:       z.enum(['10_plus_sales', 'few_sales', 'no_sales']),
  buyer_feedback_signal:    z.enum(['yes_multiple', 'yes_some', 'no_feedback']),
  audience_pull_signal:     z.enum(['yes_directly_asked', 'some_interest', 'no_interest']),
  time_energy_next_6_weeks: z.enum(['plenty', 'some', 'very_little']),
})

export type ReadinessRequest = z.infer<typeof readinessRequestSchema>

// ── Creator draft output (just coach_notes + recommended_next_path text) ─
export const readinessCreatorSchema = z.object({
  coach_notes: z.string().min(20),
  recommended_next_path: z.enum([
    'course_ready',
    'workshop_may_be_better',
    'needs_clearer_proof_first',
    'better_as_implementation_course',
    'better_as_quick_start_course',
  ]),
})

export type ReadinessCreatorDraft = z.infer<typeof readinessCreatorSchema>

// ── Full persisted payload ───────────────────────────────────────────────
export const readinessPayloadSchema = z.object({
  // Raw answers
  ebook_finished_status: readinessRequestSchema.shape.ebook_finished_status,
  ebook_sales_signal:    readinessRequestSchema.shape.ebook_sales_signal,
  buyer_feedback_signal: readinessRequestSchema.shape.buyer_feedback_signal,
  audience_pull_signal:  readinessRequestSchema.shape.audience_pull_signal,
  time_energy_next_6_weeks: readinessRequestSchema.shape.time_energy_next_6_weeks,
  // Computed
  readiness_score:          z.number().int().min(0).max(10),
  readiness_verdict:        z.enum(READINESS_VERDICTS),
  // Creator
  recommended_next_path:    readinessCreatorSchema.shape.recommended_next_path,
  coach_notes:              z.string(),
})

export type ReadinessPayload = z.infer<typeof readinessPayloadSchema>

// ─── Deterministic scoring (per Appendix A) ──────────────────────────────

const SCORES: Record<string, Record<string, number>> = {
  ebook_finished_status: {
    finished: 2,
    almost_finished: 1,
    not_finished: 0,
  },
  ebook_sales_signal: {
    '10_plus_sales': 2,
    few_sales: 1,
    no_sales: 0,
  },
  buyer_feedback_signal: {
    yes_multiple: 2,
    yes_some: 1,
    no_feedback: 0,
  },
  audience_pull_signal: {
    yes_directly_asked: 2,
    some_interest: 1,
    no_interest: 0,
  },
  time_energy_next_6_weeks: {
    plenty: 2,
    some: 1,
    very_little: 0,
  },
}

export function scoreReadiness(answers: ReadinessRequest): {
  readiness_score: number
  readiness_verdict: typeof READINESS_VERDICTS[number]
} {
  let total = 0
  for (const [field, value] of Object.entries(answers)) {
    total += SCORES[field][value as string] ?? 0
  }

  let verdict: typeof READINESS_VERDICTS[number]
  if (total >= 8) verdict = 'ready'
  else if (total >= 5) verdict = 'borderline'
  else verdict = 'not_ready'

  return { readiness_score: total, readiness_verdict: verdict }
}
