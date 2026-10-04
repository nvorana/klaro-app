// ─── Module 1: "find the biggest problems" ───────────────────────────────────
//
// One streamed call: gpt-5.6-sol + web search researches the market problem
// by problem and writes the 10 problem cards directly as JSON. Streamed so the
// UI can show real progress: each search, then each card as Sol writes it.
//
// History (2026-10-04):
// - Replaced a research → brainstorm → narrative → extract pipeline. Jon's
//   benchmark is a ChatGPT (GPT-5.6 Sol) answer from a live workshop. Its edge
//   came from judging each problem as a PAID ebook, grouping symptoms into one
//   sellable problem, finding evidence per problem (peso prices, recent posts,
//   official warnings), and saying plainly when a problem makes a weak ebook.
//   A model that searches while it writes reproduced that; one general search
//   done up front did not.
// - First version had Sol write a ~5,700-word analysis, then a second model
//   (Terra) turned it into cards: ~215s end to end. Writing only what the cards
//   show (~2,400 words) in one pass took ~88s with the same problems and real
//   evidence, at the cost of fewer peso figures per card. Jon chose one pass.

import { openai, openaiDirect, modelForRoute, samplingParams } from '@/lib/openai'
import { logAiUsage } from '@/lib/aiUsage'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'

// Hard-pinned OpenAI id: openaiDirect never routes through OpenRouter, and the
// Responses API + hosted web_search only exist on OpenAI.
export const REPORT_MODEL = process.env.AI_RESEARCH_MODEL || 'gpt-5.6-sol'

// Only used when Sol's cards contain banned words (rare): a quick rewrite.
const FIX_MODEL = modelForRoute('clarity-cards', 'creative', 'gpt-5.6-terra')

// Well inside the route's 300s maxDuration; one-pass runs took ~90-140s once
// the "how common is it" searches were added.
const REPORT_TIMEOUT_MS = 240_000

// OpenAI's priority tier was ~20s faster again in testing (69s vs 88s) at a
// higher per-token price. Off unless explicitly enabled.
const PRIORITY = process.env.AI_CLARITY_PRIORITY === 'true'

export const PROBLEM_COUNT = 10

