import OpenAI from 'openai'

// Cowork sets HTTPS_PROXY=http://localhost:3128 which blocks api.openai.com.
// Node.js 22's native fetch (undici) respects this env var, so we clear it
// before the OpenAI client is created. This runs once at module load time.
delete process.env.HTTPS_PROXY
delete process.env.https_proxy
delete process.env.HTTP_PROXY
delete process.env.http_proxy

// ── Provider selection ───────────────────────────────────────────────────────
// AI_PROVIDER = 'openai' (default) | 'openrouter'
//
// OpenRouter speaks the OpenAI Chat Completions wire format, so switching is
// just a baseURL + key swap. Model ids become namespaced: 'gpt-4o' on OpenAI
// is 'openai/gpt-4o' on OpenRouter, and you can point at anything they host
// (anthropic/claude-*, google/gemini-*, meta-llama/*, deepseek/* …).
//
// WHAT OPENROUTER DOES **NOT** SUPPORT — read before flipping this:
//   1. openai.responses.create()  — the Responses API is OpenAI-only.
//   2. Its hosted `web_search` tool — likewise OpenAI-only.
//   3. openai.embeddings.create() — not offered.
// The clarity route uses (1) and (2); module8 duplicate detection uses (3).
// Both therefore call `openaiDirect` below, which ALWAYS talks to OpenAI no
// matter what AI_PROVIDER says. Flipping the provider cannot silently break
// them — but it also means the clarity route (the single largest slice of
// spend) does not move to OpenRouter without first replacing its research
// step with a non-OpenAI search provider.
const PROVIDER = (process.env.AI_PROVIDER ?? 'openai').toLowerCase()
const USE_OPENROUTER = PROVIDER === 'openrouter'

if (USE_OPENROUTER && !process.env.OPENROUTER_API_KEY) {
  throw new Error('AI_PROVIDER=openrouter but OPENROUTER_API_KEY is not set')
}

/**
 * Chat client. Honours AI_PROVIDER, so every `openai.chat.completions.create`
 * call site follows the switch with no code change.
 */
export const openai = USE_OPENROUTER
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        // OpenRouter attribution — shows the app on their dashboard/leaderboards.
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://klaro.chillyonaryo.com',
        'X-Title': 'KLARO',
      },
    })
  : new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Always-OpenAI client. Use for capabilities OpenRouter does not implement:
 * the Responses API, hosted web_search, and embeddings. Never routed.
 */
export const openaiDirect = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/** True when chat traffic is going through OpenRouter. Handy for logging. */
export const isOpenRouter = USE_OPENROUTER

// ── Two-tier model config ────────────────────────────────────────────────────
// AI_MODEL (creative tier): student-facing prose where voice/Taglish register
// matters — ebooks, sales pages, emails, FB posts, clarity narratives.
// AI_MODEL_UTILITY: structured/judgment tasks with rigid JSON outputs where
// a cheap model is indistinguishable — validation scoring, objection lists,
// title/idea generation.
//
// Both are env-overridable so a model can be changed WITHOUT a code deploy —
// set AI_MODEL / AI_MODEL_UTILITY in Vercel and redeploy env only.
//
// Quality warning before switching the creative tier: the Taglish register
// targets in CLAUDE.md were calibrated specifically against gpt-4o (it lands
// ~85/15 against a 70/30 instruction, and that gap is load-bearing). Another
// model will sit somewhere else on that curve. Change AI_MODEL only alongside
// a re-read of real output, not on price alone.
const DEFAULT_CREATIVE = USE_OPENROUTER ? 'openai/gpt-4o'      : 'gpt-4o'
const DEFAULT_UTILITY  = USE_OPENROUTER ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'

export const AI_MODEL         = process.env.AI_MODEL         || DEFAULT_CREATIVE
export const AI_MODEL_UTILITY = process.env.AI_MODEL_UTILITY || DEFAULT_UTILITY

/** Embeddings always run on OpenAI (see openaiDirect). */
export const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small'

// ── Per-route overrides ──────────────────────────────────────────────────────
// Lets one expensive or quality-sensitive route move independently, without
// touching the rest. Set AI_MODEL_ROUTE_<ROUTE> with the route name uppercased
// and dashes as underscores:
//
//   AI_MODEL_ROUTE_CLARITY=openai/gpt-4o
//   AI_MODEL_ROUTE_EBOOK_AGENT=anthropic/claude-sonnet-4
//   AI_MODEL_ROUTE_VALIDATE=google/gemini-2.0-flash
//
// Route names match what lib/aiUsage.ts already records, so the ai_usage table
// tells you exactly which routes are worth overriding — and afterwards, what
// the change did to tokens and cost.
export function modelForRoute(route: string, tier: 'creative' | 'utility' = 'creative'): string {
  const key = 'AI_MODEL_ROUTE_' + route.toUpperCase().replace(/-/g, '_')
  return process.env[key] || (tier === 'utility' ? AI_MODEL_UTILITY : AI_MODEL)
}
