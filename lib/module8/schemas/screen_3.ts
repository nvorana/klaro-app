// ───────────────────────────────────────────────────────────────────────────
// Schema: Screen 3 — Choose the Right Course Type
// ───────────────────────────────────────────────────────────────────────────
// Per Appendix A + Doc 2:
// - Two independent choices: course_depth + delivery_format (closed lists)
// - Creator recommends one value for each with rationale + rejected alternatives

import { z } from 'zod'
import { COURSE_DEPTHS, DELIVERY_FORMATS } from '../types'

export const courseTypeRequestSchema = z.object({
  // User preferences — optional. If user picks their own, creator still runs
  // to provide rationale + alternatives.
  user_preferred_depth:   z.enum(COURSE_DEPTHS).optional(),
  user_preferred_format:  z.enum(DELIVERY_FORMATS).optional(),
  additional_context:     z.string().max(1000).optional(),
})

export type CourseTypeRequest = z.infer<typeof courseTypeRequestSchema>

export const courseTypeCreatorSchema = z.object({
  course_depth: z.enum(COURSE_DEPTHS),
  delivery_format: z.enum(DELIVERY_FORMATS),
  course_type_rationale: z.string().min(30).max(1000),
  rejected_alternatives: z.array(z.object({
    value: z.string(),
    reason: z.string().min(10),
  })).min(1).max(5),
})

export type CourseTypeCreatorDraft = z.infer<typeof courseTypeCreatorSchema>
export type CourseTypePayload = CourseTypeCreatorDraft
