# KLARO Module 8 — Build Plan

**Status:** Plan. No code written yet. Awaiting approval.
**Target:** Production-ready stateful course-architecture builder integrated into the existing KLARO app.
**Date:** 2026-04-22

---

## Executive Summary

Module 8 is a **stateful, schema-driven, validator-backed workflow engine** that helps eligible KLARO students turn their existing e-book foundation into a structured course blueprint. It is NOT a one-shot course generator.

Core traits:
- 10 screens, each with its own prompt + schema + validator assignment
- 3 LLM validators running in parallel per step (Curriculum, Learner Experience, Market)
- 1 Orchestrator + 1 Creator + 1 Reviser agent
- 11 named hard rules, deterministic duplicate detection, drift protection
- 7 new database tables for session state, drafts, approvals, validation runs, revisions, flags, and audit log
- ~30 new API endpoints, ~20 prompt files, ~20 JSON schemas

**Total estimated scope:** substantial. Multiple phases over multiple sessions. Does NOT touch any existing KLARO code paths (Modules 1-7 unaffected).

---

## Architectural Decisions

### 1. AI Provider
**Decision:** Use OpenAI GPT-4o for Creator, Validators, and Reviser (matches rest of KLARO app).
**Rationale:** Single provider = simpler ops, auth, cost tracking, rate limits. No reason to split between Claude and GPT-4o for a feature this size.
**Open question (answer later if needed):** Could switch validators to cheaper GPT-4o-mini if cost becomes an issue. Deferred.

### 2. Embeddings (for duplicate detection)
**Decision:** Use OpenAI `text-embedding-3-small` for cosine similarity. Fallback to token-level Jaccard if the embedding API call fails.
**Rationale:** Already an OpenAI account; cheap; strict spec requires both with fallback semantics.

### 3. Database
**Decision:** Supabase (same as rest of app). New migration adds 7 new tables in one file.
**RLS:** Students can only read their own rows; admins can read all; no write access except through the API (API uses admin client to bypass RLS).
**Rationale:** Same security model as Modules 1-7.

### 4. Unlock Policy
**Decision:** Module 8 is gated by the following (all must be true):
- `access_level` in `('full_access', 'tier3')`
- All 7 prior modules have non-null `completed_at` in `module_progress`
- Admin/coach override always available via a row in `module8_sessions` with `unlock_status: 'override'`

**NOT gated by:** 60 days since enrollment. This was a Doc 1 recommendation, not a hard requirement. Easy to add later as a config flag if needed.

**UI treatment:** Module 8 appears on dashboard as a locked card ("Complete Modules 1-7 to unlock") until eligible.

### 5. Code Organization
**Decision:** Mirror the existing app structure, not the spec's suggested `/module8` folder.

The spec says:
```
/module8/orchestrator
/module8/creator
...
```

But KLARO's existing pattern is:
```
app/api/module8/screen/[screenId]/generate/route.ts
app/module/8/page.tsx
lib/module8/orchestrator.ts
lib/module8/validators/curriculum.ts
...
```

**Rationale:** Next.js App Router conventions. Consistency with rest of app. Lets existing middleware and auth patterns apply for free.

### 6. UI Theme
**Decision:** Light theme to match Modules 1-7 (`bg-[#F8F9FA]`, white cards, gold accents).

### 7. Schema Validation Library
**Decision:** Use `zod` (TypeScript-native, already dev-friendly).
**Rationale:** JSON Schema would work too but zod is easier to author and maintain in TypeScript. Output is still schema-verifiable JSON.

### 8. Prompt Loading
**Decision:** Prompts live as markdown files in `prompts/module8/`. Loaded at runtime via `fs.readFile`. Version is derived from content hash.
**Rationale:** Keeps prompts version-controlled in git; no separate database table needed.

### 9. Canonical JSON Serialization (for read_only_context_hash)
**Decision:** Implement a small helper using an npm package like `json-stable-stringify` with SHA-256 via Node's `crypto` module. Exact spec: object keys sorted alphabetically at every level, UTF-8, no whitespace, arrays preserve order.
**Rationale:** Spec is explicit. Cannot use native `JSON.stringify`.

