# 05. Technical Implementation Spec

## Document Purpose

This document translates KLARO Module 8: Course Expansion into a buildable technical specification for a coding agent.

This is Document 5 of 5 for the KLARO Module 8 handoff set.

This document defines:
- system boundaries
- service responsibilities
- API call sequence
- step-level request and response contracts
- state persistence rules
- prompt loading strategy
- validator execution rules
- revision loop behavior
- merge and drift controls
- logging and audit requirements
- implementation priorities

This document does **not** replace:
- the product vision in Document 1
- the screen flow in Document 2
- the orchestration rules in Document 3
- the reusable QC rules in Document 4

If this document conflicts with:
- **Document 2** on user-facing screen order or UX behavior, Document 2 wins
- **Document 3** on orchestration, validator assignment, scoring, or escalation, Document 3 wins
- **Document 4** on reusable QC logic, anti-slop rules, or revision policy, Document 4 wins
- **Appendix A** on step output JSON shape, field names, or required contract structure, Appendix A wins

---

## Scope

This specification is for **Module 8 only**.

Module 8 title:
**Turn Your E-book Into a Course**

Module 8 is a course-only feature. It is not currently a workshop builder, webinar builder, or live event builder.

However, some system components are intentionally reusable:
- orchestrator shell
- validator framework
- QC pipeline
- revision loop
- prompt library structure
- schema validation pattern
- audit logging pattern

---

## Recommended Technical Architecture

Use a modular service layout.

### Recommended services
1. **Module 8 Orchestrator**
   - manages step lifecycle
   - verifies unlock status
   - routes requests
   - calls creator, validators, and reviser
   - persists approved outputs
   - applies downstream review flags
   - enforces revision caps
   - handles escalation

2. **Prompt Loader**
   - loads step-specific prompt files
   - loads validator prompt files
   - loads reviser prompt files
   - version-tracks prompt usage

3. **Creator Runtime**
   - executes Course Creator Agent with step-specific prompts and output schema

4. **Validator Runtime**
   - executes assigned validators in parallel
   - returns normalized score payloads

5. **Revision Runtime**
   - executes Revision Agent with writable-only fields
   - returns revision payload for merge

6. **QC Engine**
   - runs rule-based prechecks
   - runs output contract validation
   - runs duplicate detection
   - runs drift check
   - applies product-step config

7. **Schema Validator**
   - validates JSON payloads against per-step schemas
   - enforces enums and required fields

8. **Persistence Layer**
   - stores draft state
   - stores approved state
   - stores validator results
   - stores revision logs
   - stores downstream review flags
   - stores prompt versions used

9. **Export / Blueprint Service**
   - assembles final blueprint
   - validates final contract
   - supports export later

---

## Suggested Directory Structure

```text
/module8
  /orchestrator
  /creator
  /validators
  /reviser
  /qc
  /schemas
  /prompts
    /module8
      /creator
      /validators
      /reviser
  /config
  /logs
```

Recommended prompt layout:

```text
/prompts/module8/creator/screen_1_readiness.md
/prompts/module8/creator/screen_2_transformation.md
/prompts/module8/creator/screen_3_course_type.md
/prompts/module8/creator/screen_4_chapter_audit.md
/prompts/module8/creator/screen_5_course_skeleton.md
/prompts/module8/creator/screen_6_lesson_map.md
/prompts/module8/creator/screen_7_implementation_layer.md
/prompts/module8/creator/screen_8_student_experience.md

/prompts/module8/validators/curriculum.md
/prompts/module8/validators/learner_experience.md
/prompts/module8/validators/market.md

/prompts/module8/reviser/default.md
```

---

## Core Runtime Principles

### 1. Step-scoped generation only
Do not ask the model to generate the full course in one call.

Each screen uses:
- the minimum approved upstream context required
- one step-specific prompt
- one step-specific output schema

### 2. Generate → validate → revise → recheck
No major step should move directly from generation to approval without validation.

### 3. Approved outputs are immutable upstream context
Once approved, upstream outputs become read-only for downstream steps unless the user explicitly reopens and edits them.

### 4. Revision is surgical
The reviser may only edit fields explicitly flagged as writable.

### 5. The database is the source of truth
Do not rely on chat history or prompt history as state.

---

