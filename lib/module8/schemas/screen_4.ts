// ───────────────────────────────────────────────────────────────────────────
// Schema: Screen 4 — Audit the E-book Before Turning It Into a Course
// ───────────────────────────────────────────────────────────────────────────
// Per Appendix A + Doc 2:
// - Input: list of ebook chapters from Module 2
// - Output: chapter_audit array with structural_verdict + support_needs
//   (closed lists, multi-select for support_needs)

import { z } from 'zod'
import { STRUCTURAL_VERDICTS, SUPPORT_NEEDS } from '../types'

// Optional user overrides per chapter
export const chapterAuditRequestSchema = z.object({
  user_overrides: z.record(
    z.string(),  // chapter_id as string key
    z.object({
      structural_verdict: z.enum(STRUCTURAL_VERDICTS).optional(),
      support_needs: z.array(z.enum(SUPPORT_NEEDS)).optional(),
      note: z.string().max(500).optional(),
    })
  ).optional(),
})

export type ChapterAuditRequest = z.infer<typeof chapterAuditRequestSchema>

// Per-chapter audit entry
export const chapterAuditEntrySchema = z.object({
  source_chapter_id: z.number().int(),
  chapter_title: z.string().min(1),
  structural_verdict: z.enum(STRUCTURAL_VERDICTS),
  support_needs: z.array(z.enum(SUPPORT_NEEDS)).min(1),
  rationale: z.string().min(10).max(500),
})

export type ChapterAuditEntry = z.infer<typeof chapterAuditEntrySchema>

// Full Creator output
export const chapterAuditCreatorSchema = z.object({
  chapter_audit: z.array(chapterAuditEntrySchema).min(1),
  summary: z.object({
    KEEP:   z.number().int().min(0),
    EXPAND: z.number().int().min(0),
    MERGE:  z.number().int().min(0),
    SPLIT:  z.number().int().min(0),
    ADAPT:  z.number().int().min(0),
    MOVE:   z.number().int().min(0),
    REMOVE: z.number().int().min(0),
  }),
})

export type ChapterAuditPayload = z.infer<typeof chapterAuditCreatorSchema>
