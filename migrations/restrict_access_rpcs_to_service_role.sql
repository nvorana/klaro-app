-- ─────────────────────────────────────────────────────────────────────────────
-- Restrict the module lock/unlock RPCs (and set_audit_context) to the service
-- role.
--
-- Found 2026-11-16: Postgres grants EXECUTE to PUBLIC by default, so these
-- SECURITY DEFINER functions were callable through PostgREST by anyone holding
-- the public anon key (shipped in every browser), signed in or not. A student
-- could call unlock_modules_up_to(own_id, 7) and skip coach pacing and payment.
--
-- Every legitimate caller uses the service role (createAdminClient in API
-- routes, SUPABASE_SERVICE_ROLE_KEY in scripts), so nothing in the app changes.
-- Loops over all overloads so any signature that exists is covered.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('unlock_module_for_student', 'lock_module_for_student', 'unlock_modules_up_to', 'set_audit_context')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