## Module 8 Screen Map

This technical spec must follow the 10-screen model:

- Screen 0: Welcome / Orientation
- Screen 1: Course Readiness Check
- Screen 2: Reconfirm the Transformation
- Screen 3: Choose the Right Course Type
- Screen 4: Audit the E-book Before Turning It Into a Course
- Screen 5: Build the Course Skeleton
- Screen 6: Break Modules Into Lessons
- Screen 7: Add the Implementation Layer
- Screen 8: Define the Student Experience
- Screen 9: Final Course Blueprint Summary

Unlock gating happens before Screen 0.

---

## Step Lifecycle

Every actionable screen should follow this lifecycle:

1. load required approved upstream context
2. load step config
3. run rule-based precheck on incoming user data if applicable
4. run creator prompt for step draft
5. validate output contract
6. run assigned validators in parallel
7. aggregate scores and hard-rule results
8. decide `pass`, `pass`, `revise`, `escalate`, or `blocked_by_rule`
9. if revise, run reviser with writable fields only
10. re-run schema checks, hard rules, assigned validators, and drift check
11. persist draft, approvals, logs, and flags
12. return structured payload to UI

### Exception
Screen 0 does not invoke creator, validators, or reviser.
The orchestrator only:
- verifies unlock status
- persists orientation acknowledgment
- allows Screen 1 to start

---

## Required Tables / Persistence Objects

Recommended minimum data model.

### 1. module8_sessions
Tracks the user’s active Module 8 run.

Fields:
- id
- user_id
- module8_status
- unlock_status
- unlock_reason
- current_screen
- blueprint_version
- started_at
- updated_at
- completed_at

### 2. module8_step_outputs
Stores draft and approved payloads per screen.

Fields:
- id
- session_id
- screen_id
- draft_version
- approved_version
- draft_payload_jsonb
- approved_payload_jsonb
- status
- revision_count
- prompt_version
- created_at
- updated_at
- approved_at

### 3. module8_validator_runs
Stores validator outputs.

Fields:
- id
- session_id
- screen_id
- draft_version
- validator_name
- score_payload_jsonb
- hard_rule_failures_jsonb
- warnings_jsonb
- recommended_action
- created_at

### 4. module8_qc_runs
Stores rule-check and schema validation results.

Fields:
- id
- session_id
- screen_id
- draft_version
- rule_results_jsonb
- schema_results_jsonb
- duplicate_results_jsonb
- drift_results_jsonb
- final_decision
- created_at

### 5. module8_revision_runs
Stores reviser activity.

Fields:
- id
- session_id
- screen_id
- source_draft_version
- revision_index
- writable_fields_jsonb
- read_only_context_hash
- revision_output_jsonb
- merge_result_jsonb
- created_at

Hash specification:
- `read_only_context_hash` must be SHA-256 over a canonical JSON serialization
- canonical serialization means:
  - object keys sorted alphabetically at every level
  - no whitespace
  - UTF-8 encoded before hashing
  - array ordering preserved exactly as stored in approved context
- use a stable serializer such as `json-stable-stringify` or equivalent
- do **not** use native `JSON.stringify()` for this hash

### 6. module8_downstream_flags
Stores steps marked as may-need-review.

Fields:
- id
- session_id
- source_screen_id
- affected_screen_id
- trigger_field
- flag_status
- created_at
- resolved_at

### 7. module8_audit_log
Append-only operational log.

Fields:
- id
- session_id
- event_type
- event_payload_jsonb
- created_at

---

## Screen-Level Output Persistence

Field naming follows the status-on-row model. Persisted payload field names do not use an `approved_` prefix.
Approval state is tracked by the row status, approved_version, approved_at, and related audit metadata in the persistence layer.

### Screen 0
Persist:
- orientation_acknowledged_at
- orientation_version

### Screen 1
Persist:
- readiness_score
- readiness_verdict
- recommended_next_path
- coach_notes

### Screen 2
Persist:
- course_transformation_statement
- target_learner
- course_outcome
- unique_method

### Screen 3
Persist:
- course_depth
- delivery_format
- course_type_rationale
- rejected_alternatives

### Screen 4
Persist chapter-level array with:
- source_chapter_id
- structural_verdict
- support_needs

### Screen 5
Persist:
- course_title
- module_map
- module_outcomes

