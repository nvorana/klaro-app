// ───────────────────────────────────────────────────────────────────────────
// Schema: Screen 5 — Build the Course Skeleton
// ───────────────────────────────────────────────────────────────────────────
// Per Appendix A + Doc 2:
// - Input: transformation + course_depth + delivery_format + chapter_audit
// - Output: course_title + module_map (4-7 modules) with outcomes
// - Hard rules: max 7 modules, each module has transformation outcome, no dup titles

import { z } from 'zod'

export const courseSkeletonRequestSchema = z.object({
  preferred_module_count: z.number().int().min(2).max(7).optional(),
  user_notes: z.string().max(1000).optional(),
})

export type CourseSkeletonRequest = z.infer<typeof courseSkeletonRequestSchema>

export const moduleMapEntrySchema = z.object({
  module_number: z.number().int().min(1),
  title: z.string().min(3).max(120),
  transformation: z.string().min(10).max(400),
  estimated_lessons: z.number().int().min(1).max(6),
  source_chapters: z.array(z.number().int()).min(0),
})

export type ModuleMapEntry = z.infer<typeof moduleMapEntrySchema>

export const courseSkeletonCreatorSchema = z.object({
  course_title: z.string().min(5).max(200),
  module_map: z.array(moduleMapEntrySchema).min(1).max(7),  // RULE_002
  total_modules: z.number().int().min(1).max(7),
  total_estimated_lessons: z.number().int().min(1),
  sequence_rationale: z.string().min(20).max(1000),
})

export type CourseSkeletonPayload = z.infer<typeof courseSkeletonCreatorSchema>
