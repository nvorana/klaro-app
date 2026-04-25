// ─── Niche Market Language ────────────────────────────────────────────────────
// Captures the words and phrases the creator's target market actually uses.
// Generated once when the clarity sentence is finalized, then injected into
// every downstream module's prompt so all generated content (ebook, sales
// page, emails, lead magnet, FB posts, bonuses) speaks the same niche bubble.
//
// Auto-captured (no user confirmation). Lazy-backfills if missing.

import { openai, AI_MODEL } from './openai'
import { findBannedWords } from './bannedWords'
import { createClient } from './supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketLanguage {
  everyday_phrases: string[]   // English-primary day-to-day phrases with light Tagalog accents
  emotional_words: string[]    // feeling/struggle words — Tagalog density can run higher here
  world_references: string[]   // places, tools, routines, situations — almost all English
  jargon: string[]             // insider/professional terms — almost all English
}

interface ProjectContext {
  target_market: string
  problem: string
  mechanism: string
  clarity_sentence?: string
}

// ─── Generator ────────────────────────────────────────────────────────────────
// Single OpenAI call. Returns the full categorized language pack.

const SYSTEM_PROMPT = `You are a Filipino market researcher specializing in capturing the actual day-to-day language a specific niche audience uses for ENGLISH-PRIMARY content (with light Taglish warmth).

Your job is to produce a categorized language pack — the real words, phrases, slang, and references this exact group reaches for when they talk about their problem and their world — phrased the way they would appear inside English-primary writing aimed at this audience.

LANGUAGE REGISTER — strictly enforced:
- The audience reads CONTENT that is ~80% English and ~20% Tagalog, with Tagalog used as warmth and emotional accent — NOT as the main language.
- Light, casual Taglish only. NOT deep or formal Tagalog. If a Filipino-American reader couldn't follow it, it's too heavy.
- Phrases should sound like how someone bilingual actually talks in real life: an English sentence with one or two Tagalog words mixed in for warmth, or a short Tagalog phrase used as a stylistic punch inside otherwise English content.
- Per-bucket density (this matters):
  - everyday_phrases: ~80% English with light Tagalog accents. Example good: "yung pants ko hindi na kasya" or "I haven't lost weight in years." Example BAD (too heavy): "Sumosobra na ang taba ko sa katawan, hindi ko na alam ang gagawin."
  - emotional_words: ~50/50 is fine — feelings genuinely hit harder in mother tongue, so Tagalog density can run higher here. "frustrated", "nakakahiya", "pagod na pagod", "guilty pag kumain" are all welcome.
  - world_references: ~95% English. Place names, brands, tools, body-parts in clinical context — almost always English. (Mercury Drug, BP medication, fatty liver, Lazada.)
  - jargon: ~95% English. Medical, professional, hobby-insider terms. (BMI, pre-diabetic, intermittent fasting, uric acid.)

Other rules:
- Be SPECIFIC to this niche. Avoid generic Filipino phrases that ANY Filipino would say.
- Capture the WAY this group thinks and feels, not just topic words.
- Include real-world specifics: places they go, tools they use, routines they follow, situations they're in.
- NO hype words: unlock, unleash, transform, revolutionize, etc.
- NO formal English or marketing-speak.

Always return valid JSON only. No markdown fences, no explanations.`

const USER_PROMPT_TEMPLATE = (p: ProjectContext) => `Target market: ${p.target_market}
Problem they're solving: ${p.problem}
Solution being offered: ${p.mechanism}${p.clarity_sentence ? `\nClarity sentence: ${p.clarity_sentence}` : ''}

Produce a categorized language pack for this exact group. Aim for ~30 entries TOTAL across all four categories. The split between categories should fit the niche — some markets are jargon-heavy, others emotion-heavy.

Return this exact JSON shape:
{
  "everyday_phrases": ["~7-10 entries, ENGLISH-PRIMARY with light Tagalog accents — phrases as they'd appear inside 80/20 Taglish content"],
  "emotional_words": ["~6-8 feeling/struggle words — ~50/50 mix is fine since emotions hit harder in mother tongue"],
  "world_references": ["~7-10 specific places, tools, routines from THEIR world — almost all English"],
  "jargon": ["~5-8 insider/professional terms only this group would know — almost all English"]
}`

