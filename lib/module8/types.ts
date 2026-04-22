// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Course Expansion: Canonical Types, Enums, and Constants
// ───────────────────────────────────────────────────────────────────────────
//
// This file is the single source of truth for enums, type names, and canonical
// constants referenced throughout Module 8. Do NOT rename or invent new enum
// values here — they must match the spec documents exactly.

// ─── Canonical Decision States ─────────────────────────────────────────────
// Per build instructions: only 4 canonical states. pass_with_notes is NOT used.

export type DecisionState = 'pass' | 'revise' | 'escalate' | 'blocked_by_rule'

// ─── Canonical Scoring Constants ───────────────────────────────────────────

export const CRITICAL_FAILURE_BELOW = 6.0
export const DIRECT_PASS_WEIGHTED_AVERAGE = 8.0
export const REVISE_BAND_MIN = 7.0
export const REVISE_BAND_MAX = 7.9
export const MAX_REVISION_LOOPS_DEFAULT = 2

// ─── Canonical Hard Rule IDs ───────────────────────────────────────────────

export const HARD_RULES = {
  REQUIRE_MODULE_OUTCOME:        'RULE_001_REQUIRE_MODULE_OUTCOME',
  MAX_7_MODULES:                  'RULE_002_MAX_7_MODULES',
  MAX_6_LESSONS_PER_MODULE:       'RULE_003_MAX_6_LESSONS_PER_MODULE',
  MAX_2_SENTENCE_LESSON_DESC:     'RULE_004_MAX_2_SENTENCE_LESSON_DESCRIPTION',
  REJECT_BANNED_HYPE_TERMS:       'RULE_005_REJECT_BANNED_HYPE_TERMS',
  REJECT_DUPLICATE_TITLES:        'RULE_006_REJECT_DUPLICATE_TITLES',
  ENFORCE_CLOSED_LISTS:           'RULE_007_ENFORCE_CLOSED_LISTS',
  REJECT_OVER_GENERATION:         'RULE_008_REJECT_OVER_GENERATION',
  REQUIRE_ACTIONABLE_LESSON:      'RULE_009_REQUIRE_ACTIONABLE_LESSON',
  REQUIRE_ASSET_COVERAGE_PER_MODULE: 'RULE_010_REQUIRE_ASSET_COVERAGE_PER_MODULE',
  REJECT_THEORY_ONLY_WHEN_SUPPORT_REQUIRED: 'RULE_011_REJECT_THEORY_ONLY_WHEN_SUPPORT_REQUIRED',
} as const

export type HardRuleId = typeof HARD_RULES[keyof typeof HARD_RULES]

// ─── Canonical Banned Hype Terms (RULE_005) ───────────────────────────────

export const BANNED_HYPE_TERMS = [
  'mastering',
  'ultimate',
  'complete',
  'comprehensive',
] as const

// ─── Canonical Closed Lists (RULE_007) ────────────────────────────────────

// Screen 1 — readiness
export const READINESS_VERDICTS = ['ready', 'borderline', 'not_ready'] as const
export type ReadinessVerdict = typeof READINESS_VERDICTS[number]

// Screen 3 — course depth (closed list)
export const COURSE_DEPTHS = ['quick_start', 'implementation', 'deep_dive'] as const
export type CourseDepth = typeof COURSE_DEPTHS[number]

// Screen 3 — delivery format (closed list)
export const DELIVERY_FORMATS = [
  'self_paced',
  'self_paced_with_support',
  'cohort_live',
  'hybrid_drip',
  'workshop_intensive',
] as const
export type DeliveryFormat = typeof DELIVERY_FORMATS[number]

// Screen 4 — structural verdict (closed list)
export const STRUCTURAL_VERDICTS = [
  'KEEP', 'EXPAND', 'MERGE', 'SPLIT', 'ADAPT', 'MOVE', 'REMOVE',
] as const
export type StructuralVerdict = typeof STRUCTURAL_VERDICTS[number]

// Screen 4 — support needs (closed list, multi-select)
export const SUPPORT_NEEDS = [
  'demo_walkthrough',
  'worksheet',
  'template',
  'simplification',
  'none',
] as const
export type SupportNeed = typeof SUPPORT_NEEDS[number]

