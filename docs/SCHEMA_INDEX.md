# Module 8 — Schema Index

Schemas will be added as each screen is built.

## Phase 1a (current)

No zod schemas yet. Phase 1a ships with:
- Database tables only (see `migrations/module8_tables.sql`)
- Screen 0 has no creator output and no validator schema; only persists `orientation_acknowledged_at` + `orientation_version`

## Phase 1b (next)

Will add:
- `lib/module8/schemas/screen_1.ts` — Readiness Check (request + draft output + approved output schemas)
- `lib/module8/schemas/screen_2.ts` — Transformation
- `lib/module8/schemas/screen_3.ts` — Course Type
- `lib/module8/schemas/validator_response.ts` — shared shape for validator output

## Phase 2

Will add:
- `lib/module8/schemas/screen_4.ts` — Chapter Audit
- `lib/module8/schemas/screen_5.ts` — Course Skeleton
- `lib/module8/schemas/screen_6.ts` — Lesson Map

## Phase 3

Will add:
- `lib/module8/schemas/screen_7.ts` — Implementation Assets
- `lib/module8/schemas/screen_8.ts` — Student Experience

## Phase 4

Will add:
- `lib/module8/schemas/blueprint.ts` — Screen 9 blueprint assembly schema