### Screen 6
Persist:
- lesson_map
- lesson_objectives
- lesson_actions
- lesson_content_types

### Screen 7
Persist:
- asset_map
- asset_counts_by_module
- modules_missing_assets

### Screen 8
Persist:
- experience_plan
- pacing_plan
- support_model
- unlock_model
- milestone_plan

### Screen 9
Persist:
- final_course_blueprint
- blueprint_version
- module_8_completion_status
- blueprint_approved_at

Blueprint version rule:
- `blueprint_version` starts at `1` when Screen 9 is first successfully assembled
- it increments by `1` each time a previously approved upstream screen is reopened and then re-approved
- it does **not** increment on simple re-read, view, or export actions
- Screen 9 reassembly after an upstream re-approval must use the latest incremented version
- the current version should be surfaced in the UI, for example: `Blueprint v3`

Note:
Appendix A should define the final authoritative field names and nested JSON structure where applicable.

---

## API Style Recommendation

Use a screen-scoped internal API rather than one generic “generate course” endpoint.

Suggested pattern:

### GET endpoints
- `GET /api/module8/session`
- `GET /api/module8/screen/:screenId`
- `GET /api/module8/flags`
- `GET /api/module8/blueprint`

### POST endpoints
- `POST /api/module8/start`
- `POST /api/module8/screen/0/acknowledge`
- `POST /api/module8/screen/1/generate`
- `POST /api/module8/screen/2/generate`
- `POST /api/module8/screen/3/generate`
- `POST /api/module8/screen/4/generate`
- `POST /api/module8/screen/5/generate`
- `POST /api/module8/screen/6/generate`
- `POST /api/module8/screen/7/generate`
- `POST /api/module8/screen/8/generate`
- `POST /api/module8/screen/9/assemble`

### PATCH endpoints
- `PATCH /api/module8/screen/:screenId/edit`
- `PATCH /api/module8/screen/:screenId/approve`
- `PATCH /api/module8/screen/:screenId/reopen`

### POST utility endpoints
- `POST /api/module8/screen/:screenId/regenerate`
- `POST /api/module8/screen/:screenId/revise`
- `POST /api/module8/resolve-flags`
- `POST /api/module8/export`

This can be implemented differently, but the behavior should remain screen-scoped and stateful.

---
### Endpoint Semantics

`POST /api/module8/screen/:screenId/generate` runs the full internal lifecycle for that screen:
- creator
- schema validation
- rule-based QC
- assigned validators
- aggregation
- internal revision loop
- recheck

It may run up to the configured maximum of 2 automatic revision loops before returning a final decision:
- `pass`
- `revise_loop_capped`
- `escalate`
- `blocked_by_rule`

`POST /api/module8/screen/:screenId/revise` is **not** part of the automatic internal loop. It is a user-triggered manual revision endpoint used only after escalation or when the user explicitly requests another guided revision pass.

The UI must not call `/revise` to simulate the internal automatic revision loop. Revision-count tracking for the automatic loop lives inside `/generate`.

---

## Canonical Hard Rule Registry

Document 4 defines the hard-rule concepts. This document assigns stable implementation identifiers for coding use.

Use these exact identifiers in step configs, QC execution, logs, and audit payloads.

- `RULE_001_REQUIRE_MODULE_OUTCOME`
  - every module or major section must declare one clear learner outcome

- `RULE_002_MAX_7_MODULES`
  - course blueprint may not exceed 7 modules

- `RULE_003_MAX_6_LESSONS_PER_MODULE`
  - no approved module may exceed 6 lessons at blueprint stage

- `RULE_004_MAX_2_SENTENCE_LESSON_DESCRIPTION`
  - lesson descriptions may not exceed 2 sentences at blueprint stage

- `RULE_005_REJECT_BANNED_HYPE_TERMS`
  - flag or fail titles/descriptions using banned hype terms such as mastering, ultimate, complete, comprehensive where not explicitly allowed

- `RULE_006_REJECT_DUPLICATE_TITLES`
  - reject duplicate or near-duplicate peer titles according to the duplicate detection rules

- `RULE_007_ENFORCE_CLOSED_LISTS`
  - all closed-list fields must use approved enum values only