function problemsPrompt(targetMarket: string): string {
  return `I'd like to create an e-book that helps ${targetMarket}.

Find the top ${PROBLEM_COUNT} problems this market has, judged on three things:
1. BIGGEST: how many people in this market have it
2. MOST URGENT: how badly they want it solved right now
3. HIGHEST DEMAND: how much they already spend, search, and ask for help with it
Rank by all three together. Look at it through one lens: which problem could become a strong PAID e-book for this market?

HOW TO WORK
- Start from what you know about this market's day-to-day life in the Philippines. Then search the web to sharpen EACH problem with specific evidence: how common it is (official figures, surveys, share of the market affected, how often it comes up in their communities), recent posts, what people already spend (products, services, prices in pesos), official warnings. Search problem by problem, for specific things. Not one general search.
- Group related symptoms into one problem when one e-book could solve them together. Each problem must still be specific enough to hurt.
- Only problems people in this market personally experience. Not problems other people have with them, and not public or policy issues.
- Be honest: if the information is freely available from official sources, or an e-book can't really fix it, score it lower.

Return ONLY JSON, no other text:
{
  "top_pick_rank": <rank of the strongest e-book opportunity>,
  "top_pick_reason": "1-2 sentences on why",
  "items": [
    {
      "rank": 1,
      "problem": "Name the problem the way people in THIS market say it when they ask for help: their everyday words for the specific thing going wrong, not an outsider's description of them. Lead with the concrete thing. Max 12 words. English or light Taglish. It is saved as the student's core problem and reused by every later module, so it must make sense on its own.",
      "real_question": "Their own question, in natural Taglish",
      "signs": ["4 to 6 concrete signs, each under 12 words"],
      "how_common": "1-2 sentences: how many people in this market have this problem, with the evidence you found (official figures, surveys, share affected, how often it comes up). If you found no hard number, say what the evidence suggests. Never invent numbers.",
      "urgency": "2 sentences: why they want it solved now (emotional and money pressure)",
      "proof_of_demand": "2-3 sentences of specific evidence you found. Include every peso amount, product, and recent post or official warning you found for this problem. Never invent numbers, names, or quotes.",
      "current_attempts": "1 sentence: what people do now, and why it isn't working",
      "sources": [{ "url": "the exact URL of a page you used for this problem" }],
      "desired_outcome": "1 sentence",
      "ebook_title": "A working title",
      "ebook_positioning": "1 sentence, including safety positioning when health or money is involved",
      "reach_score": <1 to 5, how many people in this market have it>,
      "demand_score": <1 to 5>,
      "urgency_score": <1 to 5>,
      "ebook_potential": <1 to 5>,
      "score_reason": "1 sentence"
    }
  ]
}

PROBLEM TITLES: plain conversational English, in the words this market actually uses for the problem: the concrete thing going wrong, the way they'd describe it to a friend. Keep a local term only where it is the word they really use. Save Taglish for real_question. The examples below are from other markets, to show the style only. Never reuse their wording.
✓ "Tomato plants keep dying in the summer heat"   ✗ "Gardeners face crop management challenges"
✓ "Suki keep buying on utang and never pay it back"   ✗ "Store owners struggle with receivables"
✓ "Cramming the night before, then blanking out during exams"   ✗ "Learners exhibit poor study habits"
Never start a title with the people themselves ("Owners...", "Parents...", "Employees...").

Exactly ${PROBLEM_COUNT} items, ranked. Scores are whole numbers from 1 to 5. Up to 3 sources per problem. Plain conversational English; Taglish only where it carries the market's own voice (real_question). No em dashes. No apostrophes on shortened Tagalog words (yan, yung, di, wag, to), but English contractions and possessives keep theirs (won't, can't, dog's). Never use: unlock, unleash, discover, transform, revolutionize, ultimate, game-changing, next-level, harness, ignite, amplify, supercharge.`
}

// ── Card shape ───────────────────────────────────────────────────────────────

export interface ProblemCard {
  rank: number
  problem: string
  real_question: string
  signs: string[]
  how_common: string
  urgency: string
  proof_of_demand: string
  current_attempts: string
  sources: Array<{ title: string; url: string }>
  desired_outcome: string
  ebook_title: string
  ebook_positioning: string
  reach_score: number
  demand_score: number
  urgency_score: number
  ebook_potential: number
  score_reason: string
  // Older fields, derived in code so a browser still running an earlier page
  // bundle keeps rendering its cards.
  willingness_to_pay: 'Low' | 'Medium' | 'High'
  ease_of_selling: 'Easy' | 'Moderate' | 'Hard'
  common_phrases: string
}

export interface ProblemCards {
  items: ProblemCard[]
  top_pick: { rank: number; reason: string } | null
}

// ── Streaming ────────────────────────────────────────────────────────────────

export type ProblemsEvent =
  | { type: 'search'; count: number; query?: string }
  | { type: 'problem'; index: number; title: string }
  | { type: 'progress'; chars: number }
  | { type: 'finalizing' }
  // `report` is the raw JSON text: lets a browser on the previous bundle (which
  // posts it back to step 'problems_cards') keep working.
  | { type: 'done'; cards: ProblemCards; report: string }

// A card is announced once its "problem" string has fully streamed in.
const PROBLEM_FIELD_RE = /"problem"\s*:\s*"((?:[^"\\]|\\.)*)"/g

