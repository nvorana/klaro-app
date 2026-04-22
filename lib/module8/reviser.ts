// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Revision Agent Runtime
// ───────────────────────────────────────────────────────────────────────────
//
// Per Doc 4/5:
// - Receives writable_fields, read_only_context, validator_notes, hard_rule_failures
// - Must only modify writable fields
// - Any changes to read_only_context are stripped before merge
// - Output is merged with the existing draft — only writable-field changes accepted
//
// The "drift check" (Phase 4) runs after revision to verify the read-only
// context wasn't tampered with.

import { openai, AI_MODEL } from '@/lib/openai'
import { loadPrompt } from './promptLoader'
import type { ValidatorRunResult } from './validators/base'
import type { HardRuleFailure } from './qc/hardRules'
import { canonicalHash } from './hash'
import type { ZodType } from 'zod'

export interface ReviserInput<T> {
  sourceDraft: T
  writableFields: string[]
  readOnlyContext: Record<string, unknown>
  validatorResults: ValidatorRunResult[]
  hardRuleFailures: HardRuleFailure[]
  schema: ZodType<T>
}

export interface ReviserOutput<T> {
  revised_draft: T
  prompt_version: string
  read_only_context_hash: string
  merge_result: {
    fields_changed: string[]
    fields_stripped: string[]  // fields the reviser tried to change but couldn't
  }
}

export async function runReviser<T extends Record<string, unknown>>(
  input: ReviserInput<T>
): Promise<ReviserOutput<T>> {
  const { content: systemPrompt, version: promptVersion } = await loadPrompt('module8/reviser/default')

  const userMessage = buildReviserMessage(input)

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,  // lower temperature — reviser should be precise
    max_tokens: 3500,
  })

  const raw = completion.choices[0].message.content ?? '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Reviser returned invalid JSON: ${raw.substring(0, 200)}`)
  }

  const schemaResult = input.schema.safeParse(parsed)
  if (!schemaResult.success) {
    throw new Error(
      `Reviser output failed schema: ${JSON.stringify(schemaResult.error.issues).substring(0, 400)}`
    )
  }

  // ── Enforce writable-fields-only merge ───────────────────────────────
  const { merged, fieldsChanged, fieldsStripped } = mergeWritableFieldsOnly(
    input.sourceDraft,
    schemaResult.data as Record<string, unknown>,
    input.writableFields
  )

  // Canonical hash of the read-only context (for audit trail)
  const roHash = canonicalHash(input.readOnlyContext)

  return {
    revised_draft: merged as T,
    prompt_version: promptVersion,
    read_only_context_hash: roHash,
    merge_result: {
      fields_changed: fieldsChanged,
      fields_stripped: fieldsStripped,
    },
  }
}

// ─── Merge helper: only writable fields can change ───────────────────────

function mergeWritableFieldsOnly<T extends Record<string, unknown>>(
  source: T,
  revision: Record<string, unknown>,
  writableFields: string[]
): { merged: T; fieldsChanged: string[]; fieldsStripped: string[] } {
  const writableSet = new Set(writableFields)
  const merged = { ...source } as Record<string, unknown>
  const fieldsChanged: string[] = []
  const fieldsStripped: string[] = []

  for (const key of Object.keys(revision)) {
    const sourceVal = source[key]
    const newVal = revision[key]
    const different = JSON.stringify(sourceVal) !== JSON.stringify(newVal)

    if (!different) continue

    if (writableSet.has(key)) {
      merged[key] = newVal
      fieldsChanged.push(key)
    } else {
      // Reviser tried to change a read-only field. Strip it.
      fieldsStripped.push(key)
    }
  }

  return { merged: merged as T, fieldsChanged, fieldsStripped }
}

// ─── User-facing message builder ─────────────────────────────────────────

function buildReviserMessage<T>(input: ReviserInput<T>): string {
  const sections: string[] = []

  sections.push('SOURCE DRAFT (to be revised):')
  sections.push(JSON.stringify(input.sourceDraft, null, 2))

  sections.push('\nWRITABLE FIELDS (only these may change):')
  sections.push(JSON.stringify(input.writableFields))

  sections.push('\nREAD-ONLY CONTEXT (MUST NOT CHANGE — any changes will be stripped):')
  sections.push(JSON.stringify(input.readOnlyContext, null, 2))

  if (input.hardRuleFailures.length > 0) {
    sections.push('\nHARD RULE FAILURES (must be fixed):')
    for (const f of input.hardRuleFailures) {
      sections.push(`- [${f.rule_id}] ${f.message}`)
    }
  }

  if (input.validatorResults.length > 0) {
    sections.push('\nVALIDATOR ISSUES & SUGGESTED FIXES:')
    for (const v of input.validatorResults) {
      const issues = v.response.top_issues ?? []
      const fixes = v.response.suggested_fixes ?? []
      if (issues.length === 0 && fixes.length === 0) continue
      sections.push(`\n${v.validator_name} (score ${v.response.overall_score}/10):`)
      for (const issue of issues) sections.push(`  ISSUE: ${issue}`)
      for (const fix of fixes) sections.push(`  FIX: ${fix}`)
    }
  }

  sections.push('\nReturn the revised JSON matching the source draft structure. Only writable fields should differ.')

  return sections.join('\n')
}
