# Module 8 — Prompt Index

## Phase 1a (current)

No prompts yet. Screen 0 has no AI.

## Phase 1b (next)

Will add creator prompts:
- `prompts/module8/creator/screen_1_readiness.md` — generates coach_notes prose (scoring is deterministic)
- `prompts/module8/creator/screen_2_transformation.md` — generates transformation candidate statements
- `prompts/module8/creator/screen_3_course_type.md` — generates course depth + delivery format recommendations

## Phase 2

Will add:
- `prompts/module8/creator/screen_4_chapter_audit.md`
- `prompts/module8/creator/screen_5_course_skeleton.md`
- `prompts/module8/creator/screen_6_lesson_map.md`
- `prompts/module8/validators/curriculum.md`
- `prompts/module8/validators/learner_experience.md`
- `prompts/module8/validators/market.md`

## Phase 3

Will add:
- `prompts/module8/creator/screen_7_implementation_layer.md`
- `prompts/module8/creator/screen_8_student_experience.md`
- `prompts/module8/reviser/default.md`

## Versioning Strategy

Prompt files are Markdown. Version is derived from file content hash (SHA-256 of the file bytes, first 8 hex chars). The hash is recorded in `module8_step_outputs.prompt_version` and `module8_audit_log.prompt_version` for every invocation, so old runs can be replayed against their original prompt.

No separate "prompts" database table needed. Git history is the version control.
