// ─── OpenAI usage logging ────────────────────────────────────────────────────
//
// One row per OpenAI call, written fire-and-forget via the admin client
// (ai_usage table is RLS-locked to service role). Never throws — a logging
// failure must not break generation.
//
// Usage in a generate route, right after the completion resolves:
//
//   logAiUsage({ userId: auth.user.id, route: 'clarity', model: AI_MODEL, usage: completion.usage })

import { createAdminClient } from '@/lib/supabase/admin'

export function logAiUsage(params: {
  userId: string | null
  route: string
  model: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
}): void {
  try {
    const admin = createAdminClient()
    void admin
      .from('ai_usage')
      .insert({
        user_id: params.userId,
        route: params.route,
        model: params.model,
        prompt_tokens: params.usage?.prompt_tokens ?? null,
        completion_tokens: params.usage?.completion_tokens ?? null,
        total_tokens: params.usage?.total_tokens ?? null,
      })
      .then(({ error }) => {
        if (error) console.error('[aiUsage] insert failed:', error.message)
      })
  } catch (err) {
    console.error('[aiUsage] logging error:', err)
  }
}
