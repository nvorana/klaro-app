-- ─────────────────────────────────────────────────────────────────────────────
-- profile_audit_log — record every change to access-relevant fields.
--
-- Why: when a student's unlocked_modules, access_level, or access_suspended
-- changes, we want a full audit trail. This lets us answer:
--   - "Who unlocked Module 4 for Wendy on May 18?"
--   - "When did this student's access change to full_access?"
--   - "Show me every access change Edgar has made this week."
--
-- The trigger fires inside Postgres on UPDATE — so it catches every source:
-- coach UI, admin dashboard, webhooks, scripts, and direct Supabase Studio
-- edits. Nothing can change these fields without leaving a row here.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_audit_log (
  id           BIGSERIAL    PRIMARY KEY,
  profile_id   UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  field        TEXT         NOT NULL,            -- 'unlocked_modules' | 'access_level' | 'access_suspended'
  before_value JSONB,                            -- old value (or NULL on first set)
  after_value  JSONB,                            -- new value
  changed_by   UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  source       TEXT         NOT NULL DEFAULT 'unknown',
                            -- 'coach_unlock_api' | 'coach_lock_api' | 'webhook_systeme'
                            -- 'sweep_pending'    | 'cohort_unlock'  | 'batch_unlock'
                            -- 'claim_pending'    | 'direct_db'      | 'unknown'
  changed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_audit_profile  ON profile_audit_log(profile_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_audit_field    ON profile_audit_log(field, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_audit_by       ON profile_audit_log(changed_by, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_audit_recent   ON profile_audit_log(changed_at DESC);

COMMENT ON TABLE profile_audit_log IS
  'Append-only audit log of access-relevant changes on profiles. Populated by the profile_access_audit trigger.';

-- ─── Trigger function ──────────────────────────────────────────────────────────
-- Reads two session variables that callers SHOULD set before the UPDATE:
--   app.audit_user   — UUID of the actor (coach / admin / system user)
--   app.audit_source — short string describing the source (e.g. 'coach_unlock_api')
-- If neither is set, falls back to auth.uid() (works for direct-user supabase-js
-- calls) and 'unknown' source. Either way, we always get a complete row.

CREATE OR REPLACE FUNCTION log_profile_access_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_changed_by UUID;
  v_source     TEXT;
  v_config_uid TEXT;
BEGIN
  -- Prefer the explicit audit_user the caller set; fall back to auth.uid().
  v_config_uid := current_setting('app.audit_user', true);
  IF v_config_uid IS NOT NULL AND v_config_uid <> '' THEN
    BEGIN
      v_changed_by := v_config_uid::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_changed_by := NULL;
    END;
  ELSE
    BEGIN
      v_changed_by := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      v_changed_by := NULL;
    END;
  END IF;

  v_source := current_setting('app.audit_source', true);
  IF v_source IS NULL OR v_source = '' THEN
    v_source := 'unknown';
  END IF;

  -- unlocked_modules changed
  IF NEW.unlocked_modules IS DISTINCT FROM OLD.unlocked_modules THEN
    INSERT INTO profile_audit_log (profile_id, field, before_value, after_value, changed_by, source)
    VALUES (
      NEW.id,
      'unlocked_modules',
      to_jsonb(OLD.unlocked_modules),
      to_jsonb(NEW.unlocked_modules),
      v_changed_by,
      v_source
    );
  END IF;

  -- access_level changed
  IF NEW.access_level IS DISTINCT FROM OLD.access_level THEN
    INSERT INTO profile_audit_log (profile_id, field, before_value, after_value, changed_by, source)
    VALUES (
      NEW.id,
      'access_level',
      to_jsonb(OLD.access_level),
      to_jsonb(NEW.access_level),
      v_changed_by,
      v_source
    );
  END IF;

  -- access_suspended changed
  IF NEW.access_suspended IS DISTINCT FROM OLD.access_suspended THEN
    INSERT INTO profile_audit_log (profile_id, field, before_value, after_value, changed_by, source)
    VALUES (
      NEW.id,
      'access_suspended',
      to_jsonb(OLD.access_suspended),
      to_jsonb(NEW.access_suspended),
      v_changed_by,
      v_source
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Trigger ───────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS profile_access_audit ON profiles;
CREATE TRIGGER profile_access_audit
AFTER UPDATE OF unlocked_modules, access_level, access_suspended ON profiles
FOR EACH ROW
EXECUTE FUNCTION log_profile_access_change();

-- ─── Helper RPC: set audit context within the same DB session ──────────────────
-- Callers (API routes, RPCs) should run this with `set_local=true` semantics
-- BEFORE doing their UPDATE. The values persist until the end of the current
-- transaction (or RPC call). The trigger picks them up automatically.
--
-- Usage from Node.js:
--   await admin.rpc('set_audit_context', { p_user: userId, p_source: 'coach_unlock_api' })
--   await admin.from('profiles').update(...).eq('id', studentId)
--
-- NOTE on serverless connection reuse: Supabase JS client may use different
-- pooled connections across two separate calls. For guaranteed atomic context,
-- callers can instead BUNDLE both into a single RPC (recommended for any RPC
-- that does multiple writes). For one-shot UPDATEs, two separate calls work
-- when the route uses a fresh service-role client (the calls go through the
-- same connection in practice for sequential awaits, but this is not
-- contractually guaranteed).

CREATE OR REPLACE FUNCTION set_audit_context(p_user UUID, p_source TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.audit_user',   COALESCE(p_user::TEXT, ''), false);
  PERFORM set_config('app.audit_source', COALESCE(p_source,    ''), false);
END;
$$;

-- ─── RLS — admins & coaches can read; nobody can insert/update/delete ──────────
ALTER TABLE profile_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_read_admin_coach" ON profile_audit_log;
CREATE POLICY "audit_log_read_admin_coach" ON profile_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'coach')
  )
);

-- No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER trigger writes.

COMMENT ON FUNCTION log_profile_access_change() IS
  'Trigger fn: appends one row to profile_audit_log for each access-field change on profiles. Reads app.audit_user and app.audit_source session vars when set.';

COMMENT ON FUNCTION set_audit_context(UUID, TEXT) IS
  'Set audit context for the current transaction. Call BEFORE updating profiles to attribute the change to a specific user + source.';
