// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Parallel Validator Runner
// ───────────────────────────────────────────────────────────────────────────

import { runValidator, ValidatorRunInput, ValidatorRunResult } from './base'
import type { ValidatorName } from '../types'

export interface ValidatorRunBatch {
  screenId: number
  screenName: string
  draft: Record<string, unknown>
  upstreamContext: Record<string, unknown>
  validators: ValidatorName[]
  hardRuleFailureSummary?: string
}

export interface ValidatorBatchResult {
  results: ValidatorRunResult[]
  errors: { validator: ValidatorName; error: string }[]
}

/**
 * Runs all assigned validators in parallel.
 * Per Doc 5: if any validator fails to return, retry once; if still failing,
 * surface the error so the orchestrator can escalate.
 */
export async function runValidatorsParallel(
  batch: ValidatorRunBatch
): Promise<ValidatorBatchResult> {
  const runs = await Promise.allSettled(
    batch.validators.map(async (name) => {
      const input: ValidatorRunInput = {
        validatorName: name,
        draft: batch.draft,
        upstreamContext: batch.upstreamContext,
        screenId: batch.screenId,
        screenName: batch.screenName,
        hardRuleFailureSummary: batch.hardRuleFailureSummary,
      }

      try {
        return await runValidator(input)
      } catch (err) {
        // Retry once per Doc 5 retry policy
        console.warn(`[Module 8 validator ${name}] First attempt failed, retrying…`, err)
        return await runValidator(input)
      }
    })
  )

  const results: ValidatorRunResult[] = []
  const errors: { validator: ValidatorName; error: string }[] = []

  for (const [i, run] of runs.entries()) {
    if (run.status === 'fulfilled') {
      results.push(run.value)
    } else {
      errors.push({
        validator: batch.validators[i],
        error: run.reason instanceof Error ? run.reason.message : String(run.reason),
      })
    }
  }

  return { results, errors }
}
