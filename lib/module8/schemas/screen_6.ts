// ───────────────────────────────────────────────────────────────────────────
// Schema: Screen 6 — Break Modules Into Lessons
// ───────────────────────────────────────────────────────────────────────────
// Per Doc 2: "This should be done one module at a time, not all modules at once"
// - Request specifies which module_number to generate lessons for
// - Output: lessons for that ONE module (3-5 lessons)
// - Full lesson_map accumulates across calls

import { z } from 'zod'
import { ASSET_TYPES } from '../types'

// Request: which module are we generating lessons for?
export const lessonMapRequestSchema = z.object({
  module_number: z.number().int().min(1).max(7),
  user_notes: z.string().max(500).optional(),
})

export type LessonMapRequest = z.infer<typeof lessonMapRequestSchema>

export const lessonEntrySchema = z.object({
  lesson_number: z.number().int().min(1).max(6),
  title: z.string().min(5).max(150),
  outcome: z.string().min(10).max(400),
  action: z.string().min(5).max(400),  // what the student DOES
  recommended_asset_type: z.enum(ASSET_TYPES).optional(),
  estimated_length_minutes: z.number().int().min(5).max(120).optional(),
})

export type LessonEntry = z.infer<typeof lessonEntrySchema>

// Creator returns lessons for ONE module
export const lessonMapCreatorSchema = z.object({
  module_number: z.number().int().min(1).max(7),
  module_title: z.string().min(1),
  lessons: z.array(lessonEntrySchema).min(2).max(6),  // RULE_003
})

export type LessonMapModulePayload = z.infer<typeof lessonMapCreatorSchema>

// ── Accumulated payload stored in step_outputs across incremental generations
export const lessonMapFullPayloadSchema = z.object({
  // Indexed by module_number. As user generates lessons per module, this grows.
  lesson_map: z.array(lessonMapCreatorSchema),
  complete: z.boolean(),  // true when all modules from module_map have lessons
})

export type LessonMapFullPayload = z.infer<typeof lessonMapFullPayloadSchema>
