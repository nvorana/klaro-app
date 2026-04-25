// Build lib/preferredVocabulary.ts from the top words discovered in
// r/Philippines + sister subs. Top 300 by frequency.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FREQ = join(__dirname, 'output', 'word-frequencies.json')
const OUT = join(__dirname, '..', '..', 'lib', 'preferredVocabulary.ts')

const TOP_N = 300

// Manual cleanup — words that pass all upstream filters but shouldn't make
// the final preferred list (politics, profanity, names, Tagalog homonyms,
// Reddit-specific noise, topic-specific corpus bias).
const DENYLIST = new Set([
  // Politics / news
  'government','political','military','armed','president','corruption','corrupt',
  'killed','propaganda','war','death','blood','state','public','law','tax','red',
  'win','power','filipinos','national','prices',
  // Profanity (we don't want AI swearing)
  'fuck','shit','hate','bobo','damn',
  // Tagalog leaks the dictionary missed
  'mong','ganda','doon','kang','bang','doon','bago','noon',
  // Proper nouns / names
  'sara','jan',
  // Reddit-specific
  'gif','comments','post','comment','members','thanks','thank',
  // Generic filler not worth promoting
  'amp','hehe','please','sorry','god','hello',
])

const freq = JSON.parse(readFileSync(FREQ, 'utf8'))
const top = Object.entries(freq)
  .filter(([w]) => !DENYLIST.has(w))
  .slice(0, TOP_N)

// Group into rough buckets for readability in the file. We don't strictly
// classify — just make the export skimmable.
const lines = []
lines.push('// ─── Preferred Vocabulary ─────────────────────────────────────────────────')
lines.push('// Top 300 English words used naturally by Filipinos on Reddit')
lines.push('// (r/Philippines, r/AskPH, r/CasualPH, r/buhaydigital, r/studentsph,')
lines.push('// r/adultingph, r/peyups). Sourced from ~8,900 conversational comments')
lines.push('// after stopword + Tagalog homonym + bot-comment filtering.')
lines.push('//')
lines.push('// Usage: feed this list into AI prompts as a soft preference — "Lean on')
lines.push('// natural conversational English. Your audience uses words like these."')
lines.push('// Gentler than the hard-banned list in bannedWords.ts.')
lines.push('')
lines.push('export const PREFERRED_VOCABULARY = [')
for (const [word, count] of top) {
  lines.push(`  ${JSON.stringify(word)}, // ${count}`)
}
lines.push(']')
lines.push('')
lines.push('// Builds a one-liner prompt fragment listing the top-N preferred words.')
lines.push('// Pass into system prompts as a soft style guide — NOT a hard rule.')
lines.push('// Audience-agnostic: this defines the WRITING REGISTER, not the audience.')
lines.push("// The audience itself comes from the user's clarity sentence (target_market)")
lines.push('// which is injected into prompts separately.')
lines.push('export function buildVocabularyHint(topN = 80): string {')
lines.push('  const words = PREFERRED_VOCABULARY.slice(0, topN).join(", ")')
lines.push('  return `WRITING REGISTER: Write in casual, conversational English the way')
lines.push('Filipinos actually talk day-to-day, with light natural Taglish warmth where')
lines.push('it fits. Lean on plain everyday words they really use, like: ${words}. Avoid')
lines.push('hype-style, marketing-speak, or academic English. Write the way a Filipino')
lines.push('friend would explain something over coffee — not the way ChatGPT writes.`')
lines.push('}')
lines.push('')

writeFileSync(OUT, lines.join('\n'))
console.log(`Wrote ${OUT}`)
console.log(`${TOP_N} words exported.`)
console.log(`\nTop 30 preview:\n${top.slice(0, 30).map(([w]) => w).join(', ')}`)
