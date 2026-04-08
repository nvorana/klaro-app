// ─── Banned Word List ─────────────────────────────────────────────────────────
// Words that make content sound AI-generated and out of touch with the
// Philippine market. Applied to all AI-generated content in KLARO.

export const HARD_BANNED = [
  'unlock',
  'unleash',
  'discover',
  'transform your life',
  'revolutionize',
  'ultimate guide',
  'game-changing',
  'next-level',
  'powerful secrets',
  'tap into',
  'harness',
  'ignite',
  'amplify',
  'supercharge',
]

export const SOFT_BANNED = [
  'maximize',
  'optimize',
  'elevate',
  'breakthrough',
]

const ALL_BANNED = [...HARD_BANNED, ...SOFT_BANNED]

// ─── Scanner ──────────────────────────────────────────────────────────────────
// Returns the list of banned words/phrases found in the given text.
// Case-insensitive, whole-word matching for single words,
// substring matching for multi-word phrases.

export function findBannedWords(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []

  for (const word of ALL_BANNED) {
    if (word.includes(' ')) {
      // Multi-word phrase — substring match
      if (lower.includes(word.toLowerCase())) {
        found.push(word)
      }
    } else {
      // Single word — whole-word boundary match
      const regex = new RegExp(`\\b${word}\\b`, 'i')
      if (regex.test(text)) {
        found.push(word)
      }
    }
  }

  return found
}

// ─── Correction prompt ────────────────────────────────────────────────────────
// Builds a follow-up prompt to send back to the AI when banned words are found.
// Preserves the original JSON structure — only rewrites the flagged words.

export function buildCorrectionPrompt(
  originalOutput: string,
  foundWords: string[]
): string {
  return `Your previous response contained the following banned words that must NEVER be used in KLARO content:

BANNED WORDS FOUND: ${foundWords.map(w => `"${w}"`).join(', ')}

These words make content sound AI-generated and disconnected from the Philippine market.

Please rewrite the content below, replacing every instance of those banned words with natural, conversational, market-native alternatives. Keep the EXACT same JSON structure and all other content unchanged — only fix the banned words.

ORIGINAL OUTPUT TO FIX:
${originalOutput}

Return the corrected version as valid JSON only. No explanations outside JSON. No markdown fences.`
}
