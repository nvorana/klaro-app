# Module 8 — Open Questions

Items that were not fully resolved during spec review and require a human decision at some point. Items that can be resolved via implementation alone are not listed here.

---

## Deferred to later phases

### Q1 — Coach visibility of student Module 8 work

Module 8 spec does not specify whether Edgar should be able to view a student's Module 8 work (e.g., their course blueprint) like he can view their Modules 1-7 outputs today.

**Proposed default:** Yes, extend the `/coach/[studentId]` view to show Module 8 progress + blueprint for AP students. Flag for future phase.

**Status:** Not blocking Phase 1. Revisit after blueprint assembly is built.

---

### Q2 — Regeneration count shared with external sessions?

If a user starts Module 8, logs out, and another device starts a new session, do they share the 5-per-24h regenerate budget or is it per session?

**Proposed default:** Per-user-per-screen-per-24h (shared across devices/sessions). This is how the derived-from-audit-log approach works naturally.

**Status:** Not blocking. Default behavior is already correct.

---

### Q3 — What happens when a student completes Module 8?

Spec covers blueprint assembly (Screen 9) and mentions "Continue to Build Course Assets" as a CTA. But downstream builders (lesson content, sales page adaptation, etc.) are Phase 2 features not in this build.

**Proposed default:** Screen 9 assembly = module complete. Show blueprint + export CTA. "Continue to Build Course Assets" CTA shows "Coming Soon" placeholder for now.

**Status:** Not blocking Phase 1. Address in Phase 4 (blueprint assembly).

---

### Q4 — Module 8 completion and `module_progress` table

When a student approves Screen 9 (blueprint), should we insert/update a row in `module_progress` with `module_number = 8`?

**Proposed default:** Yes. Write `module_progress` row with `completed_at = blueprint_approved_at`. This keeps existing dashboard progress calculations consistent.

**Status:** Will implement in Phase 4 (blueprint assembly).

---

### Q5 — Failure mode when session_context_cache is stale after upstream schema change

If we add a new field to an approved step's schema AFTER a user already cached it, their cache could be stale. No invalidation on schema change is currently planned.

**Proposed default:** Cache invalidation is only triggered by screen reopen (per spec). Schema-change invalidation is out of scope — we don't change schemas of live sessions.

**Status:** Not blocking. Acceptable trade-off.

---

### Q6 — 60-day-since-enrollment unlock gate

Documents recommend 60-day minimum but it's not mandatory. Currently off.

**Proposed default:** OFF by default. Enable later via env var `MODULE8_MIN_DAYS_SINCE_ENROLLMENT=60` if needed.

**Status:** Resolved for Phase 1a. Can enable later without code change.