- `RULE_008_REJECT_OVER_GENERATION`
  - do not generate more modules, lessons, assets, or outputs than the current step allows

- `RULE_009_REQUIRE_ACTIONABLE_LESSON`
  - each lesson or guided section must clearly state what the learner will understand, do, or complete

- `RULE_010_REQUIRE_ASSET_COVERAGE_PER_MODULE`
  - each approved module must include at least 1 and at most 3 implementation assets

- `RULE_011_REJECT_THEORY_ONLY_WHEN_SUPPORT_REQUIRED`
  - explanation-only sections must be flagged when implementation support is clearly required by the product stage

When a future Vocabulary Lock exists, these identifiers must also be registered there. Until then, this section is the implementation source of truth for hard-rule identifiers.

---
## Canonical Decision Thresholds

Use these constants in the decision engine so the coding agent does not need to infer threshold numbers from other documents.

Scoring scale:
- validator overall scores use a 1–10 scale

Default decision thresholds:
- `CRITICAL_FAILURE_BELOW = 6.0`
- `DIRECT_PASS_WEIGHTED_AVERAGE = 8.0`
- `REVISE_BAND_MIN = 7.0`
- `REVISE_BAND_MAX = 7.9`
- `MAX_REVISION_LOOPS_DEFAULT = 2`

Interpretation:
- if any assigned validator returns an overall score below `CRITICAL_FAILURE_BELOW`, the step cannot pass directly
- if weighted average is `>= DIRECT_PASS_WEIGHTED_AVERAGE` and no critical failure or blocking hard-rule failure exists, the step may pass
- if weighted average falls within `REVISE_BAND_MIN` to `REVISE_BAND_MAX`, revise
- if revision loops are exhausted, escalate
- step-specific weight overrides remain allowed where configured

If Document 3 later changes these constants, Document 3 must be updated first and this document must be revised to match. Silent divergence is not allowed.

---

## Step Configuration Model

Each screen should have a config object.

Recommended config fields:
- `screen_id`
- `required_context_fields`
- `creator_prompt_ref`
- `creator_schema_ref`
- `assigned_validators`
- `validator_weights`
- `hard_rules`
- `duplicate_detection_scope`
- `writable_fields`
- `downstream_dependents`
- `regenerate_limit`
- `escalation_rules`

Example:

```json
{
  "screen_id": 5,
  "required_context_fields": [
    "course_transformation_statement",
    "course_depth",
    "delivery_format",
    "chapter_audit"
  ],
  "creator_prompt_ref": "module8/creator/screen_5_course_skeleton",
  "creator_schema_ref": "schemas/module8/screen_5.json",
  "assigned_validators": ["curriculum", "learner_experience", "market"],
  "validator_weights": {
    "curriculum": 0.45,
    "learner_experience": 0.30,
    "market": 0.25
  },
  "weight_override_reason": "Screen 5 is primarily about structural architecture; Curriculum is weighted higher than the global default for this step.",
  "hard_rules": [
    "RULE_002_MAX_7_MODULES",
    "RULE_001_REQUIRE_MODULE_OUTCOME",
    "RULE_006_REJECT_DUPLICATE_TITLES"
  ],
  "duplicate_detection_scope": "module_to_module_within_course",
  "writable_fields": [
    "course_title",
    "module_map",
    "module_outcomes"
  ],
  "downstream_dependents": [6, 7, 8, 9],
  "regenerate_limit": 5,
  "escalation_rules": {
    "max_revision_loops": 2
  }
}
```

---

## Prompt Loading Strategy

The Course Creator Agent must use:
- a shared orchestration shell
- a step-specific system prompt
- a step-specific output schema

Do not use one static creator prompt for all steps.

### Required prompt inputs
Every creator prompt should receive:
- step goal
- approved upstream context only
- user inputs for the current step
- anti-slop rules relevant to the step
- exact output schema
- “do not modify approved upstream values” instruction

### Validator prompts
Every validator prompt should receive:
- current step draft
- approved upstream context summary
- step rubric
- hard rules summary
- scoring instructions
- required response schema

### Reviser prompt
The reviser prompt should receive:
- current failed draft
- validator revision notes
- hard-rule failures
- writable fields only
- read-only context
- explicit instruction not to modify read-only context

Persist prompt version used for every creator, validator, and reviser call.

