// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Hard Rule Implementations
// ───────────────────────────────────────────────────────────────────────────
//
// Deterministic rule checks that run BEFORE LLM validators (per Doc 3).
// If any hard rule fails, the decision engine may mark the draft as
// `blocked_by_rule` — bypassing LLM validation.

import {
  HARD_RULES,
  HardRuleId,
  BANNED_HYPE_TERMS,
  ASSET_TYPES,
  COURSE_DEPTHS,
  DELIVERY_FORMATS,
  STRUCTURAL_VERDICTS,
  SUPPORT_NEEDS,
} from '../types'

export interface HardRuleFailure {
  rule_id: HardRuleId
  field?: string
  message: string
  details?: Record<string, unknown>
}

export interface HardRuleCheckResult {
  failures: HardRuleFailure[]
  warnings: HardRuleFailure[]  // rules that flag but don't block (e.g. banned words in some contexts)
}

// Merge multiple results
function merge(results: HardRuleCheckResult[]): HardRuleCheckResult {
  const all: HardRuleCheckResult = { failures: [], warnings: [] }
  for (const r of results) {
    all.failures.push(...r.failures)
    all.warnings.push(...r.warnings)
  }
  return all
}

function ok(): HardRuleCheckResult {
  return { failures: [], warnings: [] }
}

function fail(failures: HardRuleFailure[], warnings: HardRuleFailure[] = []): HardRuleCheckResult {
  return { failures, warnings }
}

// ─── RULE_001: Every module must declare a clear learner outcome ──────────

export function checkRequireModuleOutcome(modules: unknown[]): HardRuleCheckResult {
  const failures: HardRuleFailure[] = []
  for (const [i, mod] of modules.entries()) {
    const m = mod as { transformation?: string; outcome?: string; module_outcome?: string; title?: string }
    const outcome = m?.transformation ?? m?.outcome ?? m?.module_outcome
    if (!outcome || String(outcome).trim().length < 10) {
      failures.push({
        rule_id: HARD_RULES.REQUIRE_MODULE_OUTCOME,
        field: `modules[${i}].transformation`,
        message: `Module ${i + 1} (${m?.title ?? 'untitled'}) is missing a clear learner outcome (min 10 chars)`,
      })
    }
  }
  return { failures, warnings: [] }
}

// ─── RULE_002: Max 7 modules ──────────────────────────────────────────────

export function checkMax7Modules(modules: unknown[]): HardRuleCheckResult {
  if (modules.length > 7) {
    return fail([{
      rule_id: HARD_RULES.MAX_7_MODULES,
      field: 'modules',
      message: `Course has ${modules.length} modules; max is 7 at blueprint stage.`,
      details: { count: modules.length, max: 7 },
    }])
  }
  return ok()
}

// ─── RULE_003: Max 6 lessons per module ───────────────────────────────────

export function checkMax6LessonsPerModule(
  modulesWithLessons: { title?: string; lessons?: unknown[] }[]
): HardRuleCheckResult {
  const failures: HardRuleFailure[] = []
  for (const [i, mod] of modulesWithLessons.entries()) {
    const lessonCount = mod.lessons?.length ?? 0
    if (lessonCount > 6) {
      failures.push({
        rule_id: HARD_RULES.MAX_6_LESSONS_PER_MODULE,
        field: `modules[${i}].lessons`,
        message: `Module ${i + 1} (${mod.title ?? 'untitled'}) has ${lessonCount} lessons; max is 6 at blueprint stage.`,
        details: { module_index: i, lesson_count: lessonCount, max: 6 },
      })
    }
  }
  return { failures, warnings: [] }
}

// ─── RULE_004: Max 2 sentences per lesson description ─────────────────────

export function checkMax2SentenceLessonDesc(
  allLessons: { title?: string; description?: string; outcome?: string }[]
): HardRuleCheckResult {
  const failures: HardRuleFailure[] = []
  for (const [i, lesson] of allLessons.entries()) {
    const desc = lesson.description ?? lesson.outcome
    if (!desc) continue
    const sentenceCount = countSentences(desc)
    if (sentenceCount > 2) {
      failures.push({
        rule_id: HARD_RULES.MAX_2_SENTENCE_LESSON_DESC,
        field: `lessons[${i}].description`,
        message: `Lesson "${lesson.title ?? 'untitled'}" description has ${sentenceCount} sentences; max is 2 at blueprint stage.`,
        details: { lesson_index: i, sentence_count: sentenceCount },
      })
    }
  }
  return { failures, warnings: [] }
}

function countSentences(text: string): number {
  // Count terminal punctuation: . ! ? followed by whitespace/EOL
  const matches = text.match(/[.!?]+(\s|$)/g)
  return matches?.length ?? 1  // if no terminal punctuation, count as 1
}

// ─── RULE_005: Reject banned hype terms ────────────────────────────────────

export function checkBannedHypeTerms(
  targets: { title?: string; description?: string; outcome?: string }[],
  strict = false
): HardRuleCheckResult {
  const issues: HardRuleFailure[] = []
  for (const [i, item] of targets.entries()) {
    const checkFields: { field: string; value: string | undefined }[] = [
      { field: `targets[${i}].title`, value: item.title },
      { field: `targets[${i}].description`, value: item.description },
      { field: `targets[${i}].outcome`, value: item.outcome },
    ]
    for (const { field, value } of checkFields) {
      if (!value) continue
      const lower = value.toLowerCase()
      for (const banned of BANNED_HYPE_TERMS) {
        const regex = new RegExp(`\\b${banned}\\b`, 'i')
        if (regex.test(lower)) {
          issues.push({
            rule_id: HARD_RULES.REJECT_BANNED_HYPE_TERMS,
            field,
            message: `Contains banned hype term "${banned}": "${value.substring(0, 100)}"`,
            details: { banned_term: banned, value },
          })
        }
      }
    }
  }
  // Banned hype words trigger warnings in some contexts, failures at blueprint stage
  return strict ? { failures: issues, warnings: [] } : { failures: [], warnings: issues }
}

