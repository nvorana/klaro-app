// ─── Validator: Banned Words ──────────────────────────────────────────────────
// Wraps the existing findBannedWords() scanner so a chapter that slipped any
// hard/soft-banned words past the per-pass scan still gets caught at editor
// time. No LLM. Runs on every section independently so the issue message can
// pinpoint where the offender lives.

import { findBannedWords } from '../../bannedWords'
import type { AffectedSection, ChapterShape, Issue, ValidatorResult } from '../types'

export function validateBannedWords(chapter: ChapterShape): ValidatorResult {
  const started = Date.now()
  const issues: Issue[] = []

  const sections: Array<[AffectedSection, string]> = [
    ['preview', chapter.chapter_preview ?? ''],
    ['story_starter', chapter.story_starter ?? ''],
    ['core_lessons', chapter.core_lessons ?? ''],
    ['practical_steps', (chapter.practical_steps ?? [])
      .map(s => `${s.title ?? ''} ${s.description ?? ''}`)
      .join(' ')],
    ['quick_win', [
      chapter.quick_win?.title ?? '',
      chapter.quick_win?.description ?? '',
      (chapter.quick_win?.steps ?? []).join(' '),
    ].join(' ')],
  ]

  for (const [section, text] of sections) {
    if (!text.trim()) continue
    const found = findBannedWords(text)
    if (found.length > 0) {
      issues.push({
        validator: 'banned_words',
        severity: 'high',
        message: `Banned words found in ${section}: ${found.map(w => `"${w}"`).join(', ')}. Rewrite without these.`,
        affected_section: section,
      })
    }
  }

  return { ok: issues.length === 0, issues, elapsed_ms: Date.now() - started }
}