export async function* streamProblemCards(
  targetMarket: string,
  userId: string | null,
  outerSignal?: AbortSignal,
): AsyncGenerator<ProblemsEvent> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS)
  outerSignal?.addEventListener('abort', () => controller.abort())

  try {
    const stream = await openaiDirect.responses.create(
      {
        model: REPORT_MODEL,
        // Low effort: medium took ~245s on the long-form version for no
        // visible quality gain.
        reasoning: { effort: 'low' },
        tools: [{ type: 'web_search' }],
        // The pages each search returned, so card sources can be checked
        // against what Sol actually saw.
        include: ['web_search_call.action.sources'],
        input: problemsPrompt(targetMarket),
        stream: true,
        ...(PRIORITY ? { service_tier: 'priority' as const } : {}),
      },
      { signal: controller.signal },
    )

    let text = ''
    let searches = 0
    let announced = 0
    let lastProgressAt = 0
    const seenUrls = new Set<string>()

    for await (const ev of stream) {
      if (ev.type === 'response.output_item.done' && ev.item.type === 'web_search_call') {
        searches++
        const action = (ev.item as { action?: { query?: string; sources?: Array<{ url?: string }> } }).action
        for (const s of action?.sources ?? []) if (s.url) seenUrls.add(normalizeUrl(s.url))
        yield { type: 'search', count: searches, query: action?.query }
      } else if (ev.type === 'response.output_text.delta') {
        text += ev.delta
        const matches = [...text.matchAll(PROBLEM_FIELD_RE)]
        while (announced < matches.length && announced < PROBLEM_COUNT) {
          const raw = matches[announced][1]
          announced++
          let title = raw
          try { title = JSON.parse(`"${raw}"`) } catch { /* keep raw */ }
          yield { type: 'problem', index: announced, title }
        }
        if (text.length - lastProgressAt > 600) {
          lastProgressAt = text.length
          yield { type: 'progress', chars: text.length }
        }
      } else if (ev.type === 'response.completed') {
        const u = ev.response.usage
        logAiUsage({
          userId,
          route: 'clarity',
          model: REPORT_MODEL,
          usage: u ? { prompt_tokens: u.input_tokens, completion_tokens: u.output_tokens, total_tokens: u.total_tokens } : null,
        })
      } else if (ev.type === 'response.failed' || ev.type === 'error') {
        throw new Error('The market analysis failed. Please try again.')
      }
    }

    if (!text.trim()) throw new Error('The market analysis came back empty. Please try again.')
    yield { type: 'finalizing' }
    const json = await fixBannedWords(sliceJson(text), userId)
    const cards = normalizeCards(JSON.parse(json), seenUrls)
    if (cards.items.length === 0) throw new Error('The market analysis came back incomplete. Please try again.')
    yield { type: 'done', cards, report: json }
  } catch (err) {
    if (controller.signal.aborted && !outerSignal?.aborted) {
      throw new Error('The market analysis took too long. Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * For a browser on the previous bundle, which posts the 'done' report back to
 * step 'problems_cards'. The text is already Sol's card JSON, so this only
 * re-normalizes it. Without the search results to check against, sources are
 * dropped rather than shown unchecked.
 */
export function cardsFromReportJson(report: string): ProblemCards {
  return normalizeCards(JSON.parse(sliceJson(report)), new Set())
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sliceJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('The market analysis came back in the wrong format. Please try again.')
  return text.slice(start, end + 1)
}

// Rare, but a banned word in a student-facing card is worth one quick rewrite.
async function fixBannedWords(json: string, userId: string | null): Promise<string> {
  const banned = findBannedWords(json)
  if (banned.length === 0) return json
  try {
    const res = await openai.chat.completions.create({
      model: FIX_MODEL,
      messages: [{ role: 'user', content: buildCorrectionPrompt(json, banned) }],
      response_format: { type: 'json_object' },
      ...samplingParams(FIX_MODEL, 0.3),
    })
    logAiUsage({ userId, route: 'clarity', model: FIX_MODEL, usage: res.usage })
    const fixed = res.choices[0].message.content
    if (fixed) { JSON.parse(fixed); return fixed }
  } catch (err) {
    console.warn('[clarity] banned-word fix failed, keeping original cards:', err)
  }
  return json
}

// gpt-5.x still emits em dashes and 'yan / 'yung often enough to matter, so
// both are enforced in code on every string the student will see.
export function enforceHouseStyle(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/\s*—\s*/g, ', ')
      .replace(/(^|[\s"(])[''](yan|yung|yun|di|wag|to|nung|pag)\b/gi, '$1$2')
  }
  if (Array.isArray(value)) return value.map(enforceHouseStyle)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, enforceHouseStyle(v)]))
  }
  return value
}

