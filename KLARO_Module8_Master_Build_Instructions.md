# KLARO Module 8 Build Instruction for Coding Agent

## Mission

Build **KLARO Module 8: Turn Your E-book Into a Course** as a production-ready, stateful workflow engine based on the documents in the working folder.

This is **not** a one-shot course generator.
This is a **screen-based, schema-driven, multi-agent workflow** that:
- reads prior approved student work
- guides the user through Module 8
- generates step-specific outputs
- validates them through the QC pipeline
- revises within capped loops
- persists approved state
- assembles a final course blueprint

Do not simplify the architecture into one prompt or one endpoint.
Do not replace the workflow with a generic chat experience.
Do not invent fields, enums, states, or rule IDs that are not in the documents.

---

## Source of Truth Documents

Use these files from the working folder as the only build source of truth:

1. `01_Master_System_Handoff_Module8_Course_Expansion_v4.md`
2. `02_Product_Flow_and_UX_Spec_Module8_Course_Expansion_v4.md`
3. `03_Agent_and_Orchestration_Architecture_Module8_Course_Expansion_v5.md`
4. `04_Reusable_Quality_Control_Pipeline_v5.md`
5. `05_Technical_Implementation_Spec_v6.md`
6. `Appendix_A_Worked_Example_v3.md`

### Precedence rules
If documents conflict, use this order:
- Appendix A wins on **screen output JSON shape examples**
- Document 5 wins on **technical implementation and persistence**
- Document 3 wins on **orchestration, validator logic, scoring, thresholds**
- Document 2 wins on **screen flow and user-facing behavior**
- Document 4 wins on **QC concepts and reusable validation rules**
- Document 1 wins on **product philosophy and scope**

If you detect a real conflict during implementation, do **not** silently improvise.
Create a short `IMPLEMENTATION_NOTE.md` in the working folder describing:
- the conflicting files/sections
- the exact conflict
- the safe resolution you chose
- why

---

## Product Scope

Build **Module 8 only**.

### Module title
**Turn Your E-book Into a Course**

### User-facing scope
Course creation only.
Do not build:
- workshop builder
- webinar builder
- coaching program builder
- live event builder

### Backend architecture
You may structure the QC and agent runtime for future reuse, but do not expand current UI scope beyond course creation.

---

## Non-Negotiable Build Rules

1. **Use the 10-screen model**
   - pre-screen unlock check
   - Screen 0 through Screen 9

2. **Use step-scoped generation**
   - one screen
   - one prompt family
   - one schema
   - one validation cycle

3. **Persist state in the database**
   - do not rely on chat memory
   - do not rely on prompt history for source of truth

4. **Approved upstream state is read-only**
   - unless user explicitly reopens and re-approves earlier screens

5. **Automatic revision loops are internal**
   - `/generate` runs creator → validate → revise → recheck
   - `/revise` is only for user-triggered manual revision after escalation

6. **No one-shot generation**
   - do not build a “generate full course” endpoint

7. **Status-on-row naming model**
   - persisted payload field names do **not** use `approved_` prefixes
   - approval state is tracked by row status, versions, timestamps, and audit metadata

8. **Do not invent closed-list values**
   - enums must exactly match the documents

9. **Do not invent rule identifiers**
   - use the canonical hard-rule IDs from Document 5

10. **Do not bypass validation**
   - no screen should move from creator output directly to approved state without the defined QC flow

---

## What You Must Build

## A. Screen Flow
Implement the full Module 8 flow:

- Pre-screen: Unlock Check
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

## B. Orchestrator
Build an orchestrator service that:
- verifies unlock status
- persists Screen 0 acknowledgment
- resolves required context per screen
- loads screen config
- runs creator
- runs schema validation
- runs QC prechecks
- runs assigned validators in parallel
- aggregates results
- triggers automatic revision loops
- runs drift checks
- persists draft and approved state
- applies downstream review flags
- escalates when needed

## C. Prompt Loader
Load prompts from a structured prompt library.
Do not hardcode one giant creator prompt.

Use step-specific prompt files for:
- creator
- validators
- reviser

Persist prompt version per run.

## D. Schema Validation
Every screen must have strict schemas for:
- request payload
- draft output
- approved output where applicable

Schema validation must block progression on failure.

## E. QC Engine
Implement:
- hard rule checks
- output contract checks
- duplicate detection
- anti-slop checks
- drift detection
- decision logic

## F. Revision Runtime
Enforce:
- writable fields only
- read-only context protection
- merge only writable changes
- reject drifted revisions

## G. Final Blueprint Assembly
Assemble Screen 9 into:
- `final_course_blueprint`
- `blueprint_version`
- `module_8_completion_status`
- `blueprint_approved_at`

---

## Required Technical Behaviors

## 1. Required Context Resolution
Implement a shared helper:

`resolveRequiredContext(sessionId, fieldNames[])`

It must:
- query `module8_step_outputs`
- filter to `status = 'approved'`
- read from `approved_payload_jsonb`
- extract only requested fields
- fail fast if required fields are missing
- record source screen for debugging
- prefer latest approved version

Do not resolve context from prompt history.

## 2. Hashing
For `read_only_context_hash`, use:
- SHA-256
- canonical JSON serialization
- object keys sorted alphabetically at every level
- no whitespace
- UTF-8 encoding
- preserve array order
- use stable serializer
- do **not** use native `JSON.stringify()`

## 3. Retry Policy
Implement exactly:

### Retry once
- HTTP 500
- HTTP 502
- HTTP 503
- HTTP 504
- network timeouts
- provider `service_unavailable` errors

### Retry with exponential backoff, up to 3 attempts
- HTTP 429

