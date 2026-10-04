// ─── Module 1: "find the biggest problems" ───────────────────────────────────
//
// Two stages, run as two separate requests so each gets its own function-time
// budget (Sol alone can take 2-3 minutes):
//
//   1. streamProblemsReport()  gpt-5.6-sol + web search writes a full market
//      analysis of the top 10 problems, searching problem by problem as it
//      goes. Streamed, so the UI can show real progress: each search, and
//      each problem as the model starts writing it.
//   2. extractProblemCards()   turns that analysis into the pick-a-card JSON.
//
// History (2026-10-04): this replaced a research → brainstorm → narrative →
// extract pipeline. Jon's benchmark was a ChatGPT (GPT-5.6 Sol) answer from a
// live workshop. Its edge came from judging each problem as a PAID ebook,
// grouping symptoms into one sellable problem, finding evidence per problem
// (actual peso prices, recent posts, official warnings), and saying plainly
// when a problem makes a weak ebook. A single model that searches while it
// writes reproduced that; one general search done up front did not.

import { openai, openaiDirect, modelForRoute, samplingParams } from '@/lib/openai'
import { logAiUsage } from '@/lib/aiUsage'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'

// Hard-pinned OpenAI id: openaiDirect never routes through OpenRouter, and the
// Responses API + hosted web_search only exist on OpenAI.
export const REPORT_MODEL = process.env.AI_RESEARCH_MODEL || 'gpt-5.6-sol'

// Structuring only. Terra wrote the clearest one-line problem statements in
// the 2026-10-04 comparison, and that line becomes the student's core_problem.
const CARDS_MODEL = modelForRoute('clarity-cards', 'creative', 'gpt-5.6-terra')

// Leaves headroom inside the route's 300s maxDuration. Sol at low effort ran
// 137-191s for "dog owner in the Philippines".
const REPORT_TIMEOUT_MS = 270_000

export const PROBLEM_COUNT = 10

function reportPrompt(targetMarket: string): string {
  return `I'd like to create an e-book that helps ${targetMarket}.

Help me find the biggest and most urgent problems this market has, with the highest demand for solutions. Provide the top ${PROBLEM_COUNT} specific and detailed problems and frustrations they face, ranked by urgency and demand for a solution. Give detailed insights into each one and why they'd want it solved immediately.

Look at this through one lens: which problem could become a strong PAID e-book for this market? Not just "what problems exist".

HOW TO WORK
- Start from what you know about this market's day-to-day life in the Philippines. Then search the web to check and sharpen EACH problem: recent posts and complaints, what people already spend on (products, services, prices in pesos), and recent Philippine news or official guidance that raises the stakes. Search problem by problem, for specific things. Not one general search.
- Group related symptoms into one problem when they share a root cause and one e-book could solve them together. Each problem must still be specific enough to hurt.
- Only include problems people in this market personally experience. Not problems other people have with them, and not public or policy issues.
- Be honest about weak candidates. If the information is freely available from official sources, or an e-book can't really fix it, say so and rank it lower.

FORMAT: use exactly these headings, in this order, so the app can follow along.

## Problem 1: <the problem in plain words>
### What it looks like day to day
5 to 10 concrete signs or situations, as bullets
### The real question in their words
Their actual question, in natural Taglish
### Why they want it solved now
The emotional and money pressure
### Evidence of demand
What people are already doing and spending, with the specifics you found (peso amounts, products, recent posts, official warnings) and the source. Never invent numbers, names, or quotes.
### What they usually try now
What people do today to fix it, and why it isn't working
### The outcome they want
One sentence
### E-book angle
A working title, and how to position it (including safety positioning when health or money is involved)
### Scores
Demand, urgency, and e-book potential, each 1 to 5, with one line of reasoning

…and the same for ## Problem 2 through ## Problem ${PROBLEM_COUNT}. Then finish with:

## My #1 recommendation
Which problem, and why.

Write in plain, conversational English. Use Taglish where it carries the market's own voice: their questions, quotes, emotional beats. No em dashes. No apostrophes on shortened Tagalog words (yan, yung, di, wag, to). No hype words (unlock, unleash, discover, transform, game-changing, ultimate).`
}

// ── Stage 1: the streamed report ─────────────────────────────────────────────