const score = (v: unknown): number => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3
}
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

// Compare URLs without tracking params, fragments, trailing slashes or "www.".
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    u.searchParams.delete('utm_source')
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    return `${host}${u.pathname.replace(/\/+$/, '')}${u.search}`
  } catch {
    return url
  }
}

// Label a source from its own URL, never from a model-written title: in
// testing a card paired "Talisay Pet Care Center" with a paws.org.ph link.
function sourceLabel(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const sub = u.pathname.match(/^\/r\/([^/]+)/)
    if (host.endsWith('reddit.com') && sub) return `Reddit r/${sub[1]}`
    return host
  } catch {
    return 'source'
  }
}

// Keep a link only if a web search actually returned that page. Reddit links
// may be cited with or without the title slug, so a prefix match on the same
// path counts.
function cleanSources(v: unknown, seenUrls: Set<string>): Array<{ title: string; url: string }> {
  if (!Array.isArray(v) || seenUrls.size === 0) return []
  const seen = Array.from(seenUrls)
  const out: Array<{ title: string; url: string }> = []
  const used = new Set<string>()
  for (const s of v) {
    const url = str((s as { url?: unknown })?.url).replace(/[?&]utm_source=openai\b/, '').replace(/\?$/, '')
    if (!/^https?:\/\//.test(url)) continue
    const n = normalizeUrl(url)
    if (used.has(n)) continue
    const verified = seenUrls.has(n) || seen.some(x => x.startsWith(n + '/') || n.startsWith(x + '/'))
    if (!verified) continue
    used.add(n)
    out.push({ title: sourceLabel(url), url })
    if (out.length === 3) break
  }
  return out
}

function normalizeCards(raw: unknown, seenUrls: Set<string>): ProblemCards {
  const parsed = enforceHouseStyle(raw) as Record<string, unknown>
  const list = Array.isArray(parsed.items) ? parsed.items : []

  const items: ProblemCard[] = list.map((r, i): ProblemCard => {
    const it = r as Record<string, unknown>
    const demand = score(it.demand_score)
    const potential = score(it.ebook_potential)
    const realQuestion = str(it.real_question)
    return {
      rank: i + 1,
      problem: str(it.problem),
      real_question: realQuestion,
      signs: Array.isArray(it.signs) ? it.signs.map(str).filter(Boolean).slice(0, 6) : [],
      how_common: str(it.how_common),
      urgency: str(it.urgency),
      proof_of_demand: str(it.proof_of_demand),
      current_attempts: str(it.current_attempts),
      sources: cleanSources(it.sources, seenUrls),
      desired_outcome: str(it.desired_outcome),
      ebook_title: str(it.ebook_title),
      ebook_positioning: str(it.ebook_positioning),
      reach_score: score(it.reach_score),
      demand_score: demand,
      urgency_score: score(it.urgency_score),
      ebook_potential: potential,
      score_reason: str(it.score_reason),
      willingness_to_pay: demand >= 4 ? 'High' : demand === 3 ? 'Medium' : 'Low',
      ease_of_selling: potential >= 4 ? 'Easy' : potential === 3 ? 'Moderate' : 'Hard',
      common_phrases: realQuestion,
    }
  }).filter(it => it.problem).slice(0, PROBLEM_COUNT)

  const pickRank = Number(parsed.top_pick_rank)
  const top_pick = Number.isInteger(pickRank) && pickRank >= 1 && pickRank <= items.length
    ? { rank: pickRank, reason: str(parsed.top_pick_reason) }
    : null

  return { items, top_pick }
}
