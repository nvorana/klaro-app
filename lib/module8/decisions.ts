// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Decision Engine
// ───────────────────────────────────────────────────────────────────────────
//
// Aggregates hard rule results + validator scores into one of 4 canonical
// decisions: pass | revise | escalate | blocked_by_rule.
//
// Per Doc 3 + Doc 5:
// - If any hard rule failed → blocked_by_rule
// - If any validator returned score < 6.0 → cannot pass directly
// - If weighted average >= 8.0 and no critical failure → pass
// - If weighted average in [7.0, 7.9] → revise
// - If revision cap reached → escalate
// - If validators disagree strongly → escalate

import {
  CRITICAL_FAILURE_BELOW,
  DIRECT_PASS_WEIGHTED_AVERAGE,
  REVISE_BAND_MIN,
  REVISE_BAND_MAX,
  type DecisionState,
  type ValidatorName,
} from './types'
import { getEffectiveWeights, type ScreenConfig } from './config'
import type { ValidatorRunResult } from './validators/base'
import type { HardRuleFailure } from './qc/hardRules'
import type { DuplicateFlag } from './qc/duplicateDetection'

export interface DecisionInput {
  config: ScreenConfig
  validatorResults: ValidatorRunResult[]
  validatorErrors: { validator: ValidatorName; error: string }[]
  hardRuleFailures: HardRuleFailure[]
  duplicateFlags: DuplicateFlag[]
  revisionCount: number
}

export interface DecisionResult {
  decision: DecisionState
  reason: string
  weighted_average: number | null
  critical_failures: number  // count of validators < 6.0
  validator_scores: { name: ValidatorName; score: number; recommendation: string }[]
  hard_rule_failure_count: number
  duplicate_count: number
}

export function decideOutcome(input: DecisionInput): DecisionResult {
  const { config, validatorResults, validatorErrors, hardRuleFailures, duplicateFlags, revisionCount } = input

  // ── If any validator failed to respond, escalate ──────────────────
  if (validatorErrors.length > 0) {
    return {
      decision: 'escalate',
      reason: `Validator(s) failed to respond: ${validatorErrors.map(e => e.validator).join(', ')}`,
      weighted_average: null,
      critical_failures: 0,
      validator_scores: validatorResults.map(r => ({
        name: r.validator_name,
        score: r.response.overall_score,
        recommendation: r.response.pass_recommendation,
      })),
      hard_rule_failure_count: hardRuleFailures.length,
      duplicate_count: duplicateFlags.length,
    }
  }

  // ── Hard rule failures block progression ──────────────────────────
  if (hardRuleFailures.length > 0 || duplicateFlags.length > 0) {
    return {
      decision: 'blocked_by_rule',
      reason: `${hardRuleFailures.length} hard rule failure(s), ${duplicateFlags.length} duplicate(s) detected. Must be fixed before proceeding.`,
      weighted_average: null,
      critical_failures: 0,
      validator_scores: validatorResults.map(r => ({
        name: r.validator_name,
        score: r.response.overall_score,
        recommendation: r.response.pass_recommendation,
      })),
      hard_rule_failure_count: hardRuleFailures.length,
      duplicate_count: duplicateFlags.length,
    }
  }

  // ── If no validators assigned (e.g. Screen 0 / 9), auto-pass ─────
  if (validatorResults.length === 0) {
    return {
      decision: 'pass',
      reason: 'No validators assigned; hard rules passed.',
      weighted_average: null,
      critical_failures: 0,
      validator_scores: [],
      hard_rule_failure_count: 0,
      duplicate_count: 0,
    }
  }

  // ── Check critical failures (any validator < 6.0) ────────────────
  const criticalCount = validatorResults.filter(
    r => r.response.overall_score < CRITICAL_FAILURE_BELOW
  ).length

  // ── Compute weighted average ─────────────────────────────────────
  const weights = getEffectiveWeights(config)
  let weightedSum = 0
  let totalWeight = 0
  for (const r of validatorResults) {
    const w = weights[r.validator_name] ?? 0
    weightedSum += r.response.overall_score * w
    totalWeight += w
  }
  const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : 0

  const validatorScoresReport = validatorResults.map(r => ({
    name: r.validator_name,
    score: r.response.overall_score,
    recommendation: r.response.pass_recommendation,
  }))

  // ── If any validator wants to escalate directly, escalate ─────────
  if (validatorResults.some(r => r.response.pass_recommendation === 'escalate')) {
    return {
      decision: 'escalate',
      reason: 'At least one validator recommended escalation.',
      weighted_average: weightedAvg,
      critical_failures: criticalCount,
      validator_scores: validatorScoresReport,
      hard_rule_failure_count: 0,
      duplicate_count: 0,
    }
  }

  // ── Direct pass ───────────────────────────────────────────────────
  // Per Doc 3: "A step may still pass with one validator at 7 if the
  // weighted average is 8.0 or above and no hard non-LLM rule has failed."
  if (criticalCount === 0 && weightedAvg >= DIRECT_PASS_WEIGHTED_AVERAGE) {
    return {
      decision: 'pass',
      reason: `Weighted average ${weightedAvg.toFixed(2)} >= ${DIRECT_PASS_WEIGHTED_AVERAGE}; no critical failures.`,
      weighted_average: weightedAvg,
      critical_failures: 0,
      validator_scores: validatorScoresReport,
      hard_rule_failure_count: 0,
      duplicate_count: 0,
    }
  }

  // ── If critical failure (<6), we must revise or escalate ──────────
  // ── Revision band ────────────────────────────────────────────────
  const inReviseBand = weightedAvg >= REVISE_BAND_MIN && weightedAvg <= REVISE_BAND_MAX
  const belowReviseBand = weightedAvg < REVISE_BAND_MIN

  if (revisionCount >= config.max_revision_loops) {
    return {
      decision: 'escalate',
      reason: `Revision cap of ${config.max_revision_loops} reached (current: ${revisionCount}). Escalating to user.`,
      weighted_average: weightedAvg,
      critical_failures: criticalCount,
      validator_scores: validatorScoresReport,
      hard_rule_failure_count: 0,
      duplicate_count: 0,
    }
  }

  if (criticalCount > 0) {
    return {
      decision: 'revise',
      reason: `${criticalCount} validator(s) scored below ${CRITICAL_FAILURE_BELOW}. Weighted avg: ${weightedAvg.toFixed(2)}.`,
      weighted_average: weightedAvg,
      critical_failures: criticalCount,
      validator_scores: validatorScoresReport,
      hard_rule_failure_count: 0,
      duplicate_count: 0,
    }
  }

  if (inReviseBand || belowReviseBand) {
    return {
      decision: 'revise',
      reason: `Weighted average ${weightedAvg.toFixed(2)} in revise band or below ${DIRECT_PASS_WEIGHTED_AVERAGE}.`,
      weighted_average: weightedAvg,
      critical_failures: criticalCount,
      validator_scores: validatorScoresReport,
      hard_rule_failure_count: 0,
      duplicate_count: 0,
    }
  }

  // ── Default fallback: pass (shouldn't reach here with valid inputs)
  return {
    decision: 'pass',
    reason: `Weighted average ${weightedAvg.toFixed(2)} sufficient; no critical failures.`,
    weighted_average: weightedAvg,
    critical_failures: criticalCount,
    validator_scores: validatorScoresReport,
    hard_rule_failure_count: 0,
    duplicate_count: 0,
  }
}
