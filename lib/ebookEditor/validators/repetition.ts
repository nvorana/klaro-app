// ─── Validator: Repetition ────────────────────────────────────────────────────
// Sentence-start n-gram analysis. If the same 3-word opener ("Imagine that...",
// "When you...", "Picture this...") appears 3+ times across the chapter, flag
// it. Catches the AI's habit of falling into a single rhythmic pattern.
//
// No LLM. Operates on story_starter + core_lessons only — that's where prose
// repetition matters most. Practical steps and quick-wins are short-form by
// design, so repetition there is usually intentional structure.

import type { ChapterShape, Issue, ValidatorResult } from '../types'

const OPENER_LENGTH = 3                // first N words of each sentence
const REPEAT_THRESHOLD = 3             // flag if same opener appears N+ times

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function getOpener(sentence: string, n: number): string {
  return sentence
    .toLowerCase()
    .split(/\s+/)
    .slice(0, n)
    .join(' ')
}

export function validateRepetition(chapter: ChapterShape): ValidatorResult {
  const started = Date.now()
  const issues: Issue[] = []

  const story = chapter.story_starter ?? ''
  const lessons = chapter.core_lessons ?? ''
  const fullText = `${story} ${lessons}`.trim()
  if (!fullText) {
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }

  const sentences = splitSentences(fullText)
  const counts = new Map<string, number>()

  for (const s of sentences) {
    const opener = getOpener(s, OPENER_LENGTH)
    if (opener.split(/\s+/).length < 2) continue   // skip very short sentences
    counts.set(opener, (counts.get(opener) ?? 0) + 1)
  }

  for (const [opener, count] of counts.entries()) {
    if (count >= REPEAT_THRESHOLD) {
      issues.push({
        validator: 'repetition',
        severity: count >= 5 ? 'high' : 'medium',
        message: `Sentence opener "${opener}…" used ${count} times across the chapter. Vary the openings — same rhythmic pattern signals AI-style writing.`,
        affected_section: 'overall',
      })
    }
  }

  return { ok: issues.length === 0, issues, elapsed_ms: Date.now() - started }
}