### 10. Regenerate Limits
**Decision:** Enforce server-side via a `module8_regenerations` table or a derived count from the audit log.
**Likely implementation:** Derive from `module8_audit_log` where `event_type = 'regenerate_used'` AND `created_at > NOW() - INTERVAL '24 hours'`. Cheaper than a new table.

---

## Database Migration

New file: `migrations/YYYYMMDD_create_module8_tables.sql`

**7 new tables** per the spec. Schema summary:

### `module8_sessions`
- One row per user per Module 8 attempt
- Fields: `id`, `user_id`, `module8_status`, `unlock_status`, `unlock_reason`, `current_screen`, `blueprint_version`, `session_context_cache_jsonb`, `started_at`, `updated_at`, `completed_at`
- Enums: `module8_status ∈ ('active', 'paused', 'completed', 'abandoned')`, `unlock_status ∈ ('locked', 'unlocked', 'override')`
- Indexes: `(user_id)` unique for active sessions, `(user_id, updated_at)`

### `module8_step_outputs`
- One row per `(session_id, screen_id, version)`
- Fields: `id`, `session_id`, `screen_id`, `draft_version`, `approved_version`, `draft_payload_jsonb`, `approved_payload_jsonb`, `status`, `revision_count`, `prompt_version`, `created_at`, `updated_at`, `approved_at`
- Enums: `status ∈ ('draft', 'validating', 'revising', 'passed', 'escalated', 'blocked_by_rule', 'approved')`
- Indexes: `(session_id, screen_id)`

### `module8_validator_runs`
- Fields: `id`, `session_id`, `screen_id`, `draft_version`, `validator_name`, `score_payload_jsonb`, `hard_rule_failures_jsonb`, `warnings_jsonb`, `recommended_action`, `created_at`
- Enums: `validator_name ∈ ('curriculum', 'learner_experience', 'market')`
- Indexes: `(session_id, screen_id, draft_version)`

### `module8_qc_runs`
- Fields: `id`, `session_id`, `screen_id`, `draft_version`, `rule_results_jsonb`, `schema_results_jsonb`, `duplicate_results_jsonb`, `drift_results_jsonb`, `final_decision`, `created_at`

### `module8_revision_runs`
- Fields: `id`, `session_id`, `screen_id`, `source_draft_version`, `revision_index`, `writable_fields_jsonb`, `read_only_context_hash` (SHA-256 hex), `revision_output_jsonb`, `merge_result_jsonb`, `created_at`

### `module8_downstream_flags`
- Fields: `id`, `session_id`, `source_screen_id`, `affected_screen_id`, `trigger_field`, `flag_status`, `created_at`, `resolved_at`
- Enums: `flag_status ∈ ('open', 'resolved')`

### `module8_audit_log`
- Append-only. Fields: `id`, `session_id`, `event_type`, `event_payload_jsonb`, `created_at`

All tables have RLS enabled. Students get `SELECT` on their own rows; all writes go through admin client.

---

## File Structure to Build

