-- Migration: Module 8 — Course Expansion
-- Creates all new tables needed for the Module 8 workflow engine.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- Zero impact to existing Modules 1-7.
--
-- Run in Supabase → SQL Editor.

-- ── Add tier4 access level to profiles (Module 8 access) ─────────────────────
-- tier4 is a new access tier specifically for Module 8 access.
-- No existing code references tier4 yet, so this is fully additive.
-- Adding the column only — no data changes.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'module8_beta'
  ) THEN
    ALTER TABLE profiles ADD COLUMN module8_beta BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN profiles.module8_beta IS 'Manual feature flag: true = user can access Module 8. Set by admin per user.';

-- ── 1. module8_sessions ───────────────────────────────────────────────────────
-- One row per user per active Module 8 run.

CREATE TABLE IF NOT EXISTS module8_sessions (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module8_status             TEXT NOT NULL DEFAULT 'active'
    CHECK (module8_status IN ('active', 'paused', 'completed', 'abandoned')),
  unlock_status              TEXT NOT NULL DEFAULT 'locked'
    CHECK (unlock_status IN ('locked', 'unlocked', 'override')),
  unlock_reason              TEXT,
  current_screen             INT NOT NULL DEFAULT 0 CHECK (current_screen BETWEEN 0 AND 9),
  blueprint_version          INT NOT NULL DEFAULT 1,
  session_context_cache_jsonb JSONB,
  started_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_module8_sessions_user_id ON module8_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_module8_sessions_status ON module8_sessions(module8_status);

-- ── 2. module8_step_outputs ───────────────────────────────────────────────────
-- Stores draft and approved payloads per screen.
-- The "status-on-row" model (per build instructions) means no `approved_` prefix
-- on any payload field names. Approval is tracked via status + approved_version
-- + approved_at columns.

CREATE TABLE IF NOT EXISTS module8_step_outputs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             UUID NOT NULL REFERENCES module8_sessions(id) ON DELETE CASCADE,
  screen_id              INT NOT NULL CHECK (screen_id BETWEEN 0 AND 9),
  draft_version          INT NOT NULL DEFAULT 1,
  approved_version       INT,
  draft_payload_jsonb    JSONB,
  approved_payload_jsonb JSONB,
  status                 TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'validating', 'revising', 'passed', 'escalated', 'blocked_by_rule', 'approved', 'reopened')),
  revision_count         INT NOT NULL DEFAULT 0,
  prompt_version         TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at            TIMESTAMPTZ,
  UNIQUE (session_id, screen_id)
);

CREATE INDEX IF NOT EXISTS idx_module8_step_outputs_session ON module8_step_outputs(session_id);

-- ── 3. module8_validator_runs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module8_validator_runs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID NOT NULL REFERENCES module8_sessions(id) ON DELETE CASCADE,
  screen_id                INT NOT NULL CHECK (screen_id BETWEEN 0 AND 9),
  draft_version            INT NOT NULL,
  validator_name           TEXT NOT NULL
    CHECK (validator_name IN ('curriculum', 'learner_experience', 'market')),
  score_payload_jsonb      JSONB NOT NULL,
  hard_rule_failures_jsonb JSONB,
  warnings_jsonb           JSONB,
  recommended_action       TEXT
    CHECK (recommended_action IN ('pass', 'revise', 'escalate')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module8_validator_runs_session ON module8_validator_runs(session_id, screen_id, draft_version);

-- ── 4. module8_qc_runs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module8_qc_runs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES module8_sessions(id) ON DELETE CASCADE,
  screen_id               INT NOT NULL CHECK (screen_id BETWEEN 0 AND 9),
  draft_version           INT NOT NULL,
  rule_results_jsonb      JSONB,
  schema_results_jsonb    JSONB,
  duplicate_results_jsonb JSONB,
  drift_results_jsonb     JSONB,
  final_decision          TEXT
    CHECK (final_decision IN ('pass', 'revise', 'escalate', 'blocked_by_rule')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module8_qc_runs_session ON module8_qc_runs(session_id, screen_id, draft_version);

-- ── 5. module8_revision_runs ──────────────────────────────────────────────────
-- read_only_context_hash is SHA-256 hex of canonical JSON serialization
-- (keys sorted alphabetically, no whitespace, UTF-8, preserve array order)

CREATE TABLE IF NOT EXISTS module8_revision_runs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES module8_sessions(id) ON DELETE CASCADE,
  screen_id               INT NOT NULL CHECK (screen_id BETWEEN 0 AND 9),
  source_draft_version    INT NOT NULL,
  revision_index          INT NOT NULL,
  writable_fields_jsonb   JSONB NOT NULL,
  read_only_context_hash  TEXT NOT NULL,
  revision_output_jsonb   JSONB,
  merge_result_jsonb      JSONB,
  drift_detected          BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module8_revision_runs_session ON module8_revision_runs(session_id, screen_id);

-- ── 6. module8_downstream_flags ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module8_downstream_flags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES module8_sessions(id) ON DELETE CASCADE,
  source_screen_id    INT NOT NULL CHECK (source_screen_id BETWEEN 0 AND 9),
  affected_screen_id  INT NOT NULL CHECK (affected_screen_id BETWEEN 0 AND 9),
  trigger_field       TEXT NOT NULL,
  flag_status         TEXT NOT NULL DEFAULT 'open'
    CHECK (flag_status IN ('open', 'resolved')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_module8_downstream_flags_session ON module8_downstream_flags(session_id, flag_status);

-- ── 7. module8_audit_log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module8_audit_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID REFERENCES module8_sessions(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type          TEXT NOT NULL,
  screen_id           INT CHECK (screen_id BETWEEN 0 AND 9),
  actor               TEXT CHECK (actor IN ('user', 'system', 'creator', 'validator', 'reviser', 'admin')),
  prompt_version      TEXT,
  event_payload_jsonb JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module8_audit_log_session ON module8_audit_log(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_module8_audit_log_event ON module8_audit_log(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_module8_audit_log_user ON module8_audit_log(user_id, event_type, created_at);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Students can read their own sessions and step outputs.
-- All writes go through API routes using admin client.

ALTER TABLE module8_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE module8_step_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE module8_validator_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE module8_qc_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE module8_revision_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE module8_downstream_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE module8_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own module8 sessions" ON module8_sessions;
CREATE POLICY "Users can read their own module8 sessions" ON module8_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own step outputs" ON module8_step_outputs;
CREATE POLICY "Users can read their own step outputs" ON module8_step_outputs
  FOR SELECT USING (
    session_id IN (SELECT id FROM module8_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read their own validator runs" ON module8_validator_runs;
CREATE POLICY "Users can read their own validator runs" ON module8_validator_runs
  FOR SELECT USING (
    session_id IN (SELECT id FROM module8_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read their own QC runs" ON module8_qc_runs;
CREATE POLICY "Users can read their own QC runs" ON module8_qc_runs
  FOR SELECT USING (
    session_id IN (SELECT id FROM module8_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read their own revision runs" ON module8_revision_runs;
CREATE POLICY "Users can read their own revision runs" ON module8_revision_runs
  FOR SELECT USING (
    session_id IN (SELECT id FROM module8_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read their own downstream flags" ON module8_downstream_flags;
CREATE POLICY "Users can read their own downstream flags" ON module8_downstream_flags
  FOR SELECT USING (
    session_id IN (SELECT id FROM module8_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read their own audit log" ON module8_audit_log;
CREATE POLICY "Users can read their own audit log" ON module8_audit_log
  FOR SELECT USING (auth.uid() = user_id);
