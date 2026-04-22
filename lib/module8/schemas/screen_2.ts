// ───────────────────────────────────────────────────────────────────────────
// Schema: Screen 2 — Reconfirm the Transformation
// ───────────────────────────────────────────────────────────────────────────
// Per Appendix A + Doc 2:
// - User reviews/edits 5 fields (audience, problem, result, method, student capability)
// - Creator generates 3 candidate transformation statements, then a final
//   approved statement structure

import { z } from 'zod'

// User inputs — review/edit the 5 transformation fields
export const transformationRequestSchema = z.object({
  course_audience:        z.string().min(3).max(500),
  course_problem:         z.string().min(3).max(500),
  course_result:          z.string().min(3).max(500),
  course_method:          z.string().min(3).max(500),
  student_capability:     z.string().min(3).max(500),
  duration_commitment:    z.string().optional(),
})

export type TransformationRequest = z.infer<typeof transformationRequestSchema>

// Creator draft — generates the transformation statement + structured outputs
export const transformationCreatorSchema = z.object({
  course_transformation_statement: z.string().min(40).max(600),
  target_learner: z.string().min(10),
  course_outcome: z.string().min(10),
  unique_method: z.string().min(5),
  implicit_outcomes: z.array(z.string()).min(2).max(6),
  duration_commitment: z.string().min(2),
  audience_protective_clause: z.string().optional(),
})

export type TransformationCreatorDraft = z.infer<typeof transformationCreatorSchema>
export type TransformationPayload = TransformationCreatorDraft