export async function generateMarketLanguage(project: ProjectContext): Promise<MarketLanguage> {
  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT_TEMPLATE(project) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_tokens: 1500,
  })

  const raw = completion.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw) as Partial<MarketLanguage>

  // Defensive normalization — ensure every category is an array.
  const language: MarketLanguage = {
    everyday_phrases: Array.isArray(parsed.everyday_phrases) ? parsed.everyday_phrases : [],
    emotional_words: Array.isArray(parsed.emotional_words) ? parsed.emotional_words : [],
    world_references: Array.isArray(parsed.world_references) ? parsed.world_references : [],
    jargon: Array.isArray(parsed.jargon) ? parsed.jargon : [],
  }

  // Drop any phrase that happens to contain a banned word (the model knows to
  // avoid them, but belt-and-suspenders).
  for (const key of Object.keys(language) as (keyof MarketLanguage)[]) {
    language[key] = language[key].filter(p => findBannedWords(p).length === 0)
  }

  return language
}

// ─── Hint builder ─────────────────────────────────────────────────────────────
// Append the result of this to any module's system prompt. The AI gets a
// labeled, categorized list it can reach for as it writes.

export function buildMarketLanguageHint(language: MarketLanguage | null | undefined): string {
  if (!language) return ''
  const { everyday_phrases, emotional_words, world_references, jargon } = language
  const total = (everyday_phrases?.length ?? 0)
    + (emotional_words?.length ?? 0)
    + (world_references?.length ?? 0)
    + (jargon?.length ?? 0)
  if (total === 0) return ''

  const sections: string[] = []
  if (everyday_phrases?.length) sections.push(`Everyday phrases: ${everyday_phrases.join(', ')}`)
  if (emotional_words?.length) sections.push(`Emotional / feeling words: ${emotional_words.join(', ')}`)
  if (world_references?.length) sections.push(`World references (their places, tools, routines): ${world_references.join(', ')}`)
  if (jargon?.length) sections.push(`Insider jargon: ${jargon.join(', ')}`)

  return `

MARKET LANGUAGE — these are the actual words and phrases your reader's exact niche uses every day. Weave them naturally into your writing where they fit. The reader should feel "this writer is in my world" — not because every phrase is forced in, but because the language doesn't sound generic. Reach for these BEFORE generic English equivalents.

Keep the OVERALL writing register English-primary (~80% English / ~20% Tagalog). Don't let these phrases shift your output into deep Tagalog — they're warmth and grounding, not the main language. Emotional moments can lean a bit more Tagalog because feelings hit harder in mother tongue; world-references and jargon stay almost entirely English.

${sections.join('\n')}
`
}

// ─── Get-or-create (lazy backfill) ────────────────────────────────────────────
// Called by every downstream module API route. Fetches market_language from
// clarity_sentences for this user; if missing, generates and persists it.

export async function getOrCreateMarketLanguage(
  supabase: SupabaseClient,
  userId: string,
): Promise<MarketLanguage | null> {
  const { data: row, error } = await supabase
    .from('clarity_sentences')
    .select('id, target_market, core_problem, unique_mechanism, full_sentence, market_language')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !row) return null

  // Already populated — return as-is.
  if (row.market_language && typeof row.market_language === 'object') {
    return row.market_language as MarketLanguage
  }

  // Lazy backfill — generate and persist.
  if (!row.target_market || !row.core_problem) return null

  try {
    const language = await generateMarketLanguage({
      target_market: row.target_market,
      problem: row.core_problem,
      mechanism: row.unique_mechanism ?? '',
      clarity_sentence: row.full_sentence ?? undefined,
    })
    await supabase
      .from('clarity_sentences')
      .update({ market_language: language })
      .eq('id', row.id)
    return language
  } catch (err) {
    // Don't break the calling module if language gen fails — fall back silently.
    console.error('[marketLanguage] generation failed:', err)
    return null
  }
}

// ─── One-shot helper for downstream module routes ─────────────────────────────
// Drop this single line into any content-generating API route:
//
//   const marketHint = await getMarketLanguageHintForUser()
//   // then append `marketHint` to your system prompt
//
// Reads the auth user from cookies, fetches (or lazy-generates) the language
// pack, and returns the prompt-ready hint string. Returns empty string on any
// failure so the calling route never breaks because of language injection.

export async function getMarketLanguageHintForUser(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''
    const language = await getOrCreateMarketLanguage(supabase, user.id)
    return buildMarketLanguageHint(language)
  } catch (err) {
    console.error('[marketLanguage] hint fetch failed:', err)
    return ''
  }
}
