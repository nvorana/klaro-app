// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Course Creator Agent Runtime
// ───────────────────────────────────────────────────────────────────────────
//
// Single shared agent shell. Loads step-specific prompt + schema from config.
// Does NOT self-approve output — the orchestrator handles pass/revise decisions.

import { openai, AI_MODEL } from '@/lib/openai'
import { loadPrompt } from './promptLoader'
import type { ZodType } from 'zod'

export interface CreatorInput {
  promptRef: string
  context: Record<string, unknown>
  userInputs?: Record<string, unknown>
  temperature?: number
  maxTokens?: number
}

export interface CreatorOutput<T> {
  draft: T
  prompt_version: string
  raw_response: string
}

/**
 * Runs the Creator agent with a step-specific prompt. Returns the parsed
 * draft + the prompt version used.
 *
 * Retry policy per Doc 5:
 * - retry once on HTTP 500/502/503/504, timeouts, service_unavailable
 * - retry 3x with exp backoff on HTTP 429
 * - no retry on 400/401/403/413, content policy, schema/enum/contract failures
 */
export async function runCreator<T>(
  input: CreatorInput,
  schema: ZodType<T>
): Promise<CreatorOutput<T>> {
  const { content: systemPrompt, version: promptVersion } = await loadPrompt(input.promptRef)

  // Build user message with context + user inputs
  const userMessage = buildUserMessage(input.context, input.userInputs)

  const completion = await callOpenAIWithRetry({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: input.temperature ?? 0.7,
    max_tokens: input.maxTokens ?? 2500,
  })

  const raw = completion.choices[0].message.content ?? '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Creator response is not valid JSON: ${raw.substring(0, 200)}`)
  }

  // Schema validation
  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `Creator output failed schema validation: ${JSON.stringify(result.error.issues).substring(0, 500)}`
    )
  }

  return {
    draft: result.data,
    prompt_version: promptVersion,
    raw_response: raw,
  }
}

function buildUserMessage(
  context: Record<string, unknown>,
  userInputs?: Record<string, unknown>
): string {
  const sections: string[] = []

  if (Object.keys(context).length > 0) {
    sections.push('APPROVED UPSTREAM CONTEXT (do not modify):')
    sections.push(JSON.stringify(context, null, 2))
  }

  if (userInputs && Object.keys(userInputs).length > 0) {
    sections.push('\nUSER INPUTS FOR THIS STEP:')
    sections.push(JSON.stringify(userInputs, null, 2))
  }

  return sections.join('\n')
}

// ─── Retry wrapper ────────────────────────────────────────────────────────

type ChatCompletionArgs = Parameters<typeof openai.chat.completions.create>[0]

async function callOpenAIWithRetry(args: ChatCompletionArgs) {
  let lastError: unknown = null

  // First attempt
  try {
    return await openai.chat.completions.create(args)
  } catch (err: unknown) {
    lastError = err
    const e = err as { status?: number; code?: string }

    const isTransient5xx = e?.status != null && e.status >= 500 && e.status <= 504
    const isTimeout = e?.code === 'ETIMEDOUT' || e?.code === 'ECONNRESET'
    const is429 = e?.status === 429

    // Don't retry terminal errors
    if (e?.status && [400, 401, 403, 413].includes(e.status)) throw err
    if (e?.code === 'content_policy_violation') throw err

    // Retry once for 5xx or timeout
    if (isTransient5xx || isTimeout) {
      try {
        return await openai.chat.completions.create(args)
      } catch (retryErr) {
        throw retryErr
      }
    }

    // Exponential backoff for 429 (up to 3 attempts)
    if (is429) {
      const delays = [1000, 2000, 4000]
      for (const delay of delays) {
        await new Promise(resolve => setTimeout(resolve, delay))
        try {
          return await openai.chat.completions.create(args)
        } catch (retryErr) {
          lastError = retryErr
        }
      }
      throw lastError
    }

    throw err
  }
}