// ─── RULE_007: Enforce closed lists ────────────────────────────────────────

const CLOSED_LISTS: Record<string, readonly string[]> = {
  course_depth: COURSE_DEPTHS,
  delivery_format: DELIVERY_FORMATS,
  structural_verdict: STRUCTURAL_VERDICTS,
  support_needs: SUPPORT_NEEDS,
  asset_types: ASSET_TYPES,
}

export function checkClosedLists(
  fieldValuePairs: { field: string; list: keyof typeof CLOSED_LISTS; value: unknown }[]
): HardRuleCheckResult {
  const failures: HardRuleFailure[] = []
  for (const { field, list, value } of fieldValuePairs) {
    const allowed = CLOSED_LISTS[list]
    if (!allowed) continue

    const values = Array.isArray(value) ? value : [value]
    for (const v of values) {
      if (typeof v !== 'string') {
        failures.push({
          rule_id: HARD_RULES.ENFORCE_CLOSED_LISTS,
          field,
          message: `Value for ${field} must be a string from closed list ${list}, got ${typeof v}`,
        })
        continue
      }
      if (!allowed.includes(v)) {
        failures.push({
          rule_id: HARD_RULES.ENFORCE_CLOSED_LISTS,
          field,
          message: `"${v}" is not in the closed list for ${field}. Allowed: ${allowed.join(', ')}`,
          details: { value: v, allowed },
        })
      }
    }
  }
  return { failures, warnings: [] }
}

// ─── RULE_008: Reject over-generation ──────────────────────────────────────

export function checkOverGeneration(opts: {
  maxModules?: number
  actualModuleCount?: number
  maxLessonsPerModule?: number
  actualLessonCounts?: number[]
  maxAssetsPerModule?: number
  actualAssetCounts?: number[]
}): HardRuleCheckResult {
  const failures: HardRuleFailure[] = []

  if (opts.maxModules && opts.actualModuleCount != null && opts.actualModuleCount > opts.maxModules) {
    failures.push({
      rule_id: HARD_RULES.REJECT_OVER_GENERATION,
      field: 'modules',
      message: `Generated ${opts.actualModuleCount} modules; max is ${opts.maxModules} for this step.`,
    })
  }

  if (opts.maxLessonsPerModule && opts.actualLessonCounts) {
    for (const [i, count] of opts.actualLessonCounts.entries()) {
      if (count > opts.maxLessonsPerModule) {
        failures.push({
          rule_id: HARD_RULES.REJECT_OVER_GENERATION,
          field: `modules[${i}].lessons`,
          message: `Module ${i + 1} has ${count} lessons; max is ${opts.maxLessonsPerModule}.`,
        })
      }
    }
  }

  if (opts.maxAssetsPerModule && opts.actualAssetCounts) {
    for (const [i, count] of opts.actualAssetCounts.entries()) {
      if (count > opts.maxAssetsPerModule) {
        failures.push({
          rule_id: HARD_RULES.REJECT_OVER_GENERATION,
          field: `modules[${i}].assets`,
          message: `Module ${i + 1} has ${count} assets; max is ${opts.maxAssetsPerModule}.`,
        })
      }
    }
  }

  return { failures, warnings: [] }
}

// ─── RULE_009: Every lesson must be actionable ─────────────────────────────

export function checkActionableLessons(
  lessons: { title?: string; outcome?: string; action?: string; description?: string }[]
): HardRuleCheckResult {
  const failures: HardRuleFailure[] = []
  for (const [i, lesson] of lessons.entries()) {
    const text = (lesson.outcome ?? '') + ' ' + (lesson.action ?? '') + ' ' + (lesson.description ?? '')
    const hasActionVerb = /\b(will|can|complete|build|write|identify|list|practice|apply|create|design|review|reflect|record|submit|share|pick|choose|sign)\b/i.test(text)
    if (!hasActionVerb || text.trim().length < 20) {
      failures.push({
        rule_id: HARD_RULES.REQUIRE_ACTIONABLE_LESSON,
        field: `lessons[${i}]`,
        message: `Lesson "${lesson.title ?? 'untitled'}" is not actionable — student should understand/do/complete something specific.`,
      })
    }
  }
  return { failures, warnings: [] }
}

// ─── RULE_010: Every module must have 1-3 assets ───────────────────────────

export function checkAssetCoveragePerModule(
  moduleAssets: { module_number?: number; assets?: unknown[] }[]
): HardRuleCheckResult {
  const failures: HardRuleFailure[] = []
  for (const [i, m] of moduleAssets.entries()) {
    const count = m.assets?.length ?? 0
    if (count < 1) {
      failures.push({
        rule_id: HARD_RULES.REQUIRE_ASSET_COVERAGE_PER_MODULE,
        field: `module_assets[${i}]`,
        message: `Module ${m.module_number ?? i + 1} has 0 assets; minimum is 1.`,
      })
    } else if (count > 3) {
      failures.push({
        rule_id: HARD_RULES.REQUIRE_ASSET_COVERAGE_PER_MODULE,
        field: `module_assets[${i}]`,
        message: `Module ${m.module_number ?? i + 1} has ${count} assets; maximum is 3.`,
      })
    }
  }
  return { failures, warnings: [] }
}

// ─── Combined runner ───────────────────────────────────────────────────────

export { merge as mergeHardRuleResults }