export type ReportEvent =
  | { type: 'search'; count: number; query?: string }
  | { type: 'problem'; index: number; title: string }
  | { type: 'progress'; chars: number }
  | { type: 'done'; report: string }

const HEADING_RE = /^## Problem (\d+):\s*(.+)$/gm

export async function* streamProblemsReport(
  targetMarket: string,
  userId: string | null,
  outerSignal?: AbortSignal,
): AsyncGenerator<ReportEvent> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS)
  outerSignal?.addEventListener('abort', () => controller.abort())

  try {
    const stream = await openaiDirect.responses.create(
      {
        model: REPORT_MODEL,
        // Low effort: medium took ~245s for the same quality of report.
        reasoning: { effort: 'low' },
        tools: [{ type: 'web_search' }],
        input: reportPrompt(targetMarket),
        stream: true,
      },
      { signal: controller.signal },
    )

    let text = ''
    let searches = 0
    let lastHeading = 0
    let lastProgressAt = 0

    for await (const ev of stream) {
      if (ev.type === 'response.output_item.done' && ev.item.type === 'web_search_call') {
        searches++
        const action = (ev.item as { action?: { query?: string } }).action
        yield { type: 'search', count: searches, query: action?.query }
      } else if (ev.type === 'response.output_text.delta') {
        text += ev.delta
        // Announce a problem only once its heading line is complete.
        for (const m of text.matchAll(HEADING_RE)) {
          const index = Number(m[1])
          const lineEnd = (m.index ?? 0) + m[0].length
          if (index > lastHeading && text.length > lineEnd) {
            lastHeading = index
            yield { type: 'problem', index, title: m[2].trim() }
          }
        }
        if (text.length - lastProgressAt > 1500) {
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
    yield { type: 'done', report: text }
  } catch (err) {
    if (controller.signal.aborted && !outerSignal?.aborted) {
      throw new Error('The market analysis took too long. Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ── Stage 2: report → cards ──────────────────────────────────────────────────

export interface ProblemCard {
  rank: number
  problem: string
  real_question: string
  signs: string[]
  urgency: string
  proof_of_demand: string
  current_attempts: string
  sources: Array<{ title: string; url: string }>
  desired_outcome: string
  ebook_title: string
  ebook_positioning: string
  demand_score: number
  urgency_score: number
  ebook_potential: number
  score_reason: string
  // Older fields, derived in code so a browser still running the previous
  // page bundle keeps rendering its cards.
  willingness_to_pay: 'Low' | 'Medium' | 'High'
  ease_of_selling: 'Easy' | 'Moderate' | 'Hard'
  common_phrases: string
}

export interface ProblemCards {
  items: ProblemCard[]
  top_pick: { rank: number; reason: string } | null
}

const BANNED_RULE = `Never use: unlock, unleash, discover, transform your life, revolutionize, ultimate guide, game-changing, next-level, powerful secrets, tap into, harness, ignite, amplify, supercharge. Avoid: maximize, optimize, elevate, breakthrough, leverage.`

function cardsPrompt(targetMarket: string, report: string): string {
  return `Below is a market analysis of the top ${PROBLEM_COUNT} problems for "${targetMarket}". Turn it into JSON for the app's problem cards.

<analysis>
${report}
</analysis>

Return EXACTLY this shape:
{
  "top_pick_rank": <number of the problem the analysis recommends as #1>,
  "top_pick_reason": "1-2 sentences from the analysis on why it is the best e-book opportunity",
  "items": [
    {
      "rank": 1,
      "problem": "A plain statement of WHAT the problem is, max 12 words, that a reader understands at a glance. English or light Taglish. Pain, not topic. Not a quote. This line is saved as the student's core problem and reused by every later module, so it must make sense on its own.",
      "real_question": "The market's own question, word for word from the analysis, Taglish preserved",
      "signs": ["3 to 6 of the most telling signs, each under 12 words"],
      "urgency": "2-3 sentences: why they want it solved now",
      "proof_of_demand": "2-3 sentences: what they already do and spend. Keep every specific: peso amounts, product names, posts, official warnings.",
      "current_attempts": "One sentence: what people usually do right now to fix it",
      "sources": [{ "url": "https://... copied exactly from the analysis" }],
      "desired_outcome": "One sentence",
      "ebook_title": "The working title from the analysis",
      "ebook_positioning": "One sentence on how to position it",
      "demand_score": 1-5,
      "urgency_score": 1-5,
      "ebook_potential": 1-5,
      "score_reason": "One sentence"
    }
  ]
}

RULES
1. Use ONLY what the analysis says. Do not add facts, numbers, names, quotes, or URLs.
2. sources: at most 3, and only URLs that appear in the analysis. Empty array if none.
3. Exactly ${PROBLEM_COUNT} items, in the analysis order.
4. No em dashes. No apostrophes on shortened Tagalog words (yan, yung, di, wag, to).
5. ${BANNED_RULE}`
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

const stripTracking = (url: string) => url.replace(/[?&]utm_source=openai\b/, '').replace(/\?$/, '')

// Label a source from its own URL, never from the model's title. In testing
// the cards pass paired "Talisay Pet Care Center" with a paws.org.ph link;
// a student checking evidence would be misled by that.
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

// Only keep links that actually appear in Sol's report (the cards pass must
// not invent or alter URLs), deduped, max 3.
function cleanSources(v: unknown, report: string): Array<{ title: string; url: string }> {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: Array<{ title: string; url: string }> = []
  for (const s of v) {
    const url = stripTracking(str((s as { url?: unknown })?.url))
    if (!/^https?:\/\//.test(url) || seen.has(url) || !report.includes(url)) continue
    seen.add(url)
    out.push({ title: sourceLabel(url), url })
    if (out.length === 3) break
  }
  return out
}

export async function extractProblemCards(
  targetMarket: string,
  report: string,
  userId: string | null,
): Promise<ProblemCards> {
  const prompt = cardsPrompt(targetMarket, report)
  const res = await openai.chat.completions.create({
    model: CARDS_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    ...samplingParams(CARDS_MODEL, 0.3),
  })
  logAiUsage({ userId, route: 'clarity', model: CARDS_MODEL, usage: res.usage })
  let content = res.choices[0].message.content || '{}'

  const banned = findBannedWords(content)
  if (banned.length > 0) {
    const fix = await openai.chat.completions.create({
      model: CARDS_MODEL,
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content },
        { role: 'user', content: buildCorrectionPrompt(content, banned) },
      ],
      response_format: { type: 'json_object' },
      ...samplingParams(CARDS_MODEL, 0.3),
    })
    logAiUsage({ userId, route: 'clarity', model: CARDS_MODEL, usage: fix.usage })
    content = fix.choices[0].message.content || content
  }

  const parsed = enforceHouseStyle(JSON.parse(content)) as Record<string, unknown>
  const raw = Array.isArray(parsed.items) ? parsed.items : []

  const items: ProblemCard[] = raw.map((r, i): ProblemCard => {
    const it = r as Record<string, unknown>
    const demand = score(it.demand_score)
    const potential = score(it.ebook_potential)
    const realQuestion = str(it.real_question)
    return {
      rank: i + 1,
      problem: str(it.problem),
      real_question: realQuestion,
      signs: Array.isArray(it.signs) ? it.signs.map(str).filter(Boolean).slice(0, 6) : [],
      urgency: str(it.urgency),
      proof_of_demand: str(it.proof_of_demand),
      current_attempts: str(it.current_attempts),
      sources: cleanSources(it.sources, report),
      desired_outcome: str(it.desired_outcome),
      ebook_title: str(it.ebook_title),
      ebook_positioning: str(it.ebook_positioning),
      demand_score: demand,
      urgency_score: score(it.urgency_score),
      ebook_potential: potential,
      score_reason: str(it.score_reason),
      willingness_to_pay: demand >= 4 ? 'High' : demand === 3 ? 'Medium' : 'Low',
      ease_of_selling: potential >= 4 ? 'Easy' : potential === 3 ? 'Moderate' : 'Hard',
      common_phrases: realQuestion,
    }
  }).filter(it => it.problem)

  const pickRank = Number(parsed.top_pick_rank)
  const top_pick = Number.isInteger(pickRank) && pickRank >= 1 && pickRank <= items.length
    ? { rank: pickRank, reason: str(parsed.top_pick_reason) }
    : null

  return { items, top_pick }
}