// Screens 6 & 7 — canonical asset types (closed list)
export const ASSET_TYPES = [
  'video',
  'text_lesson',
  'worksheet',
  'checklist',
  'prompt_pack',
  'template',
  'tracker',
  'audio_guide',
  'script_card',
  'demo_walkthrough',
  'case_study',
  'faq',
] as const
export type AssetType = typeof ASSET_TYPES[number]

// Screen 8 — student experience plan enums
export const DELIVERY_CADENCES = [
  'all_at_once', 'weekly_drip', 'biweekly_drip', 'self_paced_unlocked',
] as const
export type DeliveryCadence = typeof DELIVERY_CADENCES[number]

export const SUPPORT_CHANNELS = [
  'none', 'async_email', 'group_chat', 'live_monthly', 'live_weekly', 'one_on_one',
] as const
export type SupportChannel = typeof SUPPORT_CHANNELS[number]

export const COMMUNITY_ACCESS = [
  'none', 'optional_private', 'required_private', 'public',
] as const
export type CommunityAccess = typeof COMMUNITY_ACCESS[number]

export const LIVE_SESSION_FREQUENCIES = [
  'none', 'monthly', 'biweekly', 'weekly',
] as const
export type LiveSessionFrequency = typeof LIVE_SESSION_FREQUENCIES[number]

export const COMPLETION_MODELS = [
  'none', 'self_report', 'milestone_checkpoints', 'coach_verified',
] as const
export type CompletionModel = typeof COMPLETION_MODELS[number]

export const CERTIFICATIONS = [
  'none', 'completion_badge', 'formal_certificate',
] as const
export type Certification = typeof CERTIFICATIONS[number]

// ─── Validator Names ───────────────────────────────────────────────────────

export const VALIDATOR_NAMES = ['curriculum', 'learner_experience', 'market'] as const
export type ValidatorName = typeof VALIDATOR_NAMES[number]

// ─── Validator Response Shape ──────────────────────────────────────────────

export interface ValidatorResult {
  validator_name: ValidatorName
  overall_score: number  // 1-10 scale
  dimension_scores: Record<string, number>
  pass_recommendation: 'pass' | 'revise' | 'escalate'
  top_issues: string[]
  suggested_fixes: string[]
  confidence: 'low' | 'medium' | 'high'
  hard_rule_failures?: HardRuleId[]
  warnings?: string[]
}

// ─── Orchestrator Decision ─────────────────────────────────────────────────

export interface OrchestratorDecision {
  decision: DecisionState
  weighted_average?: number
  critical_failures: HardRuleId[]
  revision_count: number
  validator_results: ValidatorResult[]
  reason: string
}

// ─── Session Types ─────────────────────────────────────────────────────────

export type Module8Status = 'active' | 'paused' | 'completed' | 'abandoned'
export type UnlockStatus = 'locked' | 'unlocked' | 'override'

export type StepStatus =
  | 'draft'
  | 'validating'
  | 'revising'
  | 'passed'
  | 'escalated'
  | 'blocked_by_rule'
  | 'approved'
  | 'reopened'

export interface Module8Session {
  id: string
  user_id: string
  module8_status: Module8Status
  unlock_status: UnlockStatus
  unlock_reason: string | null
  current_screen: number
  blueprint_version: number
  session_context_cache_jsonb: Record<string, unknown> | null
  started_at: string
  updated_at: string
  completed_at: string | null
}

// ─── Screen IDs (0-9) ──────────────────────────────────────────────────────

export type ScreenId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const SCREEN_IDS: readonly ScreenId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export const SCREEN_NAMES: Record<ScreenId, string> = {
  0: 'Welcome / Orientation',
  1: 'Course Readiness Check',
  2: 'Reconfirm the Transformation',
  3: 'Choose the Right Course Type',
  4: 'Audit the E-book Before Turning It Into a Course',
  5: 'Build the Course Skeleton',
  6: 'Break Modules Into Lessons',
  7: 'Add the Implementation Layer',
  8: 'Define the Student Experience',
  9: 'Final Course Blueprint Summary',
}

// ─── Screen Path Slugs (for UI routing) ────────────────────────────────────

export const SCREEN_SLUGS: Record<ScreenId, string> = {
  0: 'orientation',
  1: 'readiness',
  2: 'transformation',
  3: 'course-type',
  4: 'chapter-audit',
  5: 'course-skeleton',
  6: 'lesson-map',
  7: 'implementation-layer',
  8: 'student-experience',
  9: 'blueprint',
}
