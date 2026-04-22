// ───────────────────────────────────────────────────────────────────────────
// Module 8 — QC Engine
// ───────────────────────────────────────────────────────────────────────────
//
// Orchestrates:
// 1. Rule-based prechecks (deterministic, no LLM)
// 2. Validator runs (LLM, in parallel)
// 3. Decision aggregation
//
// Returns the full picture: decision + validator results + hard rule failures.

import { getConfig } from '../config'
import type { ScreenId, ValidatorName, DecisionState, HardRuleId } from '../types'
import { HARD_RULES } from '../types'
import { runValidatorsParallel } from '../validators/run'
import { decideOutcome, type DecisionResult } from '../decisions'
import type { ValidatorRunResult } from '../validators/base'
import {
  checkRequireModuleOutcome,
  checkMax7Modules,
  checkMax6LessonsPerModule,
  checkMax2SentenceLessonDesc,
  checkBannedHypeTerms,
  checkClosedLists,
  checkOverGeneration,
  checkActionableLessons,
  checkAssetCoveragePerModule,
  mergeHardRuleResults,
  type HardRuleFailure,
  type HardRuleCheckResult,
} from './hardRules'
import {
  detectDuplicates,
  type DuplicateFlag,
} from './duplicateDetection'

export interface QCEngineInput {
  screenId: ScreenId
  draft: Record<string, unknown>
  upstreamContext: Record<string, unknown>
  revisionCount: number
}

export interface QCEngineResult {
  decision: DecisionState
  decisionResult: DecisionResult
  hardRuleFailures: HardRuleFailure[]
  hardRuleWarnings: HardRuleFailure[]
  duplicateFlags: DuplicateFlag[]
  validatorResults: ValidatorRunResult[]
  validatorErrors: { validator: ValidatorName; error: string }[]
}

export async function runQCEngine(input: QCEngineInput): Promise<QCEngineResult> {
  const config = getConfig(input.screenId)

  // ── 1. Hard rule prechecks ─────────────────────────────────────────────
  const hardRuleResult = await runHardRulesForScreen(input.screenId, input.draft, config.hard_rules)
  const duplicateFlags = await runDuplicateDetectionForScreen(input.screenId, input.draft, config.duplicate_detection_scope)

  // ── 2. If hard rules failed, skip validators (per Doc 3 precheck rule) ─
  if (hardRuleResult.failures.length > 0 || duplicateFlags.length > 0) {
    const decisionResult = decideOutcome({
      config,
      validatorResults: [],
      validatorErrors: [],
      hardRuleFailures: hardRuleResult.failures,
      duplicateFlags,
      revisionCount: input.revisionCount,
    })
    return {
      decision: decisionResult.decision,
      decisionResult,
      hardRuleFailures: hardRuleResult.failures,
      hardRuleWarnings: hardRuleResult.warnings,
      duplicateFlags,
      validatorResults: [],
      validatorErrors: [],
    }
  }

  // ── 3. Validators in parallel ──────────────────────────────────────────
  const batch = await runValidatorsParallel({
    screenId: input.screenId,
    screenName: config.name,
    draft: input.draft,
    upstreamContext: input.upstreamContext,
    validators: config.assigned_validators,
    hardRuleFailureSummary: hardRuleResult.warnings.length > 0
      ? hardRuleResult.warnings.map(w => w.message).join('; ')
      : undefined,
  })

  // ── 4. Aggregate into decision ─────────────────────────────────────────
  const decisionResult = decideOutcome({
    config,
    validatorResults: batch.results,
    validatorErrors: batch.errors,
    hardRuleFailures: [],  // already passed
    duplicateFlags: [],    // already passed
    revisionCount: input.revisionCount,
  })

  return {
    decision: decisionResult.decision,
    decisionResult,
    hardRuleFailures: [],
    hardRuleWarnings: hardRuleResult.warnings,
    duplicateFlags: [],
    validatorResults: batch.results,
    validatorErrors: batch.errors,
  }
}

// ─── Per-screen rule dispatching ───────────────────────────────────────────

