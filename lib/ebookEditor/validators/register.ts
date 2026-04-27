// ─── Validator: Register ──────────────────────────────────────────────────────
// Counts the Taglish ratio of a chapter's narrative prose. Flags if the
// chapter drifts too Tagalog-heavy or too pure-English vs the project rule
// (target ~70% English, accept 55-90%).
//
// No LLM. Uses a bundled list of common Tagalog markers (particles, pronouns,
// etc.) — these are unambiguous and always Tagalog. We don't need a full
// English dictionary for a register check; counting Tagalog markers is enough
// to detect both extremes.

import type { ChapterShape, Issue, ValidatorResult } from '../types'

// Common Tagalog markers — particles, pronouns, demonstratives, modals.
// These are NEVER English. If a chunk of text has many of these, it's Tagalog.
const TAGALOG_MARKERS = new Set<string>([
  // Particles & connectives
  'ang', 'ng', 'sa', 'mga', 'na', 'pa', 'din', 'rin', 'lang', 'po', 'opo',
  'ay', 'at', 'pero', 'kasi', 'kaya', 'kahit', 'kapag', 'pag',
  'dahil', 'bilang', 'tungkol', 'hanggang', 'samantalang',
  // Pronouns
  'ako', 'ko', 'akin', 'mo', 'iyo', 'siya', 'sya', 'niya', 'nya', 'kanya', 'kaniya',
  'tayo', 'natin', 'atin', 'kami', 'namin', 'amin',
  'kayo', 'ninyo', 'inyo', 'sila', 'nila', 'kanila',
  // Demonstratives
  'ito', 'iyan', 'iyon', 'yan', 'yun', 'yong', 'yung',
  'nito', 'niyan', 'niyon', 'dito', 'diyan', 'doon', 'dyan', 'dun',
  // Question / wh-words
  'ano', 'sino', 'saan', 'kailan', 'paano', 'bakit', 'gaano', 'ilan',
  // Existence / possession
  'meron', 'mayroon', 'wala', 'walang',
  // Modals
  'pwede', 'puwede', 'dapat', 'gusto', 'ayaw', 'kailangan',
  'baka', 'siguro', 'talaga', 'sobra', 'sobrang', 'medyo', 'parang',
  'naman', 'tapos', 'sana', 'pala', 'nga', 'eh', 'aba', 'naku', 'tska', 'tsaka',
  // Negation / affirmation
  'oo', 'hindi', 'huwag', 'wag',
  // Common adjectives / states
  'maganda', 'mabuti', 'masama', 'malaki', 'maliit', 'mahirap', 'madali',
  // Family terms
  'tatay', 'nanay', 'kuya', 'ate', 'lola', 'lolo', 'tito', 'tita',
  'asawa', 'mister', 'misis', 'anak', 'pamilya',
  // Time
  'ngayon', 'kanina', 'mamaya', 'bukas', 'kahapon', 'noon', 'kagabi',
  // Other very common
  'lahat', 'iba', 'isa', 'lalo', 'mas', 'medyo',
  // Common verb roots / forms
  'kain', 'kumain', 'inom', 'tulog', 'bahay', 'trabaho', 'pera', 'oras',
  // Reactive interjections
  'grabe', 'sus', 'naks', 'haay',
])

// Tokenize text → lowercase words, strip punctuation, filter empties.
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z'\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)
}

// Count Tagalog markers in a token list. Doesn't need to catch ALL Tagalog —
// just enough to estimate density. Marker words are required grammatical
// glue in Tagalog, so prose without them is necessarily English-heavy.
function countTagalog(tokens: string[]): number {
  let n = 0
  for (const tok of tokens) {
    if (TAGALOG_MARKERS.has(tok)) n++
  }
  return n
}

// Threshold rules:
//   - <2% Tagalog markers → near-pure-English (warn: too English)
//   - >35% Tagalog markers → too Tagalog-heavy (high severity)
// Tagalog markers typically run ~10-15% of tokens in natural Taglish writing
// (since they're particles, they're frequent). Pure English will have <2%
// because hits like "at" (the particle) collide with the English word "at".
//
// Note: even the threshold for "too English" is loose — 2% allows for
// occasional Tagalog markers organically appearing in dialogue.

export function validateRegister(chapter: ChapterShape): ValidatorResult {
  const started = Date.now()
  const issues: Issue[] = []

  // Combine all narrative prose
  const story = chapter.story_starter ?? ''
  const lessons = chapter.core_lessons ?? ''
  const stepsText = (chapter.practical_steps ?? [])
    .map(s => `${s.title ?? ''} ${s.description ?? ''}`)
    .join(' ')
  const quickWinText = [
    chapter.quick_win?.title ?? '',
    chapter.quick_win?.description ?? '',
    (chapter.quick_win?.steps ?? []).join(' '),
  ].join(' ')

  const fullText = [story, lessons, stepsText, quickWinText].join(' ').trim()
  if (!fullText) {
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }

  const tokens = tokenize(fullText)
  if (tokens.length < 50) {
    // Too little text to make a register call. Skip.
    return { ok: true, issues: [], elapsed_ms: Date.now() - started }
  }

  const tagalogCount = countTagalog(tokens)
  const tagalogPct = (tagalogCount / tokens.length) * 100

  if (tagalogPct > 35) {
    issues.push({
      validator: 'register',
      severity: 'high',
      message: `Tagalog-heavy: roughly ${Math.round(tagalogPct)}% Tagalog markers (target ~30% Tagalog overall, this run is well over). Rewrite narrative prose in English; reserve Tagalog for dialogue and short emotional beats only.`,
      affected_section: 'overall',
    })
  } else if (tagalogPct < 2) {
    issues.push({
      validator: 'register',
      severity: 'medium',
      message: `Too English: only ~${tagalogPct.toFixed(1)}% Tagalog markers detected (target ~30% Tagalog warmth). Add natural Tagalog phrases inside dialogue and emotional beats — internal thoughts, exclamations, character speech.`,
      affected_section: 'overall',
    })
  }

  return {
    ok: issues.length === 0,
    issues,
    elapsed_ms: Date.now() - started,
  }
}
