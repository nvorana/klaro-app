# Module 8 — Implementation Notes

Real conflicts between the source documents and the resolutions applied during Phase 1a implementation. Per the build instruction precedence rules.

---

## Conflict 1 — `pass_with_notes` state

**Source conflict:**
- Document 4 (Reusable QC Pipeline) lists `pass_with_notes` as a standard result state.
- Master Build Instructions say "Do not implement `pass_with_notes`".

**Resolution:** Canonical 4 states only — `pass`, `revise`, `escalate`, `blocked_by_rule`. Build Instructions win per precedence.

**Implementation:** Encoded in `lib/module8/types.ts` `DecisionState` type.

---

## Conflict 2 — `approved_` field prefix in persisted payloads

**Source conflict:**
- Document 2 mentions output fields with `approved_` prefix (e.g. `approved_course_audience`).
- Document 5 + Master Build Instructions use status-on-row model — no `approved_` prefix on payload fields.

**Resolution:** Status-on-row model wins. Persisted JSONB payload field names use bare names (e.g. `course_audience`). Approval state is tracked via the row's `status`, `approved_version`, and `approved_at` columns on `module8_step_outputs`.

**Implementation:** Persistence code in `lib/module8/persistence.ts` follows this convention.

---

## Conflict 3 — Screen 1 questionnaire fields

**Source conflict:**
- Document 2 lists 5 questions: ebook_finished, ebook_sold, why_course_now, course_purpose, time_energy.
- Appendix A lists 5 different-named fields: `ebook_finished_status`, `ebook_sales_signal`, `buyer_feedback_signal`, `audience_pull_signal`, `time_energy_next_6_weeks`.

**Resolution:** Appendix A wins on JSON field names (per precedence rules). The UI will render Doc 2's question-style prompts while mapping answers to Appendix A's field names for persistence.

**Implementation:** Deferred to Phase 1b (Screen 1 build).

---

## Conflict 4 — Duplicate `pass` in Doc 5 step lifecycle

**Source:** Document 5 step 8 reads: "decide `pass`, `pass`, `revise`, `escalate`, or `blocked_by_rule`".

**Resolution:** Typo in the source. Canonical 4 states apply.

---

## Conflict 5 — Screen 1 Creator Agent involvement

**Source conflict:**
- Document 3 says Creator + Validators run for Screen 1.
- Appendix A shows Screen 1 output as just readiness score + verdict (no creator-produced prose).

**Resolution:** Screen 1 uses **deterministic scoring** to compute `readiness_score`, `readiness_verdict`, and `recommended_next_path`. The **Creator Agent** generates the `coach_notes` free-text explanation only. Validators review the coach_notes for coherence.

**Implementation:** Deferred to Phase 1b (Screen 1 build).

---

## Conflict 6 — Minimum-days-since-enrollment unlock condition

**Source conflict:**
- Document 1 recommends 60 days since enrollment.
- Document 2 says "optionally delayed by time or coach approval".
- Appendix A shows `enrolled_at was 97 days ago (≥ 60 days) ✓` — treating it as passed.

**Resolution:** Implemented as a **soft rule** gated by an environment variable. Default is OFF. Can be enabled later without a code change.

**Implementation:** Currently not enforced in `lib/module8/unlock.ts` (Phase 1a). Will be added in Phase 1b if requested via `process.env.MODULE8_MIN_DAYS_SINCE_ENROLLMENT`.

---

## Decisions made by the user (2026-04-22)

1. **Feature flag for specific accounts first** — manual flagging initially via `module8_beta` column on `profiles`. Admin-only toggle endpoint at `POST /api/admin/module8-beta`.

2. **New access tier `tier4`** added for Module 8. Access level check permits `full_access`, `tier3`, and `tier4`.

3. **Admin-only unlock override** — coaches (including Edgar) cannot override unlock. Only admin role.

4. **Dashboard card: appears locked for everyone** except admin + users with `module8_beta = true` who have completed Modules 1-7. Admin always sees it unlocked.

5. **Advisory only** on Screen 1 readiness verdicts — never hard-block a user with `not_ready` verdict. They can proceed at their own risk.

6. **Default model:** GPT-4o everywhere (Creator + Validators + Reviser) for consistency with the rest of the app. Revisit cost model after initial release.
