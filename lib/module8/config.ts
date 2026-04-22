// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Step Configuration
// ───────────────────────────────────────────────────────────────────────────
//
// One config object per screen. Controls:
// - which upstream context fields are required
// - which creator prompt file is loaded
// - which validators run
// - validator weights
// - which hard rules to enforce
// - which fields the Reviser is allowed to edit
// - which downstream screens to flag when this step is edited
//
// Source of truth: Document 3 (validator assignment + weights), Document 5
// (step config structure, regenerate_limit), Document 4 (hard rules).

import { HARD_RULES, HardRuleId, ScreenId, ValidatorName } from './types'

export interface ScreenConfig {
  screen_id: ScreenId
  name: string
  required_context_fields: string[]
  creator_prompt_ref: string | null  // null for screens 0 and 9 (no creator)
  schema_ref: string
  assigned_validators: ValidatorName[]
  validator_weights?: Partial<Record<ValidatorName, number>>
  weight_override_reason?: string
  hard_rules: HardRuleId[]
  duplicate_detection_scope?: 'lesson_to_lesson_within_module' | 'module_to_module_within_course' | 'none'
  writable_fields: string[]
  downstream_dependents: ScreenId[]
  regenerate_limit: number
  max_revision_loops: number
}

export const STEP_CONFIGS: Record<ScreenId, ScreenConfig> = {
  // ─── Screen 0: Orientation (no AI) ────────────────────────────────────────
  0: {
    screen_id: 0,
    name: 'Welcome / Orientation',
    required_context_fields: [],
    creator_prompt_ref: null,
    schema_ref: 'screen_0',
    assigned_validators: [],
    hard_rules: [],
    writable_fields: [],
    downstream_dependents: [],
    regenerate_limit: 0,
    max_revision_loops: 0,
  },

  // ─── Screen 1: Readiness ──────────────────────────────────────────────────
  // Doc 3: Learner Experience + Market validators (0.45 / 0.55 override)
  1: {
    screen_id: 1,
    name: 'Course Readiness Check',
    required_context_fields: [],
    creator_prompt_ref: 'module8/creator/screen_1_readiness',
    schema_ref: 'screen_1',
    assigned_validators: ['learner_experience', 'market'],
    validator_weights: { learner_experience: 0.45, market: 0.55 },
    weight_override_reason:
      'Doc 3 required override — Screen 1 is a readiness and fit decision.',
    hard_rules: [HARD_RULES.ENFORCE_CLOSED_LISTS],
    writable_fields: ['coach_notes', 'recommended_next_path'],
    downstream_dependents: [],  // readiness is advisory, doesn't fan out
    regenerate_limit: 5,
    max_revision_loops: 2,
  },

  // ─── Screen 2: Transformation ─────────────────────────────────────────────
  2: {
    screen_id: 2,
    name: 'Reconfirm the Transformation',
    required_context_fields: [
      'clarity_sentence',
      'target_market',
      'core_problem',
      'unique_mechanism',
      'ebook_title',
    ],
    creator_prompt_ref: 'module8/creator/screen_2_transformation',
    schema_ref: 'screen_2',
    assigned_validators: ['curriculum', 'market'],
    hard_rules: [
      HARD_RULES.ENFORCE_CLOSED_LISTS,
      HARD_RULES.REJECT_BANNED_HYPE_TERMS,
    ],
    writable_fields: [
      'course_transformation_statement',
      'target_learner',
      'course_outcome',
      'unique_method',
      'implicit_outcomes',
      'duration_commitment',
      'audience_protective_clause',
    ],
    downstream_dependents: [3, 4, 5, 6, 7, 8, 9],  // transformation is root
    regenerate_limit: 5,
    max_revision_loops: 2,
  },

  // ─── Screen 3: Course Type ────────────────────────────────────────────────
  3: {
    screen_id: 3,
    name: 'Choose the Right Course Type',
    required_context_fields: [
      'course_transformation_statement',
      'target_learner',
      'course_outcome',
    ],
    creator_prompt_ref: 'module8/creator/screen_3_course_type',
    schema_ref: 'screen_3',
    assigned_validators: ['learner_experience', 'market'],
    hard_rules: [HARD_RULES.ENFORCE_CLOSED_LISTS],
    writable_fields: [
      'course_depth',
      'delivery_format',
      'course_type_rationale',
      'rejected_alternatives',
    ],
    downstream_dependents: [5, 6, 7, 8, 9],
    regenerate_limit: 5,
    max_revision_loops: 2,
  },

  // ─── Screen 4: Chapter Audit ──────────────────────────────────────────────
  4: {
    screen_id: 4,
    name: 'Audit the E-book Before Turning It Into a Course',
    required_context_fields: [
      'course_transformation_statement',
      'ebook_chapters',
    ],
    creator_prompt_ref: 'module8/creator/screen_4_chapter_audit',
    schema_ref: 'screen_4',
    assigned_validators: ['curriculum'],
    hard_rules: [HARD_RULES.ENFORCE_CLOSED_LISTS],
    writable_fields: ['chapter_audit'],
    downstream_dependents: [5, 6, 9],
    regenerate_limit: 5,
    max_revision_loops: 2,
  },

  // ─── Screen 5: Course Skeleton ────────────────────────────────────────────
  // Doc 5 step-specific override: curriculum 0.45 / learner 0.30 / market 0.25
  5: {
    screen_id: 5,
    name: 'Build the Course Skeleton',
    required_context_fields: [
      'course_transformation_statement',
      'course_depth',
      'delivery_format',
      'chapter_audit',
    ],
    creator_prompt_ref: 'module8/creator/screen_5_course_skeleton',
    schema_ref: 'screen_5',
    assigned_validators: ['curriculum', 'learner_experience', 'market'],
    validator_weights: { curriculum: 0.45, learner_experience: 0.30, market: 0.25 },
    weight_override_reason:
      'Doc 5 override — Screen 5 is primarily about structural architecture.',
    hard_rules: [
      HARD_RULES.MAX_7_MODULES,
      HARD_RULES.REQUIRE_MODULE_OUTCOME,
      HARD_RULES.REJECT_DUPLICATE_TITLES,
      HARD_RULES.REJECT_BANNED_HYPE_TERMS,
      HARD_RULES.ENFORCE_CLOSED_LISTS,
    ],
    duplicate_detection_scope: 'module_to_module_within_course',
    writable_fields: [
      'course_title',
      'module_map',
      'module_outcomes',
      'total_modules',
    ],
    downstream_dependents: [6, 7, 9],
    regenerate_limit: 5,
    max_revision_loops: 2,
  },

  // ─── Screen 6: Lesson Map ─────────────────────────────────────────────────
  6: {
    screen_id: 6,
    name: 'Break Modules Into Lessons',
    required_context_fields: [
      'course_transformation_statement',
      'module_map',
    ],
    creator_prompt_ref: 'module8/creator/screen_6_lesson_map',
    schema_ref: 'screen_6',
    assigned_validators: ['curriculum', 'learner_experience'],
    hard_rules: [
      HARD_RULES.MAX_6_LESSONS_PER_MODULE,
      HARD_RULES.MAX_2_SENTENCE_LESSON_DESC,
      HARD_RULES.REJECT_BANNED_HYPE_TERMS,
      HARD_RULES.REJECT_DUPLICATE_TITLES,
      HARD_RULES.REQUIRE_ACTIONABLE_LESSON,
      HARD_RULES.ENFORCE_CLOSED_LISTS,
      HARD_RULES.REJECT_OVER_GENERATION,
    ],
    duplicate_detection_scope: 'lesson_to_lesson_within_module',
    writable_fields: ['lesson_map', 'lesson_objectives', 'lesson_actions'],
    downstream_dependents: [7, 9],
    regenerate_limit: 5,
    max_revision_loops: 2,
  },

  // ─── Screen 7: Implementation Assets ──────────────────────────────────────
  7: {
    screen_id: 7,
    name: 'Add the Implementation Layer',
    required_context_fields: [
      'course_transformation_statement',
      'module_map',
      'lesson_map',
    ],
    creator_prompt_ref: 'module8/creator/screen_7_implementation_layer',
    schema_ref: 'screen_7',
    assigned_validators: ['learner_experience', 'curriculum'],
    hard_rules: [
      HARD_RULES.REQUIRE_ASSET_COVERAGE_PER_MODULE,
      HARD_RULES.ENFORCE_CLOSED_LISTS,
      HARD_RULES.REJECT_OVER_GENERATION,
      HARD_RULES.REJECT_THEORY_ONLY_WHEN_SUPPORT_REQUIRED,
    ],
    writable_fields: ['asset_map', 'asset_counts_by_module'],
    downstream_dependents: [9],
    regenerate_limit: 5,
    max_revision_loops: 2,
  },

  // ─── Screen 8: Student Experience ─────────────────────────────────────────
  8: {
    screen_id: 8,
    name: 'Define the Student Experience',
    required_context_fields: [
      'course_transformation_statement',
      'delivery_format',
      'target_learner',
    ],
    creator_prompt_ref: 'module8/creator/screen_8_student_experience',
    schema_ref: 'screen_8',
    assigned_validators: ['learner_experience', 'market'],
    hard_rules: [HARD_RULES.ENFORCE_CLOSED_LISTS],
    writable_fields: ['experience_plan', 'pacing_plan', 'support_model', 'unlock_model', 'milestone_plan'],
    downstream_dependents: [9],
    regenerate_limit: 5,
    max_revision_loops: 2,
  },

  // ─── Screen 9: Blueprint Assembly (orchestrator-only, no creator) ─────────
  9: {
    screen_id: 9,
    name: 'Final Course Blueprint Summary',
    required_context_fields: [
      'course_transformation_statement',
      'course_depth',
      'delivery_format',
      'chapter_audit',
      'module_map',
      'lesson_map',
      'asset_map',
      'experience_plan',
    ],
    creator_prompt_ref: null,  // Orchestrator assembles
    schema_ref: 'blueprint',
    assigned_validators: [],
    hard_rules: [
      HARD_RULES.REQUIRE_ASSET_COVERAGE_PER_MODULE,
      HARD_RULES.ENFORCE_CLOSED_LISTS,
    ],
    writable_fields: ['final_course_blueprint', 'blueprint_version', 'module_8_completion_status'],
    downstream_dependents: [],
    regenerate_limit: 0,
    max_revision_loops: 0,
  },
}

