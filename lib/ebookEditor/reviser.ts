// ─── Reviser ──────────────────────────────────────────────────────────────────
// Single LLM call that takes a chapter and a list of issues, returns a
// corrected version. Preserves the JSON structure exactly — only the broken
// parts are rewritten.
//
// Returns null on any failure (invalid JSON, missing required fields, LLM
// error). The orchestrator falls back to the original chapter on null.

import { openai, AI_MODEL } from '../openai'
import { findBannedWords } from '../bannedWords'
import { getMarketLanguageHintForUser } from '../marketLanguage'
import type { ChapterShape, Issue } from './types'

const REVISER_SYSTEM = `You are an expert ebook editor for the Philippine digital products market. Your job is to fix specific issues in a chapter draft while preserving everything that's not broken.

WRITING RULES — same rules as the original generator:
- Write at an entry level for beginners. Be practical, specific, simple.
- WRITING REGISTER (strictly enforced): body content is ~70% English / ~30% Tagalog. The narrative prose, explanations, and instructions are written in English. Tagalog appears as warmth, internal thoughts, dialogue snippets, and short emotional beats — never as the carrying language. ✓ Right: "He caught his reflection. Lumolobo na talaga, he thought." ✗ Too heavy: "Si Mang Ramon ay tumitingin sa salamin..."
- VARY sentence length. Short punchy sentences after important points.
- BANNED WORDS — never use: unlock, unleash, discover, transform your life, revolutionize, ultimate guide, game-changing, next-level, powerful secrets, tap into, harness, ignite, amplify, supercharge, delve, realm, tapestry, testament, pivotal, robust, garner, foster, alignment, landscape, meticulous, multifaceted, nuanced, profound, holistic, comprehensive, streamline, empower, leverage.
- Preserve the JSON structure exactly. Same keys, same shape. Only modify what the issues call out.

Return valid JSON only. No markdown fences.`

export async function reviseChapter(
  chapter: ChapterShape,
  issues: Issue[],
  marketHint: string = ''
): Promise<ChapterShape | null> {
  if (issues.length === 0) return chapter

  const issuesList = issues.map(i => {
    const tag = i.affected_section ? `[${i.affected_section}] ` : ''
    return `- ${tag}${i.message}`
  }).join('\n')

  const userPrompt = `Fix the issues below in this chapter draft. Preserve the JSON structure exactly. Only modify the parts the issues call out — leave everything else identical.

ISSUES TO FIX:
${issuesList}

ORIGINAL CHAPTER (JSON):
${JSON.stringify(chapter, null, 2)}

Return the corrected chapter as valid JSON only — same keys, same shape. No explanations outside JSON.`

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: REVISER_SYSTEM + marketHint },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 4500,
    })

    const raw = completion.choices[0].message.content ?? ''
    let parsed: ChapterShape
    try {
      parsed = JSON.parse(raw) as ChapterShape
    } catch (parseErr) {
      console.error('[reviser] invalid JSON returned:', parseErr)
      return null
    }

    // Sanity check — required fields must still exist if they did originally.
    const missingField = (field: keyof ChapterShape) =>
      chapter[field] != null && parsed[field] == null
    for (const f of ['story_starter', 'core_lessons', 'practical_steps', 'quick_win'] as const) {
      if (missingField(f)) {
        console.warn(`[reviser] revised chapter dropped required field "${f}", returning null`)
        return null
      }
    }

    // Don't accept a revision that introduces NEW banned words.
    const fullRevised = JSON.stringify(parsed)
    const newBanned = findBannedWords(fullRevised)
    if (newBanned.length > 0) {
      const fullOriginal = JSON.stringify(chapter)
      const oldBanned = findBannedWords(fullOriginal)
      // If banned words count went UP, reject.
      if (newBanned.length > oldBanned.length) {
        console.warn('[reviser] revision introduced new banned words, returning null')
        return null
      }
    }

    return parsed
  } catch (err) {
    console.error('[reviser] LLM call failed:', err)
    return null
  }
}

// Helper to fetch the user's market-language hint without forcing every
// caller to import marketLanguage too. Returns empty string on any failure.
export async function getReviserMarketHint(): Promise<string> {
  try {
    return await getMarketLanguageHintForUser()
  } catch {
    return ''
  }
}