```
klaro-app/
├── migrations/
│   └── 20260422_create_module8_tables.sql
├── prompts/
│   └── module8/
│       ├── creator/
│       │   ├── screen_1_readiness.md
│       │   ├── screen_2_transformation.md
│       │   ├── screen_3_course_type.md
│       │   ├── screen_4_chapter_audit.md
│       │   ├── screen_5_course_skeleton.md
│       │   ├── screen_6_lesson_map.md
│       │   ├── screen_7_implementation_layer.md
│       │   └── screen_8_student_experience.md
│       ├── validators/
│       │   ├── curriculum.md
│       │   ├── learner_experience.md
│       │   └── market.md
│       └── reviser/
│           └── default.md
├── lib/
│   └── module8/
│       ├── types.ts                  // shared types + enums
│       ├── config.ts                 // step configs, constants, hard rule IDs
│       ├── schemas/                  // zod schemas per screen
│       │   ├── screen_0.ts
│       │   ├── screen_1.ts
│       │   ├── ... (one per screen)
│       │   └── blueprint.ts          // Screen 9 assembly schema
│       ├── orchestrator.ts           // main workflow engine
│       ├── creator.ts                // Creator agent runtime
│       ├── validators/
│       │   ├── curriculum.ts
│       │   ├── learner_experience.ts
│       │   ├── market.ts
│       │   └── run.ts                // parallel execution helper
│       ├── reviser.ts                // Reviser agent runtime
│       ├── qc/
│       │   ├── hardRules.ts          // RULE_001..RULE_011 implementations
│       │   ├── duplicateDetection.ts
│       │   ├── drift.ts
│       │   └── index.ts              // QC engine aggregator
│       ├── context.ts                // resolveRequiredContext helper
│       ├── hash.ts                   // canonical SHA-256 helper
│       ├── promptLoader.ts
│       ├── persistence.ts            // DB read/write helpers
│       ├── decisions.ts              // pass/revise/escalate/blocked_by_rule logic
│       └── blueprint.ts              // Screen 9 assembly
├── app/
│   ├── api/
│   │   └── module8/
│   │       ├── session/route.ts      // GET, POST
│   │       ├── screen/[screenId]/
│   │       │   ├── generate/route.ts
│   │       │   ├── revise/route.ts
│   │       │   ├── regenerate/route.ts
│   │       │   ├── edit/route.ts
│   │       │   ├── approve/route.ts
│   │       │   └── reopen/route.ts
│   │       ├── flags/route.ts
│   │       ├── resolve-flags/route.ts
│   │       ├── blueprint/route.ts
│   │       └── export/route.ts
│   └── module/
│       └── 8/
│           ├── page.tsx              // wrapper / unlock check
│           ├── orientation/page.tsx  // Screen 0
│           ├── readiness/page.tsx    // Screen 1
│           ├── transformation/page.tsx
│           ├── course-type/page.tsx
│           ├── chapter-audit/page.tsx
│           ├── course-skeleton/page.tsx
│           ├── lesson-map/page.tsx
│           ├── implementation-layer/page.tsx
│           ├── student-experience/page.tsx
│           └── blueprint/page.tsx    // Screen 9
└── docs/
    ├── README_MODULE8_BUILD.md
    ├── SCHEMA_INDEX.md
    ├── PROMPT_INDEX.md
    ├── IMPLEMENTATION_NOTE.md
    └── OPEN_QUESTIONS.md
```

---

## Build Phases

### Phase 1: Foundation + Happy Path (Screens 0-3)
**Goal:** Get the skeleton running end-to-end for the first 4 screens. No validators yet — pure schema + creator.
**Deliverables:**
- Database migration (all 7 tables)
- Session API + unlock check
- Step config system
- Schema validator (zod)
- Prompt loader
- Creator runtime
- Orchestrator shell (without QC/revision)
- Screen 0 (orientation) UI + API
- Screen 1 (readiness) UI + API + scoring logic
- Screen 2 (transformation) UI + API
- Screen 3 (course type) UI + API
- Basic audit logging

**Verification:** User can go from dashboard → orientation → readiness → transformation → course type. Each step persists state. No validators yet, so every draft auto-approves.

### Phase 2: QC + Validators (Screens 4-6)
**Goal:** Add the QC engine, all 3 validators, decision engine, and 3 more screens.
**Deliverables:**
- Hard rule implementations (RULE_001 to RULE_011)
- Duplicate detection (embeddings + Jaccard fallback)
- 3 validators (Curriculum, Learner Experience, Market)
- Parallel validator runner
- Decision engine (pass/revise/escalate/blocked_by_rule)
- Retrofit Screens 1-3 to use the QC engine
- Screen 4 (chapter audit)
- Screen 5 (course skeleton)
- Screen 6 (lesson map)

**Verification:** Hard rules fire correctly. Validators return scored JSON payloads. Decision engine correctly escalates, revises, or passes.

### Phase 3: Revision + Drift + Downstream Flags (Screens 7-8)
**Goal:** Complete the revision loop, drift detection, and downstream flag system.
**Deliverables:**
- Reviser runtime (writable-field enforcement, read-only merge)
- Drift check (deterministic string equality on approved upstream values)
- Canonical SHA-256 hashing
- Downstream flag creation on upstream edits
- Warning dialogs / yellow badges in UI
- Screen 7 (implementation assets)
- Screen 8 (student experience)
- Regenerate limit enforcement (server-side, rolling 24h)

