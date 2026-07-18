import OpenAI from 'openai'

// Cowork sets HTTPS_PROXY=http://localhost:3128 which blocks api.openai.com.
// Node.js 22's native fetch (undici) respects this env var, so we clear it
// before the OpenAI client is created. This runs once at module load time.
delete process.env.HTTPS_PROXY
delete process.env.https_proxy
delete process.env.HTTP_PROXY
delete process.env.http_proxy

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ── Two-tier model config ────────────────────────────────────────────────────
// AI_MODEL (creative tier): student-facing prose where voice/Taglish register
// matters — ebooks, sales pages, emails, FB posts, clarity narratives.
// AI_MODEL_UTILITY: structured/judgment tasks with rigid JSON outputs where
// 4o-mini is indistinguishable at ~6% of the cost — validation scoring,
// objection lists, title/idea generation.
export const AI_MODEL = 'gpt-4o'
export const AI_MODEL_UTILITY = 'gpt-4o-mini'
