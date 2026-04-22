# Module 8 — Build Documentation

**Status:** Phase 1a complete (foundation + Screen 0). Phases 1b-4 pending.

---

## Overview

Module 8 is an advanced, stateful, schema-driven workflow engine that helps eligible KLARO students turn their existing e-book foundation into a structured course blueprint.

**User-facing title:** Turn Your E-book Into a Course

**Not a one-shot course generator.** Uses 10 screens (Screen 0 orientation through Screen 9 blueprint), 3 validators running in parallel per step, surgical revisions capped at 2 loops per step.

See `BUILD_PLAN_MODULE8.md` at the repo root for the full phased build plan.

---

## How to Run (Phase 1a)

### 1. Run the database migration

Open Supabase → SQL Editor, paste and run:

```
migrations/module8_tables.sql
```

This creates 7 new tables (`module8_sessions`, `module8_step_outputs`, `module8_validator_runs`, `module8_qc_runs`, `module8_revision_runs`, `module8_downstream_flags`, `module8_audit_log`) and adds a `module8_beta BOOLEAN` column to `profiles`. The migration is idempotent (safe to re-run).

**Zero impact to Modules 1-7.** No existing table schema is modified.

### 2. Flag a user for Module 8 beta (admin action)

After the migration runs, as an admin you can enable Module 8 for a specific user:

```
POST /api/admin/module8-beta
Content-Type: application/json

{ "email": "yourself@example.com", "enabled": true }
```

Or directly in Supabase:

```sql
UPDATE profiles SET module8_beta = true WHERE email = 'yourself@example.com';
```

Admin accounts (role='admin') always see Module 8 as unlocked regardless of the flag.

### 3. Access Module 8

1. Complete all 7 existing modules (or log in as admin)
2. Visit the dashboard — you'll see a new "Module 8 · Beta" card below Module 7
3. If eligible: click "Open" to enter
4. The entry page routes you to Screen 0 (orientation), which records acknowledgment and routes to Screen 1

---

## Routes (Phase 1a)

| Method + Path | Purpose |
|---|---|
| `GET /api/module8/session` | Get active session + unlock eligibility |
| `POST /api/module8/session` | Start/resume a session |
| `POST /api/module8/screen/0/acknowledge` | Record orientation acknowledgment, advance to Screen 1 |
| `POST /api/admin/module8-beta` | Admin-only: toggle `module8_beta` flag for a user |
| `/module/8` | Module 8 entry page (client) — routes to locked/unlocked UI |
| `/module/8/orientation` | Screen 0 |

Routes for Screens 1-9 will be added in subsequent phases.

---

## Environment Variables

None new in Phase 1a. Uses existing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (will be used by Creator/Validators/Reviser in Phase 1b+)

Future:
- `MODULE8_MIN_DAYS_SINCE_ENROLLMENT` — optional. Default: `0` (off). Set to `60` to enforce the 60-day rule.

---

## File Locations

### Library code (`lib/module8/`)
- `types.ts` — canonical enums, types, constants, hard rule IDs
- `config.ts` — step-level config (one per screen) and helpers
- `hash.ts` — canonical SHA-256 + stable JSON serialization
- `unlock.ts` — deterministic unlock eligibility check
- `persistence.ts` — DB helpers for sessions, step outputs, audit log

### API routes (`app/api/module8/`)
- `session/route.ts` — GET + POST for session
- `screen/[screenId]/acknowledge/route.ts` — Screen 0 acknowledgment

### UI pages (`app/module/8/`)
- `page.tsx` — entry page (routes to locked / unlocked state)
- `orientation/page.tsx` — Screen 0

### Admin routes
- `app/api/admin/module8-beta/route.ts` — beta flag toggle

### Docs
- `docs/IMPLEMENTATION_NOTE.md` — conflicts + resolutions
- `docs/OPEN_QUESTIONS.md` — deferred items
- `docs/SCHEMA_INDEX.md` — schema registry (will grow in Phase 1b+)
- `docs/PROMPT_INDEX.md` — prompt registry (will grow in Phase 1b+)

---

## What's Safe in Production

- All existing routes unchanged (`/module/1` through `/module/7`, `/coach/*`, `/dashboard`, `/admin`, etc.)
- All existing tables untouched; only additive changes
- Middleware changes: none
- Default behavior for non-beta users: Module 8 card appears as **locked** with a "Coming soon" message
- Middleware protects `/module/8/*` the same way it protects Modules 1-7 (auth + 90-day expiry)
- Build verified: `npx next build` passes with zero errors

---

## What's Not Yet Built (Phase 1b onwards)

- Screen 1 (Readiness Check) with scoring + Creator + Validators
- Screens 2-3 with full QC pipeline
- Screens 4-6 (chapter audit, skeleton, lessons)
- Screen 7 (implementation assets) + Screen 8 (student experience)
- Screen 9 (blueprint assembly)
- Prompt files for creator/validators/reviser
- Zod schemas per screen
- Hard rule implementations (RULE_001 through RULE_011)
- Duplicate detection (embeddings + Jaccard fallback)
- Drift check
- Downstream review flags UI
- Reviser runtime
- Regenerate limits enforcement
- Blueprint export
- Replay/debug tooling (Phase 5, optional)