---

## Schema Validation Strategy

Every screen must have:
- a request schema
- a draft output schema
- an approved output schema if different

Use JSON schema or equivalent strict validation.

Enforce:
- required fields
- types
- enum values
- array sizes
- nullable vs omitted behavior

Schema validation should run:
- immediately after creator output
- immediately after reviser output
- again when assembling final blueprint

If schema validation fails:
- mark as `blocked_by_rule`
- do not send to validators
- return machine-readable validation errors

---

## Rule-Based Precheck Requirements

Before validator calls, the QC engine should run:
- enum validation
- required-field validation
- count limits
- banned-term detection
- duplicate detection
- blueprint compactness checks
- output contract integrity checks

For Module 8 specifically:
- `RULE_002_MAX_7_MODULES`
- `RULE_003_MAX_6_LESSONS_PER_MODULE`
- `RULE_004_MAX_2_SENTENCE_LESSON_DESCRIPTION`
- `RULE_010_REQUIRE_ASSET_COVERAGE_PER_MODULE`
- `RULE_006_REJECT_DUPLICATE_TITLES` within peer sets only
- `RULE_007_ENFORCE_CLOSED_LISTS` for canonical asset types and all other closed lists

---

## Duplicate Detection Implementation

Use:
- normalized cosine similarity on embeddings
- flag if similarity > 0.85

Fallback if embedding service unavailable:
- token-level Jaccard similarity > 0.70

Scope:
- lesson-to-lesson within same module
- module-to-module within same course

Do not compare across unlike levels unless a step config explicitly overrides this.

When duplicate detected:
- flag both items
- instruct reviser to differentiate them
- do not allow deletion without orchestrator approval

---

## Validator Execution Rules

The exact validator assignments come from Document 3.

Implementation rules:
- run assigned validators in parallel
- use step-specific weight override if defined
- otherwise normalize only across assigned validators
- return normalized 1–10 score payloads
- preserve raw validator comments in logs

If any validator call fails:
- retry once if failure is transient
- if still failing, mark step as `escalate`
- do not silently skip a missing validator

---

## Decision Engine

Recommended decision flow:

1. if hard-rule failure exists that blocks progression:
   - decision = `blocked_by_rule`

2. else if validator weighted average >= pass threshold and no critical failure:
   - decision = `pass`

3. else if revision count < max revision loops:
   - decision = `revise`

4. else:
   - decision = `escalate`

Thresholds, critical-failure logic, and weight overrides must match the canonical constants in this document and Document 3.

---

## Revision Runtime Rules

### Enforced writable-only revision
Revision must be structurally constrained.

The reviser receives:
- `writable_fields`
- `read_only_context`
- `validator_notes`
- `hard_rule_failures`

The reviser output must contain only writable fields.

Any attempt to modify read-only fields should be:
- stripped before merge
- logged in audit trail
- included in drift check result

### Merge rule
Do not replace the full draft object unless explicitly authorized.

Instead:
- merge only writable-field changes into existing draft
- preserve all approved upstream context untouched

---

## Drift Check Implementation

Drift check is deterministic, not semantic.

Use the step’s `required_context_fields` from config.

For each required approved upstream field:
- compare revised draft embedded references against approved value using string equality
- if modified, mark `drift_detected`

On drift:
- reject revision
- return instruction: `Do not modify approved upstream values.`
- increment revision count
- log event in audit table

---

## Regenerate Limits

Per Document 2:
- max 5 regenerations per 24-hour rolling window
- limit is per user, per step

If limit exceeded:
- disable regenerate button
- return UI message:
  `"You've regenerated this 5 times today. Try editing manually, or come back tomorrow with fresh eyes."`

This should be enforced server-side, not UI-only.

---

## Downstream Review Flags

When the user edits approved fields that affect later steps, create downstream review flags.

Required warning-trigger fields:
- course_transformation_statement
- course_depth
- delivery_format
- module_map
- lesson_map

Behavior:
- require confirmation dialog before save
- create yellow warning badge on affected downstream steps
- block final blueprint approval if unresolved critical downstream flags remain

---

## Final Blueprint Assembly

Screen 9 should assemble:
- all approved step outputs
- all unresolved downstream flags
- blueprint metadata
- completion status