export function getConfig(screenId: ScreenId): ScreenConfig {
  const config = STEP_CONFIGS[screenId]
  if (!config) throw new Error(`No config found for screen ${screenId}`)
  return config
}

// ─── Downstream warning trigger fields (Doc 2 + Doc 5) ────────────────────
// When these approved fields are edited, downstream steps must be flagged.

export const DOWNSTREAM_WARNING_TRIGGER_FIELDS = [
  'course_transformation_statement',
  'course_depth',
  'delivery_format',
  'module_map',
  'lesson_map',
] as const

// ─── Regenerate limit (rolling 24-hour window, per step) ──────────────────

export const REGENERATE_WINDOW_MS = 24 * 60 * 60 * 1000  // 24 hours
export const REGENERATE_DISABLED_MESSAGE =
  "You've regenerated this 5 times today. Try editing manually, or come back tomorrow with fresh eyes."

// ─── Default validator weights when no override exists ────────────────────
// Doc 3: 0.40 / 0.35 / 0.25 — normalized across only assigned validators.

export const DEFAULT_VALIDATOR_WEIGHTS: Record<ValidatorName, number> = {
  curriculum: 0.40,
  learner_experience: 0.35,
  market: 0.25,
}

/**
 * Returns the effective weights for a given screen config, normalizing across
 * only the assigned validators if no explicit override exists.
 */
export function getEffectiveWeights(
  config: ScreenConfig
): Partial<Record<ValidatorName, number>> {
  // Explicit override wins
  if (config.validator_weights) return config.validator_weights

  // Normalize defaults across assigned validators
  const assigned = config.assigned_validators
  if (assigned.length === 0) return {}

  const defaults = assigned.reduce((acc, name) => {
    acc[name] = DEFAULT_VALIDATOR_WEIGHTS[name]
    return acc
  }, {} as Partial<Record<ValidatorName, number>>)

  const total = Object.values(defaults).reduce((sum, v) => sum + (v ?? 0), 0)
  if (total === 0) return defaults

  // Normalize so weights sum to 1.0
  const normalized: Partial<Record<ValidatorName, number>> = {}
  for (const name of assigned) {
    normalized[name] = (defaults[name] ?? 0) / total
  }
  return normalized
}
