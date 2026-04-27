// ─── Ebook Editor — Types ─────────────────────────────────────────────────────
// Module 2 chapter QC types. The editor reads an assembled standard chapter
// and decides whether it needs revision. Validators return ValidatorResult;
// the orchestrator returns EditedChapter with a debug-only EditReport.

export type Severity = 'low' | 'medium' | 'high'

export type AffectedSection =
  | 'preview'
  | 'quote'
  | 'story_starter'
  | 'core_lessons'
  | 'practical_steps'
  | 'quick_win'
  | 'overall'

export interface Issue {
  validator: string                   // 'register' | 'banned_words' | 'repetition' | 'length' | 'promise_delivery' | 'consistency' | 'quick_win_viability'
  severity: Severity
  message: string                     // human-readable; gets fed to the reviser
  affected_section?: AffectedSection
}

export interface ValidatorResult {
  ok: boolean                         // false if any flagged issues
  issues: Issue[]
  elapsed_ms: number
}

export interface EditReport {
  ran: boolean
  tier1_results: Record<string, ValidatorResult>
  tier2_results?: Record<string, ValidatorResult>
  reviser_ran: boolean
  reviser_succeeded?: boolean
  reviser_elapsed_ms?: number
  total_issues_found: number
  total_issues_remaining: number
  total_elapsed_ms: number
}

// Structural shape the editor needs to read. Compatible with the ChapterDraft
// interface inside ebook-agent/route.ts via TypeScript structural typing —
// we don't import ChapterDraft to keep lib free of app dependencies.
export interface ChapterShape {
  chapter_preview?: string
  quote?: { text: string; author: string }
  story_starter?: string
  core_lessons?: string
  practical_steps?: Array<{
    step_number?: number
    title?: string
    description?: string
    [key: string]: unknown
  }>
  quick_win?: {
    title?: string
    description?: string
    steps?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface EditContext {
  outline: { title: string; goal: string; quick_win_outcome?: string }
}

export interface EditedChapter {
  chapter: ChapterShape
  report: EditReport
}