Before approval or export:
- validate final JSON against final blueprint schema
- validate asset coverage rule
- validate required outputs from all prior screens
- ensure unresolved critical issues are surfaced

Persist:
- final_course_blueprint
- blueprint_version
- module_8_completion_status
- blueprint_approved_at

---

## Logging and Audit Requirements

Log at minimum:
- screen entered
- generation started
- generation completed
- validation completed
- revision started
- revision completed
- approval saved
- reopen triggered
- regenerate used
- drift detected
- downstream flag created
- escalation triggered
- final blueprint assembled
- export triggered

Every audit event should include:
- session_id
- screen_id if applicable
- actor (`user`, `system`, `creator`, `validator`, `reviser`)
- prompt_version if applicable
- payload_ref or hash if useful
- timestamp

---

## Performance and Cost Controls

Recommended safeguards:
- do not send full e-book body to every step if chapter summaries are enough
- cache approved upstream summaries
- run validators only for assigned steps
- store embeddings for duplicate detection reuse where possible
- prefer surgical revision over full regeneration
- avoid multi-model fanout when a step is blocked by hard rule before validation

### Model retry policy

Retry once:
- HTTP 500
- HTTP 502
- HTTP 503
- HTTP 504
- network timeouts
- provider `service_unavailable` errors

Retry with exponential backoff, up to 3 total attempts:
- HTTP 429 rate-limit responses

Do not retry:
- HTTP 400
- HTTP 401
- HTTP 403
- HTTP 413 or token-limit / context-length errors
- content policy violations
- schema validation failures
- invalid enum or output-contract failures
- deterministic hard-rule failures

Backoff behavior for 429:
- attempt 1: immediate failure response captured
- retry 1 after 1 second
- retry 2 after 2 seconds
- retry 3 after 4 seconds
- if still failing, escalate as provider_unavailable_for_step

### Approved upstream summary cache strategy
Approved upstream summaries must be stored in a `session_context_cache_jsonb` column on `module8_sessions`.

Rules:
- cache is scoped to one Module 8 session only
- no cross-session cache sharing
- cache stores summarized approved upstream context used repeatedly across screens
- when any approved step is reopened through `PATCH /api/module8/screen/:screenId/reopen`, the cache must be invalidated
- invalidation means clearing `session_context_cache_jsonb` and rebuilding it lazily on next access
- cache rebuild must use the latest approved step outputs only

---

## Error Handling

### Hard rule failure
Return:
- machine-readable failure codes
- user-readable explanation
- recommended next action

### Validator disagreement
Return:
- decision = `escalate`
- summary of disagreement
- user decision request

### Prompt load failure
Return:
- system error
- do not run fallback ad hoc prompt silently

### Schema mismatch
Return:
- exact field errors
- block progression

### Revision drift
Return:
- `drift_detected`
- preserve prior approved state
- request corrected revision

---

## Implementation Priority Order

Build in this order:

### Phase 1
- persistence tables
- screen configs
- schema validator
- Screen 0 to Screen 3 happy path

### Phase 2
- Screen 4 to Screen 6 creator flow
- rule-based QC
- validator runtime
- decision engine

### Phase 3
- reviser runtime
- drift check
- downstream review flags
- Screen 7 and Screen 8

### Phase 4
- Screen 9 final assembly
- export logic
- audit logs
- analytics hooks

### Phase 5
- prompt version dashboard
- replay/debug tooling
- product-type reuse abstractions

---

## Minimum Definition of Done

Module 8 is not done until all of these are true:

1. user can complete Screen 0 through Screen 9 in order
2. unlock and orientation behavior works
3. each screen uses step-specific prompt + schema
4. schema validation blocks invalid output
5. validators run in parallel where assigned
6. revision loops are capped and enforced
7. writable-only revision is enforced
8. drift detection works deterministically
9. downstream review flags appear correctly
10. asset coverage rule is enforced
11. final blueprint assembly validates successfully
12. logs are sufficient to replay a failed run

---

## Final Summary

The coding agent should treat Module 8 as a stateful workflow engine, not a one-shot generator.

Build it as:
- step-scoped
- schema-driven
- validation-first
- revision-controlled
- audit-friendly
- modular for future reuse

But the user-facing scope remains simple:
**Turn Your E-book Into a Course**
