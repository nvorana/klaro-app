// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Shared Validator Runtime
// ───────────────────────────────────────────────────────────────────────────
//
// One validator runner for all 3 validators. Loads step-specific prompt,
// runs against the draft, parses + validates the response.

import { openai, AI_MODEL } from '@/lib/openai'
import { loadPrompt } from '../promptLoader'
import { validatorResponseSchema, ValidatorResponse } from '../schemas/validator_response'
import type { ValidatorName } from '../types'

export interface ValidatorRunInput {
  validatorName: ValidatorName
  draft: Record<string, unknown>
  upstreamContext: Record<string, unknown>
  screenId: number
  screenName: string
  stepRubric?: string  // optional additional guidance
  hardRuleFailureSummary?: string
}

export interface ValidatorRunResult {
  validator_name: ValidatorName
  response: ValidatorResponse
  prompt_version: string
  raw_response: string
}

export async function runValidator(input: ValidatorRunInput): Promise<ValidatorRunResult> {
  const { content: systemPrompt, version: promptVersion } = await loadPrompt(
    `module8/validators/${input.validatorName}`
  )

  const userMessage = buildValidatorUserMessage(input)

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,  // low temperature — validators should be consistent
    max_tokens: 1500,
  })

  const raw = completion.choices[0].message.content ?? '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${input.validatorName} validator returned invalid JSON: ${raw.substring(0, 200)}`)
  }

  const result = validatorResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `${input.validatorName} validator response failed schema: ${JSON.stringify(result.error.issues).substring(0, 400)}`
    )
  }

  return {
    validator_name: input.validatorName,
    response: result.data,
    prompt_version: promptVersion,
    raw_response: raw,
  }
}

function buildValidatorUserMessage(input: ValidatorRunInput): string {
  const sections: string[] = []

  sections.push(`SCREEN: ${input.screenId} — ${input.screenName}`)

  if (Object.keys(input.upstreamContext).length > 0) {
    sections.push('\nAPPROVED UPSTREAM CONTEXT:')
    sections.push(JSON.stringify(input.upstreamContext, null, 2))
  }

  sections.push('\nCURRENT DRAFT TO REVIEW:')
  sections.push(JSON.stringify(input.draft, null, 2))

  if (input.hardRuleFailureSummary) {
    sections.push('\nHARD RULE FAILURES ALREADY DETECTED (for your context):')
    sections.push(input.hardRuleFailureSummary)
  }

  if (input.stepRubric) {
    sections.push('\nSTEP-SPECIFIC RUBRIC:')
    sections.push(input.stepRubric)
  }

  return sections.join('\n')
}