async function runHardRulesForScreen(
  screenId: ScreenId,
  draft: Record<string, unknown>,
  rules: HardRuleId[]
): Promise<HardRuleCheckResult> {
  const results: HardRuleCheckResult[] = []
  const ruleSet = new Set<string>(rules)

  // Screen 2: transformation — check banned hype terms in strings
  if (screenId === 2 && ruleSet.has(HARD_RULES.REJECT_BANNED_HYPE_TERMS)) {
    const d = draft as {
      course_transformation_statement?: string
      target_learner?: string
      course_outcome?: string
    }
    results.push(checkBannedHypeTerms([
      { title: d.course_transformation_statement },
      { title: d.target_learner },
      { title: d.course_outcome },
    ]))
  }

  // Screen 3: course type — check closed lists
  if (screenId === 3 && ruleSet.has(HARD_RULES.ENFORCE_CLOSED_LISTS)) {
    const d = draft as { course_depth?: string; delivery_format?: string }
    results.push(checkClosedLists([
      { field: 'course_depth', list: 'course_depth', value: d.course_depth },
      { field: 'delivery_format', list: 'delivery_format', value: d.delivery_format },
    ]))
  }

  // Screen 4: chapter audit — check closed lists for verdicts + support_needs
  if (screenId === 4 && ruleSet.has(HARD_RULES.ENFORCE_CLOSED_LISTS)) {
    const d = draft as { chapter_audit?: { structural_verdict?: string; support_needs?: string[] }[] }
    if (Array.isArray(d.chapter_audit)) {
      const pairs: { field: string; list: 'structural_verdict' | 'support_needs'; value: unknown }[] = []
      for (const [i, ch] of d.chapter_audit.entries()) {
        pairs.push({ field: `chapter_audit[${i}].structural_verdict`, list: 'structural_verdict', value: ch.structural_verdict })
        pairs.push({ field: `chapter_audit[${i}].support_needs`, list: 'support_needs', value: ch.support_needs })
      }
      results.push(checkClosedLists(pairs))
    }
  }

  // Screen 5: course skeleton — modules
  if (screenId === 5) {
    const d = draft as { module_map?: { title?: string; transformation?: string }[] }
    if (Array.isArray(d.module_map)) {
      if (ruleSet.has(HARD_RULES.MAX_7_MODULES)) {
        results.push(checkMax7Modules(d.module_map))
      }
      if (ruleSet.has(HARD_RULES.REQUIRE_MODULE_OUTCOME)) {
        results.push(checkRequireModuleOutcome(d.module_map))
      }
      if (ruleSet.has(HARD_RULES.REJECT_BANNED_HYPE_TERMS)) {
        results.push(checkBannedHypeTerms(d.module_map.map(m => ({ title: m.title })), true))
      }
    }
  }

  // Screen 6: lesson map — lessons per module
  if (screenId === 6) {
    const d = draft as { lesson_map?: { title?: string; lessons?: { title?: string; description?: string; outcome?: string }[] }[] }
    if (Array.isArray(d.lesson_map)) {
      if (ruleSet.has(HARD_RULES.MAX_6_LESSONS_PER_MODULE)) {
        results.push(checkMax6LessonsPerModule(d.lesson_map))
      }
      const allLessons = d.lesson_map.flatMap(m => m.lessons ?? [])
      if (ruleSet.has(HARD_RULES.MAX_2_SENTENCE_LESSON_DESC)) {
        results.push(checkMax2SentenceLessonDesc(allLessons))
      }
      if (ruleSet.has(HARD_RULES.REQUIRE_ACTIONABLE_LESSON)) {
        results.push(checkActionableLessons(allLessons))
      }
      if (ruleSet.has(HARD_RULES.REJECT_BANNED_HYPE_TERMS)) {
        results.push(checkBannedHypeTerms(allLessons.map(l => ({ title: l.title })), true))
      }
    }
  }

  // Screen 7: implementation layer — asset coverage
  if (screenId === 7) {
    const d = draft as { asset_map?: { module_number?: number; assets?: unknown[] }[] }
    if (Array.isArray(d.asset_map)) {
      if (ruleSet.has(HARD_RULES.REQUIRE_ASSET_COVERAGE_PER_MODULE)) {
        results.push(checkAssetCoveragePerModule(d.asset_map))
      }
      if (ruleSet.has(HARD_RULES.REJECT_OVER_GENERATION)) {
        results.push(checkOverGeneration({
          maxAssetsPerModule: 3,
          actualAssetCounts: d.asset_map.map(m => m.assets?.length ?? 0),
        }))
      }
    }
  }

  return mergeHardRuleResults(results)
}

async function runDuplicateDetectionForScreen(
  screenId: ScreenId,
  draft: Record<string, unknown>,
  scope?: string
): Promise<DuplicateFlag[]> {
  if (!scope || scope === 'none') return []

  if (screenId === 5 && scope === 'module_to_module_within_course') {
    const d = draft as { module_map?: { title?: string }[] }
    const titles = (d.module_map ?? []).map(m => m.title ?? '').filter(Boolean)
    if (titles.length >= 2) {
      return await detectDuplicates(titles, {
        fieldName: 'module_map.title',
        scope,
      })
    }
  }

  if (screenId === 6 && scope === 'lesson_to_lesson_within_module') {
    const d = draft as { lesson_map?: { title?: string; lessons?: { title?: string }[] }[] }
    const flags: DuplicateFlag[] = []
    for (const [i, mod] of (d.lesson_map ?? []).entries()) {
      const titles = (mod.lessons ?? []).map(l => l.title ?? '').filter(Boolean)
      if (titles.length >= 2) {
        const moduleFlags = await detectDuplicates(titles, {
          fieldName: `lesson_map[${i}].lessons.title`,
          scope,
        })
        flags.push(...moduleFlags)
      }
    }
    return flags
  }

  return []
}