**Verification:** Edits to approved upstream fields show confirmation dialog, create flags, show warning badges on downstream screens. Revision preserves read-only context. Drift is detected and rejected.

### Phase 4: Blueprint Assembly + Polish (Screen 9)
**Goal:** Final assembly, export, versioning, audit completeness.
**Deliverables:**
- Screen 9 assembly (no creator — pure orchestrator)
- Blueprint version tracking (starts at 1, increments on re-approval)
- Blueprint schema validation
- Asset coverage check (every module has 1-3 assets)
- Unresolved flags block approval
- Export endpoint
- Audit log completeness review
- Final docs (README, SCHEMA_INDEX, PROMPT_INDEX)

**Verification:** End-to-end flow. Upstream edit → re-approval → blueprint version increments. Export works.

### Phase 5: Hardening + Observability (Optional)
- Replay/debug tooling
- Prompt dashboard
- Reuse abstractions for future workshop/webinar builders

**Recommendation:** Skip Phase 5 for now. Ship Phases 1-4.

---

## Estimated Effort

Honest estimate for a build done correctly:
- **Phase 1:** ~4-6 hours (migration, scaffolding, 4 screens without QC)
- **Phase 2:** ~5-7 hours (QC engine, 3 validators, decision engine, 3 more screens)
- **Phase 3:** ~4-5 hours (reviser, drift, flags, 2 more screens)
- **Phase 4:** ~3-4 hours (blueprint, export, docs)

**Total:** 16-22 hours of focused implementation, verified per phase.

If we squeeze, we can ship Phase 1 in a single long session, then pause for review. Each phase should be committed separately.

---

## Deliverables Per Build Instructions

These must exist at the end (from the master build instructions):
1. ✅ Working codebase for Module 8
2. ✅ `README_MODULE8_BUILD.md` (how to run, routes, env vars, prompt locations, schema locations)
3. ✅ `SCHEMA_INDEX.md` (every schema, what screen, request vs output)
4. ✅ `PROMPT_INDEX.md` (every creator/validator/reviser prompt, versioning)
5. ✅ `IMPLEMENTATION_NOTE.md` (covered below — real conflicts exist)
6. ✅ `OPEN_QUESTIONS.md` (real items needing your decision)

---

## Precedence-Based Conflict Resolutions (IMPLEMENTATION_NOTE.md draft)

I found 6 real conflicts during the read. Here's how I propose to resolve each:

### Conflict 1: `pass_with_notes` state
- **Doc 4** lists `pass_with_notes` as a standard result state
- **Build Instructions** say "Do not implement `pass_with_notes`"
- **Resolution:** Build Instructions win. Canonical states are `pass`, `revise`, `escalate`, `blocked_by_rule`.

### Conflict 2: Field naming — `approved_` prefix
- **Doc 2** lists output fields like `approved_course_audience`, `approved_course_result`
- **Doc 5 and Build Instructions** say "persisted payload field names do NOT use `approved_` prefixes"
- **Resolution:** Doc 5 + Build Instructions win. Persisted fields use `course_audience`, `course_result`, etc. Approval is tracked via row status.

### Conflict 3: Screen 1 questionnaire
- **Doc 2** lists 5 questions: ebook_finished, ebook_sold, why_course_now, course_purpose, time_energy
- **Appendix A** lists 5 different-named fields: ebook_finished_status, ebook_sales_signal, buyer_feedback_signal, audience_pull_signal, time_energy_next_6_weeks
- **Resolution:** The questions don't fully match but the scoring structure is the same (5 x 0-2 = 0-10). Appendix A wins on JSON shape per precedence rules. I'll use Appendix A's field names. The UI question copy will be mapped to those field names.

### Conflict 4: "pass" appears twice in Doc 5 step lifecycle
- Doc 5 step 8 reads: "decide `pass`, `pass`, `revise`, `escalate`, or `blocked_by_rule`"
- **Resolution:** Typo. Canonical 4 states.

