-- ─────────────────────────────────────────────────────────────────────────────
-- Fix attribution in profile_audit_log
--
-- Problem: set_audit_context() and the subsequent UPDATE land on different
-- pooled connections (Supabase uses PgBouncer in transaction-pooling mode by
-- default), so the session variables set by the first call don't survive to
-- the second. Result: audit rows show source='unknown' and actor=NULL even
-- though the route knows both.
--
-- Fix: pass actor + source as parameters into the same RPC that does the
-- UPDATE, and have that RPC set the session vars internally. Now everything
-- runs in one transaction, on one connection — the trigger sees the context.
--
-- All three RPCs accept p_actor + p_source as OPTIONAL params with sensible
-- defaults, so any existing callers still work. Updated routes pass them.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── unlock_module_for_student ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION unlock_module_for_student(
  p_student_id    UUID,
  p_module_number INT,
  p_actor         UUID DEFAULT NULL,
  p_source        TEXT DEFAULT 'unknown'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set audit context inside the same transaction as the UPDATE so the
  -- profile_access_audit trigger picks it up.
  PERFORM set_config('app.audit_user',   COALESCE(p_actor::TEXT, ''), false);
  PERFORM set_config('app.audit_source', COALESCE(p_source,     ''), false);

  UPDATE profiles
  SET    unlocked_modules = (
           SELECT ARRAY(
             SELECT DISTINCT unnest(
               COALESCE(unlocked_modules, ARRAY[]::INT[]) || ARRAY[p_module_number]
             ) ORDER BY 1
           )
         ),
         updated_at = NOW()
  WHERE  id = p_student_id;
END;
$$;

-- ─── lock_module_for_student ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lock_module_for_student(
  p_student_id    UUID,
  p_module_number INT,
  p_actor         UUID DEFAULT NULL,
  p_source        TEXT DEFAULT 'unknown'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.audit_user',   COALESCE(p_actor::TEXT, ''), false);
  PERFORM set_config('app.audit_source', COALESCE(p_source,     ''), false);

  UPDATE profiles
  SET    unlocked_modules = (
           SELECT ARRAY(
             SELECT m FROM unnest(COALESCE(unlocked_modules, ARRAY[]::INT[])) AS m
             WHERE  m <> p_module_number
             ORDER BY m
           )
         ),
         updated_at = NOW()
  WHERE  id = p_student_id;
END;
$$;

-- ─── unlock_modules_up_to ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION unlock_modules_up_to(
  p_student_id    UUID,
  p_up_to_module  INT,
  p_actor         UUID DEFAULT NULL,
  p_source        TEXT DEFAULT 'unknown'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.audit_user',   COALESCE(p_actor::TEXT, ''), false);
  PERFORM set_config('app.audit_source', COALESCE(p_source,     ''), false);

  -- Union the current set with [1..p_up_to_module] — never regress
  UPDATE profiles
  SET    unlocked_modules = (
           SELECT ARRAY(
             SELECT DISTINCT m FROM (
               SELECT unnest(COALESCE(unlocked_modules, ARRAY[]::INT[])) AS m
               UNION
               SELECT generate_series(1, p_up_to_module) AS m
             ) sub
             ORDER BY m
           )
         ),
         updated_at = NOW()
  WHERE  id = p_student_id;
END;
$$;

COMMENT ON FUNCTION unlock_module_for_student(UUID, INT, UUID, TEXT) IS
  'Append module to a student''s unlocked_modules array. Sets audit context inline.';
COMMENT ON FUNCTION lock_module_for_student(UUID, INT, UUID, TEXT) IS
  'Remove module from a student''s unlocked_modules array. Sets audit context inline.';
COMMENT ON FUNCTION unlock_modules_up_to(UUID, INT, UUID, TEXT) IS
  'Cumulatively unlock modules 1..N (never regress). Sets audit context inline.';