### Do not retry
- HTTP 400
- HTTP 401
- HTTP 403
- HTTP 413
- token/context length errors
- content policy violations
- schema validation failures
- invalid enum values
- output-contract failures
- deterministic hard-rule failures

## 4. Regenerate Limits
Per user, per step:
- max 5 regenerations
- rolling 24-hour window
- enforce server-side

Disabled message:
> You've regenerated this 5 times today. Try editing manually, or come back tomorrow with fresh eyes.

## 5. Downstream Review Flags
When user edits certain upstream approved fields, require confirmation and flag affected downstream steps with yellow warning badges.

## 6. Blueprint Versioning
- starts at `1` on first successful Screen 9 assembly
- increments by `1` each time a previously approved upstream screen is reopened and then re-approved
- does not increment on view, re-read, or export
- surface version in UI

---

## Canonical States

Use only these decision states:
- `pass`
- `revise`
- `escalate`
- `blocked_by_rule`

Do not implement `pass_with_notes`.

---

## Canonical Scoring Model

Use the 1–10 validator scale and thresholds already locked in the docs.

Default constants:
- `CRITICAL_FAILURE_BELOW = 6.0`
- `DIRECT_PASS_WEIGHTED_AVERAGE = 8.0`
- `REVISE_BAND_MIN = 7.0`
- `REVISE_BAND_MAX = 7.9`
- `MAX_REVISION_LOOPS_DEFAULT = 2`

Use step-specific weight overrides where defined.

---

## Canonical Hard Rule Identifiers

Use these exact rule IDs:

- `RULE_001_REQUIRE_MODULE_OUTCOME`
- `RULE_002_MAX_7_MODULES`
- `RULE_003_MAX_6_LESSONS_PER_MODULE`
- `RULE_004_MAX_2_SENTENCE_LESSON_DESCRIPTION`
- `RULE_005_REJECT_BANNED_HYPE_TERMS`
- `RULE_006_REJECT_DUPLICATE_TITLES`
- `RULE_007_ENFORCE_CLOSED_LISTS`
- `RULE_008_REJECT_OVER_GENERATION`
- `RULE_009_REQUIRE_ACTIONABLE_LESSON`
- `RULE_010_REQUIRE_ASSET_COVERAGE_PER_MODULE`
- `RULE_011_REJECT_THEORY_ONLY_WHEN_SUPPORT_REQUIRED`

Do not rename them.

---

## Canonical Duplicate Detection Behavior

Use:
- normalized cosine similarity on embeddings
- flag if similarity > 0.85
- fallback to token-level Jaccard similarity > 0.70 if embeddings unavailable

Scope:
- lesson-to-lesson within same module
- module-to-module within same course

When duplicate detected:
- flag both items
- reviser must differentiate them
- no deletion without orchestrator approval

---

## Canonical Asset Rules

Use the canonical asset list only:
- `video`
- `text_lesson`
- `worksheet`
- `checklist`
- `prompt_pack`
- `template`
- `tracker`
- `audio_guide`
- `script_card`
- `demo_walkthrough`
- `case_study`
- `faq`

Screen 7 rule:
- every approved module must have at least 1 asset
- every approved module may have at most 3 assets

---

## What Not to Do

Do not:
- collapse the system into one AI call
- hardcode the worked example student or niche
- invent friendly fallback enums
- silently skip validator failures
- silently downgrade hard-rule failures to warnings
- let the reviser rewrite read-only context
- use exact-string duplicate detection only
- store approval state in field names
- use prompt history as the source of truth
- expose internal automatic revision loop as repeated UI calls
- improvise a different state machine

---

## Build Order

Implement in this order:

### Phase 1
- database tables / persistence objects
- screen config system
- schema validator
- unlock check
- Screen 0 to Screen 3 happy path

### Phase 2
- Screen 4 to Screen 6
- QC precheck engine
- validator runtime
- decision engine

### Phase 3
- reviser runtime
- drift check
- downstream review flags
- Screen 7 and Screen 8

### Phase 4
- Screen 9 final assembly
- export path
- audit logs
- prompt version tracking

### Phase 5
- replay/debug tooling
- prompt dashboard
- internal implementation notes
- future reuse abstractions

---

## Required Deliverables

Create these deliverables in the working folder:

1. working codebase for Module 8
2. `README_MODULE8_BUILD.md`
   - how to run
   - routes
   - env vars
   - prompt file locations
   - schema file locations

3. `SCHEMA_INDEX.md`
   - list every schema file
   - what screen it belongs to
   - request vs output schemas

4. `PROMPT_INDEX.md`
   - every creator prompt
   - every validator prompt
   - reviser prompt(s)
   - versioning strategy

5. `IMPLEMENTATION_NOTE.md`
   - only if you hit document ambiguity or conflict
   - list exact resolutions made

6. `OPEN_QUESTIONS.md`
   - only for unresolved items that truly require human decision
   - do not put solvable engineering work here

---

## Definition of Done

Module 8 is only done when:
- all screens work in order
- unlock + Screen 0 behavior works
- each screen uses the correct prompt + schema + validator path
- automatic revision loops are internal and capped
- schema validation blocks invalid outputs
- hard rules fire correctly
- writable-only revision is enforced
- drift detection works
- downstream review flags work
- Screen 9 assembles valid final blueprint
- logs are sufficient to replay failures
- no part of the system depends on the worked example content

---

## Final Instruction

Build this like a serious internal product, not a prototype toy.

The system should feel:
- deterministic where it must be
- flexible where it should be
- strict against slop
- safe against drift
- reusable later
- simple for the user

User-facing simplicity.
Backend rigor.

That is the goal.
