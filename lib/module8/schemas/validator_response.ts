// ───────────────────────────────────────────────────────────────────────────
// Shared Validator Response Schema
// ───────────────────────────────────────────────────────────────────────────
// Every validator (curriculum, learner_experience, market) returns this
// shape per Doc 3 + Doc 4.

import { z } from 'zod'

export const validatorResponseSchema = z.object({
  overall_score: z.number().min(1).max(10),
  dimension_scores: z.record(z.string(), z.number().min(1).max(10)),
  pass_recommendation: z.enum(['pass', 'revise', 'escalate']),
  top_issues: z.array(z.string()).max(10),
  suggested_fixes: z.array(z.string()).max(10),
  confidence: z.enum(['low', 'medium', 'high']),
  warnings: z.array(z.string()).optional(),
})

export type ValidatorResponse = z.infer<typeof validatorResponseSchema>