### Conflict 5: Screen 1 creator involvement
- **Doc 3** says Creator + Validators run for Screen 1
- **Appendix A** shows Screen 1 output as just readiness score + verdict (no creator output)
- **Resolution:** Screen 1 uses deterministic scoring to compute `readiness_score`, `readiness_verdict`, `recommended_next_path`. Creator generates the `coach_notes` free-text explanation. Validators review the coach_notes for coherence. This matches Doc 3 (creator runs) and Appendix A (the fields that get persisted).

### Conflict 6: Minimum days since enrollment for unlock
- **Doc 1** recommends 60 days
- **Doc 2** preferred default: "unlocked after Modules 1 to 7 are completed, optionally delayed by time or coach approval"
- **Appendix A** shows `enrolled_at was 97 days ago (≥ 60 days) ✓`
- **Resolution:** Implement as a **soft rule** with an environment flag `MODULE8_MIN_DAYS_SINCE_ENROLLMENT` (default: `0`, i.e., off). Can turn on via env var without code change. Admin override always wins.

---

## Open Questions Requiring Your Decision (OPEN_QUESTIONS.md draft)

### Q1: Who should have access to Module 8 first?
The spec recommends gating by completed modules + access level. But right now you have:
- 3 active AP students
- ~50 TOPIS students
- 10+ pending accounts

**Options:**
- (a) Ship Module 8 to EVERYONE who has completed Modules 1-7, AP + TOPIS
- (b) Ship to AP students only (smaller test group)
- (c) Ship with a feature flag `MODULE8_ENABLED_USER_IDS` so only specific accounts (you + 1-2 beta testers) see it until you approve for general release

**My recommendation:** (c) for Phase 1-2 build. Switch to (a) or (b) once you've tested end-to-end.

### Q2: What price tier should Module 8 require?
Currently the access levels are: `pending`, `enrolled`, `tier1` (1 module), `tier2` (4 modules), `tier3` (7 modules), `full_access` (7 modules).

Module 8 is an advanced, high-value feature. Should it be:
- (a) Included in `full_access` only
- (b) Included in `tier3` and `full_access`
- (c) A NEW tier `tier4` specifically for Module 8
- (d) A one-time purchase / tag from Systeme.io that unlocks it independently

**My recommendation:** (b) for now. Revisit once you have pricing strategy for it.

### Q3: Should coach-approved AP students also have access regardless of their module completion?
Edgar might want to unlock Module 8 for his AP students who skipped ahead or are exceptional.

**Recommendation:** Yes. Add `coach_override: boolean` on the session. Coach can set via the existing coach dashboard.

### Q4: Where should Module 8 appear in the UI?
- (a) As module card #8 on the main dashboard (below Module 7)
- (b) A separate "Advanced" section on the dashboard
- (c) Hidden until unlocked, then appears as a banner

**My recommendation:** (a) — visible but locked card, consistent with Modules 1-7 pattern.

### Q5: Should Screen 1's readiness scoring block progression if they score "Not Ready"?
- (a) Hard block — if not_ready, cannot proceed, must improve e-book first
- (b) Advisory warning — user can proceed at their own risk
- (c) Escalate to coach — Edgar gets notified

**Recommendation:** (b) for now. We can't paternalistically lock out paying students.

### Q6: Cost guardrails
Each screen runs 1 creator call + 2-3 validator calls. If a student fully generates all 8 creator screens with 2-3 validators each and 2 revisions on average, that's potentially 40+ GPT-4o calls per completed Module 8 session. At ~$0.03 per call, that's ~$1.20 per student.

- (a) Accept it as a cost of advanced users
- (b) Switch validators to GPT-4o-mini ($0.002 per call) — saves ~$1 per student
- (c) Add budget alerts

**Recommendation:** (a) for initial release. Revisit after first 10 sessions.

---

## Next Steps

**This is the stop point.** I have not written any code.

To proceed, I need:
1. Confirmation the plan is acceptable
2. Answers to Q1-Q6 above (or "use your defaults")
3. Go-ahead for Phase 1

Once approved, I'll:
1. Create IMPLEMENTATION_NOTE.md (final) and OPEN_QUESTIONS.md (final) with your answers
2. Start Phase 1: database migration, scaffolding, Screens 0-3 happy path
3. Commit at end of Phase 1 with working build
4. Pause for your review before Phase 2

**No code will be written until you say go.**
